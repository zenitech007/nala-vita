"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import AmeliaChat from "./AmeliaChat";
import AmeliaMemoryPanel from "./AmeliaMemoryPanel";

export default function AmeliaTabs() {
  const [tab, setTab] = useState<"chat" | "memory">("chat");

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-3 self-start">
        <button
          onClick={() => setTab("chat")}
          className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition", tab === "chat" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
        >
          Chat
        </button>
        <button
          onClick={() => setTab("memory")}
          className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition", tab === "memory" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
        >
          What Amelia knows
        </button>
      </div>
      <div className="flex-1 min-h-0 rounded-2xl border border-gray-100 overflow-hidden">
        {tab === "chat" ? <AmeliaChat /> : <AmeliaMemoryPanel />}
      </div>
    </div>
  );
}
