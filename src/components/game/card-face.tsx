"use client";

import { cn } from "@/lib/utils";
import type { Card as WhotCard } from "@/lib/game-engine/cards";
import { SHAPE_COLORS, SHAPE_ICONS, SHAPE_LABELS } from "./card-visuals";

const SIZE_CLASSES = {
  sm: "h-16 w-11 text-[10px]",
  md: "h-24 w-16 text-xs",
  lg: "h-32 w-22 text-sm",
} as const;

export interface CardFaceProps {
  card: WhotCard;
  size?: keyof typeof SIZE_CLASSES;
  playable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
  "data-testid"?: string;
}

export function CardFace({
  card,
  size = "md",
  playable,
  selected,
  onClick,
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
      disabled={!interactive}
      aria-label={`${SHAPE_LABELS[card.shape]} ${card.displayValue}${playable === false ? ", not playable" : ""}`}
      aria-pressed={selected}
      className={cn(
        SIZE_CLASSES[size],
        "relative flex shrink-0 flex-col justify-between rounded-lg border-2 bg-white p-1 shadow-sm transition-all select-none",
        interactive && "cursor-pointer",
        playable === false && "opacity-40 saturate-50",
        selected && "-translate-y-2 ring-2 ring-offset-1",
        !interactive && "cursor-default",
        className,
      )}
      style={{
        borderColor: isWhot ? "#c6941f" : color,
        ...(selected ? ({ "--tw-ring-color": color } as React.CSSProperties) : {}),
      }}
    >
      <span className="flex items-center gap-0.5 font-bold" style={{ color }}>
        <Icon className="size-3" aria-hidden />
        {card.displayValue}
      </span>
      <span className="flex flex-1 items-center justify-center">
        <Icon className="size-1/2" style={{ color }} aria-hidden />
      </span>
      <span className="flex items-center justify-end gap-0.5 self-end font-bold" style={{ color }}>
        {card.displayValue}
        <Icon className="size-3" aria-hidden />
      </span>
    </button>
  );
}
