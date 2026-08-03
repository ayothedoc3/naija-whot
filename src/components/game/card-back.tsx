import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-16 w-11",
  md: "h-24 w-16",
  lg: "h-32 w-22",
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
        "border-gold/60 bg-felt-dark relative shrink-0 rounded-lg border-2 shadow-sm",
        className,
      )}
      aria-hidden
    >
      <div className="border-gold/40 absolute inset-1 rounded-md border" />
      <div className="text-gold/70 absolute inset-0 flex items-center justify-center text-[9px] font-black tracking-widest">
        NW
      </div>
    </div>
  );
}
