"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function RouteProgressContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = `${pathname}?${searchParams.toString()}`;
  const [navigation, setNavigation] = useState<{ from: string; progress: number } | null>(null);
  const completed = navigation !== null && navigation.from !== route;
  const progress = completed ? 100 : navigation?.progress ?? 0;

  useEffect(() => {
    if (!completed) return;
    const timer = setTimeout(() => setNavigation(null), 250);
    return () => clearTimeout(timer);
  }, [completed, route]);

  // Intercept click on internal links to give immediate feedback
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      const isTargetBlank = target.getAttribute("target") === "_blank";
      const isDownload = target.hasAttribute("download");

      if (
        href &&
        href.startsWith("/") &&
        !isTargetBlank &&
        !isDownload &&
        !href.startsWith("#") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const currentUrl = window.location.pathname + window.location.search;
        if (href !== currentUrl) {
          timers.forEach(clearTimeout);
          const from = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
          setNavigation({ from, progress: 25 });
          for (const [delay, value] of [[100, 65], [300, 85]]) {
            timers.push(setTimeout(() => setNavigation(current => current?.from === from ? { ...current, progress: value } : current), delay));
          }
        }
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!navigation) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[3px] bg-transparent overflow-hidden"
      role="progressbar"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(59,130,246,0.6)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? "width 150ms ease-out, opacity 250ms ease-in" : "width 300ms ease-out",
        }}
      />
    </div>
  );
}

export default function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <RouteProgressContent />
    </Suspense>
  );
}
