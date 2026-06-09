"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import AmeliaChat from "./AmeliaChat";
import AmeliaMemoryPanel from "./AmeliaMemoryPanel";
import AmeliaRemindersPanel from "./AmeliaRemindersPanel";

type Tab = "chat" | "memory" | "reminders";

export default function AmeliaTabs() {
  const [tab, setTab] = useState<Tab>("chat");

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={cn(
        "px-4 py-1.5 text-sm font-medium rounded-lg transition",
        tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-3 self-start">
        {tabBtn("chat", "Chat")}
        {tabBtn("memory", "What Amelia knows")}
        {tabBtn("reminders", "Reminders")}
      </div>
      <div className="flex-1 min-h-0 rounded-2xl border border-gray-100 overflow-hidden">
        {tab === "chat" && <AmeliaChat />}
        {tab === "memory" && <AmeliaMemoryPanel />}
        {tab === "reminders" && <AmeliaRemindersPanel />}
      </div>
    </div>
  );
}
