"use client";

import { useState, useRef, useEffect } from "react";
import { User, Copy, Check, Volume2, VolumeX, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface ChatMessageProps {
  /** True when the message was sent by the local viewer (right-aligned bubble). */
  isMine: boolean;
  /** Message body (markdown supported). */
  content: string;
  /** Optional attached image URL. */
  imageUrl?: string;
  /** ISO timestamp; surfaced via hover title. */
  sentAt: string;
  /** Initials shown in the other-party avatar (ignored when isMine). */
  otherInitials?: string;
}

export default function ChatMessage({
  isMine,
  content,
  imageUrl,
  sentAt,
  otherInitials,
}: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up audio playback on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const cleanSpeechText = (text: string) => {
    return text
      .replace(/[*_#`~>\[\]]/g, "")
      .replace(/\(http[^)]+\)/g, "")
      .replace(/<[^>]*>/g, "")
      .trim();
  };

  const handleSpeak = async () => {
    // If currently playing, stop it
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    const plain = cleanSpeechText(content);
    if (!plain) return;

    setIsLoadingAudio(true);

    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plain }),
      });

      const data = await res.json().catch(() => ({ fallback: true }));

      if (data.success && data.audioData) {
        const audio = new Audio(data.audioData);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          audioRef.current = null;
        };
        audio.onerror = () => {
          playWithWebSpeech(plain);
        };
        await audio.play();
        setIsPlaying(true);
      } else {
        playWithWebSpeech(plain);
      }
    } catch {
      playWithWebSpeech(plain);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const playWithWebSpeech = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlaying(false);
    }
  };

  return (
    <div
      className={`flex gap-3 w-full animate-in slide-in-from-bottom-2 duration-300 ${
        isMine ? "flex-row-reverse" : "flex-row"
      }`}
      title={new Date(sentAt).toLocaleString()}
    >
      <div className="shrink-0 mt-1">
        {isMine ? (
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 shadow-sm transition-colors">
            <User size={18} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm bg-[var(--primary)] text-xs font-semibold">
            {otherInitials ?? "?"}
          </div>
        )}
      </div>

      <div
        className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[80%]`}
      >
        <div className="flex items-center gap-1 mb-1 px-1">
          <button
            onClick={handleCopy}
            aria-label={isCopied ? "Copied" : "Copy message"}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={isCopied ? "Copied!" : "Copy message"}
          >
            {isCopied ? (
              <Check size={14} className="text-green-500 dark:text-green-400" />
            ) : (
              <Copy size={14} />
            )}
          </button>

          {!isMine && (
            <button
              onClick={handleSpeak}
              disabled={isLoadingAudio}
              aria-label={isPlaying ? "Stop speech" : "Read aloud with Gemini voice"}
              className={`p-1 rounded-md transition-colors ${
                isPlaying
                  ? "text-[var(--primary)] bg-[var(--primary)]/10"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              title={isPlaying ? "Stop listening" : "Listen (Text-to-Speech)"}
            >
              {isLoadingAudio ? (
                <Loader2 size={14} className="animate-spin text-[var(--primary)]" />
              ) : isPlaying ? (
                <VolumeX size={14} className="text-[var(--primary)]" />
              ) : (
                <Volume2 size={14} />
              )}
            </button>
          )}
        </div>

        <div
          className={`px-5 py-3.5 shadow-sm text-[15px] leading-relaxed flex flex-col gap-2 transition-colors ${
            isMine
              ? "text-white rounded-2xl rounded-tr-sm bg-[var(--primary)]"
              : "bg-white dark:bg-[#2B2D31] border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-sm"
          }`}
        >
          {imageUrl && (
            <div className="relative rounded-xl overflow-hidden mb-1 border border-white/20 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Attached"
                className="rounded-xl max-w-sm max-h-80 object-cover cursor-pointer hover:opacity-90 transition"
              />
            </div>
          )}

          <div className="chat-bubble prose dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
