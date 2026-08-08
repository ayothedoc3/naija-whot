import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-16 w-11",
  md: "h-24 w-16",
  lg: "h-34 w-24",
} as const;

export function CardBack({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  return (
    <div
      className={cn(
        SIZE_CLASSES[size],
        "relative shrink-0 overflow-hidden rounded-[0.55rem] border-2 border-[#d5ad57] bg-[#641b2b] shadow-[0_8px_16px_rgba(32,18,9,0.32),inset_0_0_0_1px_rgba(255,255,255,0.15)]",
        "before:absolute before:inset-1 before:rounded-[0.38rem] before:border before:border-[#f0d695]/70",
        "after:absolute after:inset-2 after:rounded-[0.28rem] after:border after:border-[#8a2f3d]",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,226,156,0.22),transparent_18%),radial-gradient(circle_at_70%_75%,rgba(255,226,156,0.16),transparent_20%),repeating-linear-gradient(135deg,rgba(255,222,150,0.14)_0_1px,transparent_1px_8px)]" />
      <div className="absolute inset-[18%] rounded-full border border-[#e5c16b]/70 bg-[#4b1422]/70 shadow-inner" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-[9px] font-black tracking-[0.18em] text-[#f2d991] drop-shadow-sm">
          NW
        </span>
      </div>
    </div>
  );
}
