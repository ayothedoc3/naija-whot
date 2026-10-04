import { Bookmark, Crown, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CardBack } from "./card-back";

export function PlayerSeat({
  displayName,
  handCount,
  isCurrentTurn,
  online,
  isSelf,
  lastCardDeclared,
  forfeited,
}: {
  displayName: string;
  handCount: number;
  isCurrentTurn: boolean;
  online: boolean;
  isSelf: boolean;
  lastCardDeclared: boolean;
  forfeited: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-28 flex-col items-center gap-1.5 rounded-full border border-[#caa15b]/25 bg-[#24130d]/55 px-4 py-2 shadow-[0_8px_18px_rgba(18,9,4,0.28)] backdrop-blur-[2px] transition-colors",
        isCurrentTurn && "border-[#efcf83] bg-[#4a2615]/75 ring-2 ring-[#efcf83]/80",
        forfeited && "opacity-40",
      )}
      aria-current={isCurrentTurn ? "true" : undefined}
    >
      <div className="flex max-w-40 items-center gap-1.5">
        {online ? (
          <Wifi className="size-3 text-emerald-300" aria-label="Online" />
        ) : (
          <WifiOff className="text-cream/50 size-3" aria-label="Disconnected" />
        )}
        <span className="text-cream truncate text-sm font-bold">
          {displayName}
          {isSelf && " (You)"}
        </span>
        {isCurrentTurn && <Crown className="text-gold size-3.5" aria-label="Current turn" />}
      </div>
      <div className="relative flex">
        {Array.from({ length: Math.min(handCount, 5) }).map((_, i) => (
          <CardBack key={i} size="sm" className={cn(i > 0 && "-ml-6")} />
        ))}
      </div>
      <span className="rounded-full border border-[#e1be73]/35 bg-[#f5dfaa]/15 px-2 py-0.5 text-xs font-bold text-[#f8e7bc]">
        {handCount} cards
      </span>
      <div className="flex gap-1">
        {lastCardDeclared && (
          <Badge variant="secondary" className="gap-0.5 bg-[#f6dfaa] text-[10px] text-[#31170f]">
            <Bookmark className="size-2.5" /> Last Card
          </Badge>
        )}
      </div>
    </div>
  );
}
