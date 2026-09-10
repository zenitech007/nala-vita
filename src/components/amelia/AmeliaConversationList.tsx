"use client";

import { useEffect, useState } from "react";
import { MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConversationSummaryUI {
  id: string;
  title: string;
  updatedAt: string;
}

interface Props {
  conversations: ConversationSummaryUI[];
  activeId?: string;
  loading?: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  /** Renders the expand/collapse rail instead of the fixed-width inline list. */
  collapsible?: boolean;
  /**
   * Floats the rail over the transcript instead of sitting beside it. Needed in
   * the chat bubble, where 280px in flow would leave ~100px for messages.
   */
  overlay?: boolean;
}

export const EXPANDED_W = 280;
export const COLLAPSED_W = 68;
// Overlaying the transcript means a 68px strip would cover the left edge of
// every message, so the floating rail collapses away entirely instead.
const OVERLAY_COLLAPSED_W = 0;

// The bubble and the full page each remember their own state — they are very
// different amounts of room, so one preference shouldn't dictate both.
const storageKeyFor = (overlay: boolean) =>
  overlay ? "amelia-history-collapsed-bubble" : "amelia-history-collapsed";

export default function AmeliaConversationList({
  conversations,
  activeId,
  loading = false,
  onSelect,
  onNew,
  onDelete,
  collapsible = false,
  overlay = false,
}: Props) {
  // Floating only makes sense for the rail, so `overlay` implies it.
  const isRail = collapsible || overlay;

  // Closed by default; the stored preference is applied after mount so the
  // server and first client render agree.
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (!isRail) return;
    const stored = localStorage.getItem(storageKeyFor(overlay));
    if (stored !== null) setIsCollapsed(stored === "true");
  }, [isRail, overlay]);

  const toggleCollapse = () =>
    setIsCollapsed((v) => {
      const next = !v;
      localStorage.setItem(storageKeyFor(overlay), String(next));
      return next;
    });

  // Only the rail variant ever hides its labels.
  const collapsed = isRail && isCollapsed;

  const items = (
    <nav
      aria-label="Past conversations"
      className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 space-y-0.5"
    >
      {loading && !collapsed && <p className="px-2 py-2 text-xs text-gray-400">Loading…</p>}

      {!loading && !collapsed && conversations.length === 0 && (
        <p className="px-2 py-2 text-xs text-gray-400">No past conversations yet.</p>
      )}

      {conversations.map((c) => {
        const isActive = c.id === activeId;
        return (
          <div
            key={c.id}
            className={cn(
              "group flex items-center gap-1 rounded-lg transition",
              isActive ? "bg-white shadow-sm" : "hover:bg-white/70"
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={isActive ? "true" : undefined}
              title={collapsed ? c.title : undefined}
              className={cn(
                "flex-1 flex items-center min-w-0 py-2 text-left",
                collapsed ? "justify-center px-0" : "gap-2 px-2"
              )}
            >
              <MessageSquare
                size={14}
                className={cn("shrink-0", isActive ? "text-[var(--primary)]" : "text-gray-400")}
              />
              {!collapsed && (
                <span
                  className={cn(
                    "truncate text-xs",
                    isActive ? "text-gray-900 font-medium" : "text-gray-600"
                  )}
                  title={c.title}
                >
                  {c.title}
                </span>
              )}
            </button>
            {!collapsed && (
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                aria-label={`Delete conversation: ${c.title}`}
                className="p-1.5 mr-1 rounded-md text-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 hover:bg-red-50 transition"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );

  if (!isRail) {
    return (
      <aside className="flex flex-col h-full w-56 shrink-0 border-r border-gray-100 bg-gray-50/60">
        <div className="p-2">
          <button
            type="button"
            onClick={onNew}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-white bg-[var(--primary)] hover:opacity-90 transition"
          >
            <Plus size={16} />
            New chat
          </button>
        </div>
        {items}
      </aside>
    );
  }

  // Fully retracted floating rails must not leave a border or trap focus.
  const hidden = overlay && collapsed;
  const width = collapsed ? (overlay ? OVERLAY_COLLAPSED_W : COLLAPSED_W) : EXPANDED_W;

  const rail = (
    <aside
      style={{ width }}
      aria-hidden={hidden || undefined}
      className={cn(
        "flex flex-col h-full shrink-0 overflow-hidden",
        "transition-[width] duration-300 ease-in-out",
        !hidden && "border-r border-gray-100",
        // Expanded-over-transcript needs an opaque backdrop and a lift; in flow
        // the translucent tint is enough.
        overlay ? "absolute inset-y-0 left-0 z-20 bg-gray-50" : "bg-gray-50/60",
        overlay && !collapsed && "shadow-xl"
      )}
    >
      {/* Skipped while retracted so the clipped controls stay out of tab order. */}
      {!hidden && (
        <>
          <div className={cn("flex items-center gap-1 p-2 shrink-0", collapsed && "flex-col")}>
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label={collapsed ? "Expand chat history" : "Collapse chat history"}
              aria-expanded={!collapsed}
              className="p-2 shrink-0 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-200/70 transition"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>

            <button
              type="button"
              onClick={onNew}
              title={collapsed ? "New chat" : undefined}
              className={cn(
                "flex items-center justify-center rounded-lg text-white bg-[var(--primary)] hover:opacity-90 transition",
                collapsed ? "p-2" : "flex-1 gap-2 px-3 py-2 text-sm font-medium"
              )}
            >
              <Plus size={16} className="shrink-0" />
              {!collapsed && "New chat"}
            </button>
          </div>

          {items}
        </>
      )}
    </aside>
  );

  if (!overlay) return rail;

  return (
    <>
      {/* The rail's own toggle is gone once retracted, so reopening lives here. */}
      {hidden && (
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label="Expand chat history"
          aria-expanded={false}
          className="absolute top-2 left-2 z-20 p-1.5 rounded-lg bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-500 shadow-sm hover:text-gray-900 hover:bg-white transition"
        >
          <PanelLeftOpen size={16} />
        </button>
      )}
      {!collapsed && (
        <button
          type="button"
          aria-label="Close chat history"
          onClick={toggleCollapse}
          className="absolute inset-0 z-10 bg-black/20 cursor-default"
        />
      )}
      {rail}
    </>
  );
}
