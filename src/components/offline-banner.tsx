"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Global "you're offline" indicator. Deliberately does nothing beyond
 * informing the player — no queued actions, no optimistic moves while
 * offline. A move that might be illegal by the time connectivity returns
 * must never be silently queued (see docs/ARCHITECTURE.md).
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // navigator.onLine isn't available during SSR; default state above is
    // what's server-rendered, corrected here right after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-600 px-3 py-2 text-center text-sm font-medium text-white"
    >
      <WifiOff className="size-4" aria-hidden />
      You&rsquo;re offline — reconnecting will resume automatically once your connection returns.
    </div>
  );
}
