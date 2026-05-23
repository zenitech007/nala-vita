"use client";

import { useRef, useEffect } from "react";
import { Send, Paperclip, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => Promise<void> | void;
  isSending?: boolean;
  imageFile?: File | null;
  onImageChange?: (f: File | null) => void;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  isSending = false,
  imageFile = null,
  onImageChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea (caps at ~5 lines / 120px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onImageChange) {
      onImageChange(e.target.files[0]);
    }
  };

  const clearImage = () => {
    if (onImageChange) onImageChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hasContent = value.trim().length > 0 || imageFile !== null;

  return (
    <div className="w-full">
      <div className="relative">
        {/* Image preview bubble */}
        {imageFile && (
          <div className="absolute -top-28 left-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="relative w-36 h-28 rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Upload preview"
                className="w-full h-full object-cover hover:opacity-90 transition-opacity cursor-pointer"
              />
              <button
                type="button"
                onClick={clearImage}
                aria-label="Remove attachment"
                className="absolute top-1 right-1 bg-gray-800 dark:bg-gray-600 hover:bg-gray-700 text-white rounded-full p-1 shadow-md transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Main input wrapper */}
        <div className="relative flex items-end bg-white dark:bg-[#1E1F22] border border-gray-300 dark:border-gray-700 rounded-3xl shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-[var(--primary)]/50">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          {onImageChange && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              aria-label="Attach an image"
              className="p-3 mb-1 ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 shrink-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Attach an image"
            >
              <Paperclip size={22} />
            </button>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type a message…"
            rows={1}
            disabled={isSending}
            className="w-full max-h-30 py-4 px-2 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none outline-none overflow-y-auto leading-relaxed disabled:opacity-50"
          />

          <div className="p-2 mb-1 mr-1 shrink-0 flex items-center justify-center min-w-12">
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={isSending || !hasContent}
              aria-label="Send"
              className="p-2.5 rounded-full text-white transition-all hover:scale-105 shadow-sm disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed bg-[var(--primary)]"
            >
              <Send size={18} className="ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
