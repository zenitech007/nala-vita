"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

import { callTopic, privateChannel, receivedCallSignal, type Signal } from "@/lib/realtime-events";

interface CallMembership {
  selfId: string;
  peerId: string;
  initiator: boolean;
  iceServers: RTCIceServer[];
}

interface VideoCallPanelProps {
  appointmentId: string;
  userId: string;
  isInitiator: boolean; // true = doctor (creates offer), false = patient (answers)
  onCallEnd?: () => void;
  className?: string;
}

// ─── Component ───────────────────────────────────────────

export default function VideoCallPanel({
  appointmentId,
  isInitiator,
  onCallEnd,
  className,
}: VideoCallPanelProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const membership = useRef<CallMembership | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const receivedEvents = useRef(new Set<string>());
  const [callError, setCallError] = useState("");
  const signalEndpoint = `/api/appointments/${encodeURIComponent(appointmentId)}/signal`;

  // ─── Call duration timer ─────────────────────────────────

  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ─── Send signaling message ──────────────────────────────

  const sendSignal = useCallback(async (signal: Signal) => {
    try {
      const response = await fetch(signalEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signal),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("Signal delivery failed");
    } catch {
      setCallError("Video signaling is unavailable. Rejoin the call to retry.");
      setIsConnecting(false);
    }
  }, [signalEndpoint]);

  // ─── Create peer connection ──────────────────────────────

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: membership.current?.iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate?.candidate) {
        void sendSignal({
          type: "ice-candidate",
          data: { ...event.candidate.toJSON(), candidate: event.candidate.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setIsConnected(true);
        setIsConnecting(false);
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        setIsConnected(false);
      }
    };

    pcRef.current = pc;
    return pc;
  }, [sendSignal]);

  // ─── Handle incoming signal ──────────────────────────────

  const offerToPeer = useCallback(async (pc: RTCPeerConnection) => {
    if (pc.signalingState === "stable") await pc.setLocalDescription(await pc.createOffer());
    const description = pc.localDescription;
    if (pc.signalingState === "have-local-offer" && description?.sdp) {
      await sendSignal({ type: "offer", data: description.sdp });
    }
  }, [sendSignal]);

  const endCall = (sendEndSignal = true) => {
    if (sendEndSignal) {
      void sendSignal({ type: "end-call" });
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    membership.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    onCallEnd?.();
  };

  const handleSignal = useCallback(async (raw: unknown) => {
    const member = membership.current;
    const pc = pcRef.current;
    if (!member || !pc || pc.signalingState === "closed") return;
    const event = receivedCallSignal(raw, appointmentId, member.selfId, member.peerId);
    if (!event || receivedEvents.current.has(event.eventId)) return;
    receivedEvents.current.add(event.eventId);
    if (receivedEvents.current.size > 256) {
      const oldest = receivedEvents.current.values().next().value;
      if (oldest) receivedEvents.current.delete(oldest);
    }

    const signal = event.signal;
    if (signal.type === "end-call") {
      endCall(false);
      return;
    }
    if (signal.type === "ready" && member.initiator) {
      await offerToPeer(pc);
      return;
    }
    if (signal.type === "ice-candidate") {
      if (pc.remoteDescription) await pc.addIceCandidate(signal.data);
      else if (pendingCandidates.current.length < 128) pendingCandidates.current.push(signal.data);
      return;
    }
    if (signal.type === "offer" && !member.initiator) {
      await pc.setRemoteDescription({ type: "offer", sdp: signal.data });
      await pc.setLocalDescription(await pc.createAnswer());
      if (pc.localDescription?.sdp) await sendSignal({ type: "answer", data: pc.localDescription.sdp });
    } else if (signal.type === "answer" && member.initiator && pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription({ type: "answer", sdp: signal.data });
    }
    if (pc.remoteDescription) {
      for (const candidate of pendingCandidates.current.splice(0)) await pc.addIceCandidate(candidate);
    }
    // endCall uses the callback from this call's render, as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, offerToPeer, sendSignal]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let closed = false;
    let signalQueue = Promise.resolve();
    const controller = new AbortController();

    async function init() {
      try {
        const response = await fetch(signalEndpoint, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Video appointment unavailable");
        const member = await response.json() as CallMembership;
        if (closed) return;
        membership.current = member;
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (closed) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = createPeerConnection();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        channel = supabase.channel(callTopic(appointmentId, member.selfId), privateChannel)
          .on("broadcast", { event: "signal" }, ({ payload }) => {
            signalQueue = signalQueue.then(() => handleSignal(payload)).catch(() => {
              setCallError("The video connection could not be established. Rejoin to retry.");
              setIsConnecting(false);
            });
          })
          .subscribe(status => {
            if (closed) return;
            if (status === "SUBSCRIBED") {
              signalQueue = signalQueue.then(() => member.initiator ? offerToPeer(pc) : sendSignal({ type: "ready" }))
                .catch(() => setCallError("The video connection could not be established."));
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setCallError("Private video signaling is unavailable.");
              setIsConnecting(false);
            }
          });
      } catch {
        if (!closed) {
          setCallError("Video could not start. Check appointment access and camera permissions.");
          setIsConnecting(false);
        }
      }
    }

    void init();
    const eventIds = receivedEvents.current;
    return () => {
      closed = true;
      controller.abort();
      if (channel) void supabase.removeChannel(channel);
      membership.current = null;
      pendingCandidates.current = [];
      eventIds.clear();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [appointmentId, createPeerConnection, handleSignal, offerToPeer, sendSignal, signalEndpoint]);

  // ─── Controls ────────────────────────────────────────────

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  };

  const toggleScreenShare = async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      // Revert to camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      const sender = pc
        .getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(videoTrack);
      }
      // Update local preview
      const localStream = localStreamRef.current;
      if (localStream) {
        const oldTrack = localStream.getVideoTracks()[0];
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
        localStream.addTrack(videoTrack);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pc
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
        // When user stops sharing via browser UI
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      } catch {
        // user cancelled screen share picker
      }
    }
  };

  const toggleFullscreen = () => {
    const container = document.getElementById("video-container");
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      container.requestFullscreen();
      setIsFullscreen(true);
    }
  };



  // ─── Render ──────────────────────────────────────────────

  return (
    <div
      id="video-container"
      className={cn(
        "relative bg-gray-900 rounded-2xl overflow-hidden flex flex-col",
        className
      )}
    >
      {callError && <p role="alert" className="px-4 py-2 text-sm text-white">{callError}</p>}
      {/* Remote video (main) */}
      <div className="relative flex-1 min-h-[300px]">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Connecting overlay */}
        {isConnecting && !isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
            <div className="w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white text-lg font-medium">
              Waiting for {isInitiator ? "patient" : "doctor"} to join...
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Make sure your camera and microphone are enabled
            </p>
          </div>
        )}

        {/* Call info overlay (top) */}
        {isConnected && (
          <div className="absolute top-4 left-4 flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-white text-sm font-medium">
                {formatDuration(callDuration)}
              </span>
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-xl overflow-hidden border-2 border-gray-700 shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "w-full h-full object-cover",
              isCameraOff && "hidden"
            )}
          />
          {isCameraOff && (
            <div className="w-full h-full flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-500" />
            </div>
          )}
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-3 px-6 py-4 bg-gray-900/95 backdrop-blur-sm">
        <button
          onClick={toggleMute}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition",
            isMuted
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          )}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={toggleCamera}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition",
            isCameraOff
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          )}
          title={isCameraOff ? "Turn camera on" : "Turn camera off"}
        >
          {isCameraOff ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={toggleScreenShare}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition",
            isScreenSharing
              ? "bg-[var(--primary)] hover:opacity-90 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          )}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          <Monitor className="w-5 h-5" />
        </button>

        <button
          onClick={toggleFullscreen}
          className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="w-5 h-5" />
          ) : (
            <Maximize2 className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={() => endCall(true)}
          className="w-14 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition"
          title="End call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
