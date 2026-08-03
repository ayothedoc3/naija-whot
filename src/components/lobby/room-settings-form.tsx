"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_RULE_CONFIG, type RuleConfig } from "@/lib/game-engine/rules";
import { HOUSE_RULE_OPTIONS } from "@/lib/game-engine/rules-description";

export { DEFAULT_RULE_CONFIG };

interface RoomSettingsFormProps {
  value: RuleConfig;
  onChange: (next: RuleConfig) => void;
  disabled?: boolean;
}

const TOGGLE_KEYS: (keyof RuleConfig)[] = [
  "pickTwoStacking",
  "pickThreeStacking",
  "generalMarket",
  "holdOn",
  "suspension",
  "lastCardDeclaration",
  "checkUpDeclaration",
  "doubleDecking",
  "directionChangeOnPenalty",
];

const RULE_TOGGLES = HOUSE_RULE_OPTIONS.filter((rule) => TOGGLE_KEYS.includes(rule.key));

export function RoomSettingsForm({ value, onChange, disabled }: RoomSettingsFormProps) {
  function set<K extends keyof RuleConfig>(key: K, next: RuleConfig[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxPlayers">Max players</Label>
          <Select
            value={String(value.maxPlayers)}
            onValueChange={(v) => set("maxPlayers", Number(v))}
            disabled={disabled}
          >
            <SelectTrigger id="maxPlayers" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} players
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startingHandSize">Starting hand</Label>
          <Select
            value={String(value.startingHandSize)}
            onValueChange={(v) => set("startingHandSize", Number(v))}
            disabled={disabled}
          >
            <SelectTrigger id="startingHandSize" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} cards
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="turnTimer">Turn timer</Label>
          <Select
            value={String(value.turnTimerSeconds)}
            onValueChange={(v) => set("turnTimerSeconds", v === "null" ? null : (Number(v) as 10))}
            disabled={disabled}
          >
            <SelectTrigger id="turnTimer" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 60].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} seconds
                </SelectItem>
              ))}
              <SelectItem value="null">No timer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bestOf">Match length</Label>
          <Select
            value={String(value.bestOf)}
            onValueChange={(v) => set("bestOf", Number(v) as 1)}
            disabled={disabled}
          >
            <SelectTrigger id="bestOf" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Single round</SelectItem>
              <SelectItem value="3">Best of 3</SelectItem>
              <SelectItem value="5">Best of 5</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-muted-foreground text-sm font-medium">House rules</h3>
        {RULE_TOGGLES.map((rule) => (
          <div key={rule.key} className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <Label htmlFor={rule.key} className="font-normal">
                {rule.label}
              </Label>
              <span className="text-muted-foreground text-xs">{rule.description}</span>
            </div>
            <Switch
              id={rule.key}
              checked={Boolean(value[rule.key])}
              onCheckedChange={(checked) => set(rule.key, checked as never)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
