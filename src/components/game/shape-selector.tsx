"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { REQUESTABLE_SHAPES, type RequestableShape } from "@/lib/game-engine/cards";
import { SHAPE_COLORS, SHAPE_ICONS, SHAPE_LABELS } from "./card-visuals";

export function ShapeSelector({
  open,
  onSelect,
}: {
  open: boolean;
  onSelect: (shape: RequestableShape) => void;
}) {
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Choose a shape</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          {REQUESTABLE_SHAPES.map((shape) => {
            const Icon = SHAPE_ICONS[shape];
            const color = SHAPE_COLORS[shape];
            return (
              <button
                key={shape}
                type="button"
                onClick={() => onSelect(shape)}
                className="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-transform hover:scale-105"
                style={{ borderColor: color }}
              >
                <Icon className="size-8" style={{ color }} />
                <span className="text-sm font-semibold" style={{ color }}>
                  {SHAPE_LABELS[shape]}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
