"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingGuide } from "@/components/onboarding-guide";
import { AudioControls } from "@/components/audio/audio-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoomSettingsForm } from "@/components/lobby/room-settings-form";
import { ensureSession, getRememberedNickname, rememberNickname } from "@/lib/auth/session";
import { DEFAULT_RULE_CONFIG, type RuleConfig } from "@/lib/game-engine/rules";
import { nicknameSchema, roomCodeSchema } from "@/lib/validation/room";

export default function Home() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [settings, setSettings] = useState<RuleConfig>(DEFAULT_RULE_CONFIG);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Deliberate: localStorage isn't available during SSR, so the default
    // state above is what's server-rendered, and this effect hydrates the
    // real client-only value right after mount — the standard pattern for
    // this exact case (see https://react.dev/learn/you-might-not-need-an-effect
    // "Passing data to the parent" is the opposite case; this is
    // synchronizing from an external client-only store, which does belong
    // in an effect despite the lint rule's general cascading-render heuristic).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNickname(getRememberedNickname());
  }, []);

  function validatedNickname(): string | null {
    const result = nicknameSchema.safeParse(nickname);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Enter a nickname first.");
      return null;
    }
    return result.data;
  }

  async function handleCreate() {
    const validNickname = validatedNickname();
    if (!validNickname) return;
    setBusy(true);
    try {
      await ensureSession(validNickname);
      rememberNickname(validNickname);
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: validNickname, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to create the room.");
      router.push(`/room/${data.code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const validNickname = validatedNickname();
    if (!validNickname) return;
    const codeResult = roomCodeSchema.safeParse(joinCode);
    if (!codeResult.success) {
      toast.error(codeResult.error.issues[0]?.message ?? "Enter a valid room code.");
      return;
    }
    setBusy(true);
    try {
      await ensureSession(validNickname);
      rememberNickname(validNickname);
      const res = await fetch(`/api/rooms/${codeResult.data}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: validNickname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to join the room.");
      router.push(`/room/${data.code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-felt flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-cream font-heading text-6xl font-black tracking-tight drop-shadow-sm">
          Naija <span className="text-gold">Whot</span>
        </h1>
        <p className="text-cream/80 max-w-sm text-sm text-balance">
          Real-time Nigerian Whot with friends. No sign-up — just a nickname and a room code.
        </p>
      </div>

      <div className="border-gold/30 bg-cream w-full max-w-sm rounded-2xl border p-6 shadow-xl">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nickname" className="text-charcoal">
              Your nickname
            </Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Chidi"
              maxLength={20}
              autoComplete="off"
              autoFocus
            />
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Button size="lg" className="w-full" onClick={() => setCreateOpen(true)}>
              Create Game
            </Button>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Room settings</DialogTitle>
                <DialogDescription>
                  Configure the house rules. You can change these any time before starting.
                </DialogDescription>
              </DialogHeader>
              <RoomSettingsForm value={settings} onChange={setSettings} disabled={busy} />
              <DialogFooter>
                <Button onClick={handleCreate} disabled={busy} className="w-full">
                  {busy ? "Creating…" : "Create Room"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => setJoinOpen(true)}
            >
              Join Game
            </Button>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Join a room</DialogTitle>
                <DialogDescription>
                  Enter the 6-character room code your friend shared.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="joinCode">Room code</Label>
                <Input
                  id="joinCode"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABCDEF"
                  maxLength={6}
                  autoComplete="off"
                  className="text-center font-mono text-lg tracking-[0.3em] uppercase"
                />
              </div>
              <DialogFooter>
                <Button onClick={handleJoin} disabled={busy} className="w-full">
                  {busy ? "Joining…" : "Join Room"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <OnboardingGuide />

      <section className="text-cream/90 w-full max-w-sm text-sm">
        <h2 className="text-gold mb-2 font-semibold">How to play</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Match the shape or number of the top card, or play a Whot.</li>
          <li>Special cards trigger effects — Hold On, Pick Two, Suspension, and more.</li>
          <li>Declare &quot;Last Card&quot; when a play leaves one card.</li>
          <li>Empty your hand first with a valid play to win the round.</li>
        </ol>
      </section>

      <div className="flex items-center gap-4">
        <a
          href="/rules"
          className="text-cream/70 hover:text-gold text-xs underline underline-offset-2"
        >
          Full rules
        </a>
      </div>

      <AudioControls mode="lobby" />
    </main>
  );
}
