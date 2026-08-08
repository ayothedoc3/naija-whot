"use client";

import { cn } from "@/lib/utils";
import type { Card as WhotCard } from "@/lib/game-engine/cards";
import { SHAPE_COLORS, SHAPE_ICONS, SHAPE_LABELS } from "./card-visuals";

const SIZE_CLASSES = {
  sm: "h-16 w-11 text-[10px]",
  md: "h-24 w-16 text-xs",
  lg: "h-34 w-24 text-sm",
} as const;

export interface CardFaceProps {
  card: WhotCard;
  size?: keyof typeof SIZE_CLASSES;
  playable?: boolean;
  selected?: boolean;
  selectionOrder?: number;
  onClick?: () => void;
  onFocus?: () => void;
  title?: string;
  className?: string;
  "data-testid"?: string;
}

export function CardFace({
  card,
  size = "md",
  playable,
  selected,
  selectionOrder,
  onClick,
  onFocus,
  title,
  className,
  "data-testid": testId,
}: CardFaceProps) {
  const Icon = SHAPE_ICONS[card.shape];
  const color = SHAPE_COLORS[card.shape];
  const isWhot = card.shape === "Whot";
  const interactive = Boolean(onClick);

  return (
    <button
      type="button"
      data-testid={testId}
      data-card-id={card.id}
      title={title}
      onClick={onClick}
      onFocus={onFocus}
      disabled={!interactive}
      aria-label={`${SHAPE_LABELS[card.shape]} ${card.displayValue}${playable === false ? ", not playable" : ""}`}
      aria-pressed={selected}
      className={cn(
        SIZE_CLASSES[size],
        "relative flex shrink-0 flex-col justify-between overflow-hidden rounded-[0.55rem] border bg-[#fffdf7] p-1.5 shadow-[0_8px_16px_rgba(32,18,9,0.24),inset_0_0_0_1px_rgba(255,255,255,0.9)] transition-all select-none focus-visible:z-20",
        "before:pointer-events-none before:absolute before:inset-1 before:rounded-[0.38rem] before:border before:border-[#d9c9a6]/80",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_50%_42%,rgba(198,148,31,0.09),transparent_48%)]",
        interactive && "cursor-pointer",
        playable === false && "opacity-45 saturate-50",
        selected &&
          "z-10 -translate-y-2 shadow-[0_14px_24px_rgba(32,18,9,0.36)] ring-2 ring-offset-2 ring-offset-[#3a2013]",
        !interactive && "cursor-default",
        className,
      )}
      style={{
        borderColor: isWhot ? "#b98524" : "#6f1d2b",
        ...(selected ? ({ "--tw-ring-color": color } as React.CSSProperties) : {}),
      }}
    >
      <span
        className="relative z-10 flex w-min flex-col items-center font-serif leading-none font-black"
        style={{ color }}
      >
        <span>{card.displayValue}</span>
        <Icon className="mt-0.5 size-3" aria-hidden />
      </span>
      {selectionOrder !== undefined && (
        <span
          data-testid="selection-order-badge"
          className="bg-gold text-charcoal absolute -top-2 -right-2 z-20 grid size-5 place-items-center rounded-full border border-[#fff3c4] text-[10px] font-black shadow"
          aria-hidden
        >
          {selectionOrder}
        </span>
      )}
      <span className="relative z-10 flex flex-1 items-center justify-center">
        <span className="grid aspect-square w-[66%] place-items-center rounded-full border border-[#d8c6a3]/60 bg-[#fbf1d8]/55 shadow-inner">
          <Icon
            className="size-[78%] drop-shadow-[0_1px_0_rgba(255,255,255,0.75)]"
            style={{ color }}
            aria-hidden
          />
        </span>
      </span>
      <span
        className="relative z-10 flex w-min rotate-180 flex-col items-center self-end font-serif leading-none font-black"
        style={{ color }}
      >
        <span>{card.displayValue}</span>
        <Icon className="mt-0.5 size-3" aria-hidden />
      </span>
    </button>
  );
}
