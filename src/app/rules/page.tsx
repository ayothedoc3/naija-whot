import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LogIn, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CardFace } from "@/components/game/card-face";
import { SHAPE_ICONS, SHAPE_LABELS } from "@/components/game/card-visuals";
import { DEFAULT_RULE_CONFIG } from "@/lib/game-engine/rules";
import {
  HOUSE_RULE_OPTIONS,
  PLAYABLE_SHAPES,
  RULES_PAGE_METADATA,
  SAMPLE_CARDS,
  SPECIAL_CARD_RULES,
  WHOT_REQUESTABLE_SHAPES,
  describeSettingValue,
} from "@/lib/game-engine/rules-description";
import type { Shape } from "@/lib/game-engine/cards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = RULES_PAGE_METADATA;

export default function RulesPage() {
  return (
    <main className="bg-cream text-charcoal min-h-screen">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-10">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }))}>
            <ArrowLeft className="size-4" /> Back to Home
          </Link>
          <div className="flex gap-2">
            <Link href="/" className={cn(buttonVariants())}>
              <Plus className="size-4" /> Create Game
            </Link>
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
              <LogIn className="size-4" /> Join Game
            </Link>
          </div>
        </nav>

        <header className="grid gap-3">
          <p className="text-gold text-sm font-semibold tracking-wide uppercase">Naija Whot</p>
          <h1 className="font-heading text-4xl font-black sm:text-5xl">How to Play Naija Whot</h1>
          <p className="text-muted-foreground max-w-2xl text-base">
            Match the top card by shape or number, use special cards wisely, and declare Last Card
            at the right time.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <RulesSection title="Basic Objective">
            <ul className="grid gap-2 text-sm leading-6">
              <li>Match the top card by shape or number.</li>
              <li>A Whot card can be played on any normal card.</li>
              <li>The first player to legally finish their hand wins the round.</li>
              <li>Some rules can be changed by the room host before the game starts.</li>
            </ul>
          </RulesSection>

          <RulesSection title="Deck and Shapes">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PLAYABLE_SHAPES.map((shape) => (
                <ShapeTile key={shape} shape={shape} />
              ))}
            </div>
          </RulesSection>
        </section>

        <RulesSection title="Normal Turn">
          <ol className="grid gap-2 pl-5 text-sm leading-6">
            <li>Play a card that matches the active shape or the top card number.</li>
            <li>Alternatively, play a Whot card and choose a shape.</li>
            <li>Draw when you cannot, or do not want to, play.</li>
            <li>After drawing, the turn passes to the next player.</li>
          </ol>
        </RulesSection>

        <RulesSection title="Special Cards">
          <div className="grid gap-3 md:grid-cols-2">
            {SPECIAL_CARD_RULES.map((rule) => (
              <article key={rule.number} className="rounded-lg border bg-white/60 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {rule.number} - {rule.name}
                  </h3>
                  <Badge variant={rule.settingKey ? "secondary" : "outline"}>
                    {rule.settingKey ? "Configurable" : "Always available"}
                  </Badge>
                </div>
                <p className="text-sm leading-6">{rule.summary}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">{rule.twoPlayer}</p>
              </article>
            ))}
          </div>
        </RulesSection>

        <section className="grid gap-4 md:grid-cols-2">
          <RulesSection title="Penalty Stacking">
            <ul className="grid gap-2 text-sm leading-6">
              <li>Pick Two can be defended only with another 2.</li>
              <li>Pick Three can be defended only with another 5.</li>
              <li>Pick Two and Pick Three cannot be mixed.</li>
              <li>The penalty accumulates until a player draws it.</li>
              <li>
                Pick Two and Pick Three always apply their initial penalty. Stacking controls
                whether the affected player may defend instead of drawing.
              </li>
            </ul>
          </RulesSection>

          <RulesSection title="Multi-Card Play">
            <ul className="grid gap-2 text-sm leading-6">
              <li>When enabled, one turn may include multiple cards with the same number.</li>
              <li>The first card must be legal against the current table state.</li>
              <li>
                The final selected card becomes the top discard and determines the active shape.
              </li>
              <li>Pick Two/Pick Three totals add once per card in the batch.</li>
              <li>Hold On, Suspension, and General Market resolve once for the batch.</li>
            </ul>
          </RulesSection>

          <RulesSection title="Declarations">
            <div className="grid gap-3 text-sm leading-6">
              <p>
                Last Card must be activated before playing from 2 cards down to exactly 1 card.
                Missing it draws 2 cards immediately.
              </p>
              <p>A valid play that empties your hand wins the round automatically.</p>
            </div>
          </RulesSection>
        </section>

        <RulesSection title="Whot Shape Selection">
          <div className="grid gap-3 text-sm leading-6">
            <p>
              Whot can be played on a normal card. After playing Whot, choose one requested shape:
              Circle, Triangle, Cross, Square, or Star.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WHOT_REQUESTABLE_SHAPES.map((shape) => (
                <Badge key={shape} variant="secondary">
                  {shape}
                </Badge>
              ))}
            </div>
            <p>Whot cannot be selected as the requested shape.</p>
          </div>
        </RulesSection>

        <RulesSection title="House Rules">
          <div className="grid gap-3 md:grid-cols-2">
            {HOUSE_RULE_OPTIONS.map((option) => (
              <article key={option.key} className="rounded-lg border bg-white/60 p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{option.label}</h3>
                  <Badge variant="outline">
                    Default: {describeSettingValue(DEFAULT_RULE_CONFIG, option.key)}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm leading-6">{option.description}</p>
              </article>
            ))}
          </div>
        </RulesSection>

        <RulesSection title="Quick Example">
          <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ExampleCard label="Top card" card={SAMPLE_CARDS.topCard} />
              <ExampleCard label="Legal shape" card={SAMPLE_CARDS.matchingShape} />
              <ExampleCard label="Legal number" card={SAMPLE_CARDS.matchingNumber} />
              <ExampleCard label="Illegal" card={SAMPLE_CARDS.illegal} muted />
              <ExampleCard label="Whot option" card={SAMPLE_CARDS.whot} />
            </div>
            <p className="text-muted-foreground self-center text-sm leading-6">
              If the top card is Circle 7, Circle 3 is legal by shape and Star 7 is legal by number.
              Triangle 12 is illegal because it matches neither. Whot is legal and then asks you to
              choose the next active shape.
            </p>
          </div>
        </RulesSection>
      </div>
    </main>
  );
}

function RulesSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white/70 p-4 shadow-sm sm:p-5">
      <h2 className="font-heading mb-3 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function ShapeTile({ shape }: { shape: Shape }) {
  const Icon = SHAPE_ICONS[shape];
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-white/70 p-3">
      <Icon className="text-gold size-5" aria-hidden />
      <span className="text-sm font-medium">{SHAPE_LABELS[shape]}</span>
    </div>
  );
}

function ExampleCard({
  label,
  card,
  muted,
}: {
  label: string;
  card: Parameters<typeof CardFace>[0]["card"];
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <CardFace card={card} size="sm" playable={!muted} />
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
