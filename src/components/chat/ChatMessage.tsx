"use client";

import { useState } from "react";
import { User, Copy, Check } from "lucide-react";
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
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
        <div className="flex items-center gap-2 mb-1 px-1">
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
              {/* Use plain <img> here because attachments come from unconstrained user-uploaded URLs */}
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
