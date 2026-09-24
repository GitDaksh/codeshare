import type { ComponentType } from "react";
import { Reveal } from "@/components/landing/Reveal";
import { SpotlightCard } from "@/components/landing/SpotlightCard";
import {
  ChatVisual,
  PaletteVisual,
  PresenceVisual,
  RunVisual,
  ShareVisual,
  SyncVisual,
} from "@/components/landing/FeatureVisuals";

const FEATURES: { title: string; description: string; visual: ComponentType; span: string }[] = [
  {
    title: "Real-time editing",
    description: "Every keystroke lands on everyone's screen as you type, and your own cursor stays exactly where you left it.",
    visual: SyncVisual,
    span: "lg:col-span-4",
  },
  {
    title: "Live presence",
    description: "See who's in the room, and exactly where each person is working in the file.",
    visual: PresenceVisual,
    span: "lg:col-span-2",
  },
  {
    title: "Built-in chat",
    description: "Talk it through without leaving the editor, with reactions, inline code, and typing indicators.",
    visual: ChatVisual,
    span: "lg:col-span-2",
  },
  {
    title: "Run it together",
    description: "Run JavaScript, TypeScript, or Python right in the browser. The output is shared with the whole room.",
    visual: RunVisual,
    span: "lg:col-span-4",
  },
  {
    title: "Keyboard-first",
    description: "⌘K for every action, ⌘↵ to run. Your hands never leave the keys.",
    visual: PaletteVisual,
    span: "lg:col-span-3",
  },
  {
    title: "One link to join",
    description: "Send a link. They sign in, and they're in the room. No installs, no setup.",
    visual: ShareVisual,
    span: "lg:col-span-3",
  },
];

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-ink-500">
            Features
          </p>
          <h2 className="text-gradient mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
            Everything a pairing session needs.
          </h2>
          <p className="mt-4 text-ink-400">One room for your code, your team, and the conversation around it.</p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map((feature, i) => {
            const Visual = feature.visual;
            return (
              <Reveal key={feature.title} delay={(i % 3) * 0.08} className={feature.span}>
                <SpotlightCard className="h-full">
                  <div className="flex h-full flex-col">
                    <div className="relative h-44 overflow-hidden border-b border-ink-900 sm:h-48">
                      <div className="dot-grid absolute inset-0" />
                      <Visual />
                    </div>
                    <div className="p-5 sm:p-6">
                      <h3 className="font-medium text-ink-100">{feature.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{feature.description}</p>
                    </div>
                  </div>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}