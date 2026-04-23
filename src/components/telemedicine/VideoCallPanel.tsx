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

// ─── ICE Server Config ───────────────────────────────────

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// ─── Types ───────────────────────────────────────────────

interface VideoCallPanelProps {
  appointmentId: string;
  userId: string;
  isInitiator: boolean; // true = doctor (creates offer), false = patient (answers)
  onCallEnd?: () => void;
  className?: string;
}

type SignalPayload = {
  type: "offer" | "answer" | "ice-candidate" | "end-call";
  sender: string;
  data: string;
};

// ─── Component ───────────────────────────────────────────

export default function VideoCallPanel({
  appointmentId,
  userId,
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

  const channelName = `video_sessions:${appointmentId}`;

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

  const sendSignal = useCallback(
    (type: SignalPayload["type"], data: string) => {
      supabase.channel(channelName).send({
        type: "broadcast",
        event: "signal",
        payload: { type, sender: userId, data } as SignalPayload,
      });
    },
    [channelName, userId]
  );

  // ─── Create peer connection ──────────────────────────────

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ice-candidate", JSON.stringify(event.candidate));
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

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (payload.sender === userId) return; // ignore own messages

      const pc = pcRef.current || createPeerConnection();

      switch (payload.type) {
        case "offer": {
          await pc.setRemoteDescription(
            new RTCSessionDescription(JSON.parse(payload.data))
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal("answer", JSON.stringify(answer));
          break;
        }
        case "answer": {
          await pc.setRemoteDescription(
            new RTCSessionDescription(JSON.parse(payload.data))
          );
          break;
        }
        case "ice-candidate": {
          const candidate = new RTCIceCandidate(JSON.parse(payload.data));
          await pc.addIceCandidate(candidate);
          break;
        }
        case "end-call": {
          endCall(false);
          break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, createPeerConnection, sendSignal]
  );

  // ─── Init: get media, subscribe, start call ──────────────

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      // Get local media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection and add tracks
        const pc = createPeerConnection();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Subscribe to Supabase Realtime signaling channel
        channel = supabase.channel(channelName);

        channel
          .on("broadcast", { event: "signal" }, ({ payload }) => {
            handleSignal(payload as SignalPayload);
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED" && isInitiator) {
              // Doctor creates offer
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              sendSignal("offer", JSON.stringify(offer));
            }
            if (status === "SUBSCRIBED") {
              setIsConnecting(true);
            }
          });
      } catch (err) {
        console.error("Failed to get media devices:", err);
        setIsConnecting(false);
      }
    }

    init();

    return () => {
      channel?.unsubscribe();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const endCall = (sendEndSignal = true) => {
    if (sendEndSignal) {
      sendSignal("end-call", "");
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    onCallEnd?.();
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
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
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
              ? "bg-blue-500 hover:bg-blue-600 text-white"
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
