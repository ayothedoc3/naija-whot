"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ONBOARDING_STEPS } from "@/lib/game-engine/rules-description";

const STORAGE_KEY = "naija-whot:onboarding-dismissed";

export function OnboardingGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // localStorage is client-only, so hydrate visibility after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== "true");
  }, []);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section className="border-gold/30 bg-cream/95 text-charcoal w-full max-w-sm rounded-lg border p-4 shadow-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold">First game?</h2>
        <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Dismiss guide">
          <X className="size-4" />
        </Button>
      </div>
      <ol className="grid list-decimal gap-1 pl-5 text-sm leading-5">
        {ONBOARDING_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
