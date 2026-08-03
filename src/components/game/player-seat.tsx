import { Bookmark, Crown, ShieldCheck, Wifi, WifiOff } from "lucide-react";
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
  checkUpDeclared,
  forfeited,
}: {
  displayName: string;
  handCount: number;
  isCurrentTurn: boolean;
  online: boolean;
  isSelf: boolean;
  lastCardDeclared: boolean;
  checkUpDeclared: boolean;
  forfeited: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors",
        isCurrentTurn && "bg-gold/20 ring-gold ring-2",
        forfeited && "opacity-40",
      )}
      aria-current={isCurrentTurn ? "true" : undefined}
    >
      <div className="flex items-center gap-1">
        {online ? (
          <Wifi className="size-3 text-green-500" aria-label="Online" />
        ) : (
          <WifiOff className="text-cream/50 size-3" aria-label="Disconnected" />
        )}
        <span className="text-cream text-sm font-semibold">
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
      <span className="text-cream/70 text-xs">{handCount} cards</span>
      <div className="flex gap-1">
        {lastCardDeclared && (
          <Badge variant="secondary" className="gap-0.5 text-[10px]">
            <Bookmark className="size-2.5" /> Last Card
          </Badge>
        )}
        {checkUpDeclared && (
          <Badge variant="secondary" className="gap-0.5 text-[10px]">
            <ShieldCheck className="size-2.5" /> Check Up
          </Badge>
        )}
      </div>
    </div>
  );
}
