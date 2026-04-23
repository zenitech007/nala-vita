"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Loader2,
  X,
  File,
  ArrowDown,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  attachmentUrl: string | null;
  createdAt: string;
}

interface ChatWindowProps {
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  className?: string;
}

// ─── Component ───────────────────────────────────────────

export default function ChatWindow({
  currentUserId,
  otherUserId,
  otherUserName,
  otherUserRole,
  className,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch messages ────────────────────────────────────

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/messages?otherUserId=${otherUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // placeholder
    } finally {
      setIsLoading(false);
    }
  }, [otherUserId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ─── Supabase Realtime subscription ────────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${[currentUserId, otherUserId].sort().join("-")}`)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .on("broadcast", { event: "read_receipt" }, ({ payload }) => {
        const { messageIds } = payload as { messageIds: string[] };
        setMessages((prev) =>
          prev.map((m) =>
            messageIds.includes(m.id) ? { ...m, isRead: true } : m
          )
        );
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, otherUserId]);

  // ─── Auto-scroll ───────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollDown(!atBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ─── Mark as read ──────────────────────────────────────

  useEffect(() => {
    const unread = messages.filter(
      (m) => m.senderId === otherUserId && !m.isRead
    );
    if (unread.length === 0) return;

    // Mark as read via API
    const ids = unread.map((m) => m.id);
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageIds: ids }),
    }).catch(() => {});

    // Broadcast read receipt
    supabase
      .channel(`messages:${[currentUserId, otherUserId].sort().join("-")}`)
      .send({
        type: "broadcast",
        event: "read_receipt",
        payload: { messageIds: ids },
      });
  }, [messages, otherUserId, currentUserId]);

  // ─── File attachment ───────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachmentFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setAttachmentPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `chat/${currentUserId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("attachments")
        .upload(path, file);

      if (error) {
        console.error("Upload error:", error);
        return null;
      }

      const { data } = supabase.storage.from("attachments").getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Send message ──────────────────────────────────────

  const handleSend = async () => {
    if (!newMessage.trim() && !attachmentFile) return;
    setIsSending(true);

    try {
      let attachmentUrl: string | null = null;
      if (attachmentFile) {
        attachmentUrl = await uploadFile(attachmentFile);
      }

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: otherUserId,
          content: newMessage.trim() || (attachmentFile ? `Sent a file: ${attachmentFile.name}` : ""),
          attachmentUrl,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const msg = data.message as ChatMessage;

        // Add to local state immediately
        setMessages((prev) => [...prev, msg]);

        // Broadcast via realtime
        supabase
          .channel(`messages:${[currentUserId, otherUserId].sort().join("-")}`)
          .send({
            type: "broadcast",
            event: "new_message",
            payload: msg,
          });

        setNewMessage("");
        removeAttachment();
      }
    } catch {
      // handle
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Group messages by date ────────────────────────────

  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const dateKey = format(new Date(msg.createdAt), "MMMM d, yyyy");
    const existing = groupedMessages.find((g) => g.date === dateKey);
    if (existing) {
      existing.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateKey, msgs: [msg] });
    }
  });

  // ─── Render ────────────────────────────────────────────

  return (
    <div className={cn("flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden", className)}>
      {/* Chat header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <span className="text-blue-600 font-semibold text-sm">
            {otherUserName.charAt(0)}
          </span>
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{otherUserName}</p>
          <p className="text-xs text-gray-500">{otherUserRole}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-xs text-gray-400">Online</span>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-1 min-h-[300px] relative"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-400 text-sm">No messages yet</p>
              <p className="text-gray-300 text-xs mt-1">Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium">{group.date}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {group.msgs.map((msg) => {
                const isOwn = msg.senderId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={cn("flex mb-2", isOwn ? "justify-end" : "justify-start")}
                  >
                    <div className={cn("max-w-[70%]")}>
                      {/* Attachment */}
                      {msg.attachmentUrl && (
                        <div className={cn("mb-1 rounded-xl overflow-hidden", isOwn ? "ml-auto" : "")}>
                          {msg.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                            <Image
                              src={msg.attachmentUrl}
                              alt="attachment"
                              width={320}
                              height={192}
                              className="max-w-full max-h-48 rounded-xl object-contain"
                              unoptimized
                            />
                          ) : (
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-sm",
                                isOwn ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700"
                              )}
                            >
                              <File className="w-4 h-4" />
                              View attachment
                            </a>
                          )}
                        </div>
                      )}

                      {/* Message bubble */}
                      {msg.content && (
                        <div
                          className={cn(
                            "px-4 py-2.5 rounded-2xl text-sm",
                            isOwn
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-gray-100 text-gray-900 rounded-bl-md"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                      )}

                      {/* Time + read receipt */}
                      <div className={cn("flex items-center gap-1 mt-0.5 px-1", isOwn ? "justify-end" : "justify-start")}>
                        <span className="text-xs text-gray-400">
                          {format(new Date(msg.createdAt), "h:mm a")}
                        </span>
                        {isOwn && (
                          msg.isRead ? (
                            <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-gray-400" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />

        {/* Scroll to bottom button */}
        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-white shadow-lg border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 transition"
          >
            <ArrowDown className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Attachment preview */}
      {attachmentFile && (
        <div className="px-6 py-2 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            {attachmentPreview ? (
              <Image src={attachmentPreview} alt="preview" width={48} height={48} className="w-12 h-12 rounded-lg object-cover" unoptimized />
            ) : (
              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                <File className="w-5 h-5 text-gray-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">{attachmentFile.name}</p>
              <p className="text-xs text-gray-400">
                {(attachmentFile.size / 1024).toFixed(1)} KB
                {isUploading && " — Uploading..."}
              </p>
            </div>
            <button onClick={removeAttachment} className="p-1.5 hover:bg-gray-200 rounded-lg">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-end gap-2">
          {/* File buttons */}
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.click();
                }
              }}
              className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
              title="Send image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
          />

          {/* Text input */}
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none max-h-32"
          />

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={isSending || (!newMessage.trim() && !attachmentFile)}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
