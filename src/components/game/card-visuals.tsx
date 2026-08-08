import type { JSX, SVGProps } from "react";
import type { Shape } from "@/lib/game-engine/cards";

type ShapeIconProps = SVGProps<SVGSVGElement>;
type ShapeIcon = (props: ShapeIconProps) => JSX.Element;

function CircleMark(props: ShapeIconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" {...props}>
      <circle cx="32" cy="32" r="20" fill="currentColor" fillOpacity="0.14" />
      <circle cx="32" cy="32" r="20" />
    </svg>
  );
}

function TriangleMark(props: ShapeIconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" {...props}>
      <path d="M32 10 55 52H9L32 10Z" fill="currentColor" fillOpacity="0.14" />
      <path d="M32 10 55 52H9L32 10Z" />
    </svg>
  );
}

function CrossMark(props: ShapeIconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" {...props}>
      <path
        d="M25 8h14v17h17v14H39v17H25V39H8V25h17V8Z"
        fill="currentColor"
        fillOpacity="0.14"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SquareMark(props: ShapeIconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" {...props}>
      <rect x="13" y="13" width="38" height="38" fill="currentColor" fillOpacity="0.14" />
      <rect x="13" y="13" width="38" height="38" />
    </svg>
  );
}

function StarMark(props: ShapeIconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" {...props}>
      <path
        d="m32 7 7 16 17 2-13 11 4 17-15-9-15 9 4-17L8 25l17-2 7-16Z"
        fill="currentColor"
        fillOpacity="0.16"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhotMark(props: ShapeIconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" {...props}>
      <path
        d="M32 7c6 8 11 13 22 14-7 5-10 11-8 22-8-4-16-3-23 6 0-9-3-15-13-20 10-2 17-9 22-22Z"
        fill="currentColor"
        fillOpacity="0.15"
        strokeLinejoin="round"
      />
      <path d="M32 20v18" strokeLinecap="round" />
      <path d="M32 48h.01" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Original, non-copied card design: every shape is identified by an icon
 * AND a color AND text — never color alone, so the game stays usable for
 * colorblind players (see docs on accessibility in TASKS.md Phase 8).
 */
export const SHAPE_ICONS: Record<Shape, ShapeIcon> = {
  Circle: CircleMark,
  Triangle: TriangleMark,
  Cross: CrossMark,
  Square: SquareMark,
  Star: StarMark,
  Whot: WhotMark,
};

export const SHAPE_COLORS: Record<Shape, string> = {
  Circle: "#6f1d2b",
  Triangle: "#7a2e24",
  Cross: "#5a241f",
  Square: "#6a3426",
  Star: "#8a5b18",
  Whot: "#3d2418",
};

export const SHAPE_LABELS: Record<Shape, string> = {
  Circle: "Circle",
  Triangle: "Triangle",
  Cross: "Cross",
  Square: "Square",
  Star: "Star",
  Whot: "Whot",
};
