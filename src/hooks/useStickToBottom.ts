"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Distance from the bottom (px) still treated as "at the bottom". */
const BOTTOM_THRESHOLD = 48;

/**
 * Keeps a scroll container pinned to the bottom as content grows — the behaviour
 * you get in Claude, where the transcript slides up while a reply types itself.
 *
 * The pin is released the moment the user scrolls up to re-read something, and
 * re-engaged when they scroll back down. Without that, growing content would
 * yank the view away mid-read.
 *
 * @param dep change this (e.g. streamed text length) to trigger a follow.
 */
export function useStickToBottom<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T | null>(null);
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = ref.current;
    if (!el) return;
    pinnedRef.current = true;
    setShowJump(false);
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Track whether the user has scrolled away from the bottom.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distance <= BOTTOM_THRESHOLD;
      pinnedRef.current = atBottom;
      // Only offer the jump button once there's a meaningful amount to skip.
      setShowJump(!atBottom && distance > BOTTOM_THRESHOLD * 3);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Follow new content. useLayoutEffect so the scroll lands in the same frame the
  // content painted — otherwise streaming text visibly jitters.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [dep]);

  return { ref, showJump, scrollToBottom };
}
