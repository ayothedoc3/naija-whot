import { Asterisk, Circle, Plus, Square, Star, Triangle, type LucideIcon } from "lucide-react";
import type { Shape } from "@/lib/game-engine/cards";

/**
 * Original, non-copied card design: every shape is identified by an icon
 * AND a color AND text — never color alone, so the game stays usable for
 * colorblind players (see docs on accessibility in TASKS.md Phase 8).
 */
export const SHAPE_ICONS: Record<Shape, LucideIcon> = {
  Circle: Circle,
  Triangle: Triangle,
  Cross: Plus,
  Square: Square,
  Star: Star,
  Whot: Asterisk,
};

export const SHAPE_COLORS: Record<Shape, string> = {
  Circle: "#2563eb",
  Triangle: "#16a34a",
  Cross: "#dc2626",
  Square: "#7c3aed",
  Star: "#c6941f",
  Whot: "#262a24",
};

export const SHAPE_LABELS: Record<Shape, string> = {
  Circle: "Circle",
  Triangle: "Triangle",
  Cross: "Cross",
  Square: "Square",
  Star: "Star",
  Whot: "Whot",
};
