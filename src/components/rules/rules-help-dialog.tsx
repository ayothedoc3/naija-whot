"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicGameState } from "@/lib/game-engine/public-state";
import type { RuleConfig } from "@/lib/game-engine/rules";
import {
  HOUSE_RULE_OPTIONS,
  SPECIAL_CARD_RULES,
  describeSettingValue,
} from "@/lib/game-engine/rules-description";
import { cn } from "@/lib/utils";

interface RulesHelpDialogProps {
  settings: RuleConfig;
  publicState?: PublicGameState | null;
  triggerClassName?: string;
}

export function RulesHelpDialog({ settings, publicState, triggerClassName }: RulesHelpDialogProps) {
  const [open, setOpen] = useState(false);
  const pending = publicState?.pendingPenalty;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="secondary"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="size-3.5" /> Rules
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rules in this room</DialogTitle>
          <DialogDescription>
            Current settings, special cards, and declaration reminders.
          </DialogDescription>
        </DialogHeader>

        {pending && (
          <section className="border-destructive/30 bg-destructive/10 rounded-lg border p-3">
            <h3 className="text-destructive text-sm font-semibold">Penalty pending</h3>
            <p className="text-sm">
              Draw {pending.amount}, or defend with another {pending.defendingNumber}. Pick Two and
              Pick Three cannot be mixed.
            </p>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Active settings</h3>
          <div className="flex flex-wrap gap-1.5">
            {HOUSE_RULE_OPTIONS.map((option) => (
              <Badge key={option.key} variant={settings[option.key] ? "default" : "outline"}>
                {option.label}: {describeSettingValue(settings, option.key)}
              </Badge>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Special cards</h3>
          <div className="grid gap-2">
            {SPECIAL_CARD_RULES.map((rule) => {
              const enabled = rule.settingKey === null || Boolean(settings[rule.settingKey]);
              return (
                <div key={rule.number} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {rule.number} - {rule.name}
                    </span>
                    <Badge variant={enabled ? "secondary" : "outline"}>
                      {enabled ? "On" : "Off"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{rule.summary}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-2 text-sm">
          <h3 className="font-semibold">Multi-card play</h3>
          <p>
            If enabled, selected cards must share one number. The final selected card becomes the
            top discard and sets the active shape.
          </p>
          <p>
            Pick Two/Pick Three add per card. Hold On, Suspension, and General Market apply once for
            the whole batch.
          </p>
        </section>

        <section className="grid gap-2 text-sm">
          <h3 className="font-semibold">Declarations</h3>
          <p>
            Last Card is needed before a play that leaves you with exactly 1 card. Missing it draws
            2 cards.
          </p>
          <p>
            Check Up is needed on the play that empties your hand. Missing it draws 2 cards and the
            round continues.
          </p>
        </section>

        <Link href="/rules" className={cn(buttonVariants({ variant: "outline" }))}>
          Full rules page
        </Link>
      </DialogContent>
    </Dialog>
  );
}
