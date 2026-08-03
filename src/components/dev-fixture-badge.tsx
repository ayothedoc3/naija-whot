import { isDevFixturesEnabled } from "@/lib/env/client";

/** Spec requirement: dev fixture mode must be "clearly marked in the UI"
 *  whenever it's reachable. Never renders in production — isDevFixturesEnabled
 *  is hard-gated on NODE_ENV, not just the public env flag. */
export function DevFixtureBadge() {
  if (!isDevFixturesEnabled) return null;

  return (
    <div
      role="note"
      className="fixed bottom-2 left-2 z-[100] rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-lg"
    >
      DEV FIXTURES ON
    </div>
  );
}
