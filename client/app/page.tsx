import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FinalCta } from "@/components/landing/FinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <main className="grain relative">
      <SmoothScroll />
      <Hero />
      <section className="border-y border-ink-900 py-8">
        <p className="mb-5 text-center font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-ink-600">
          Everything in one room
        </p>
        <Marquee />
      </section>
      <Features />
      <HowItWorks />
      <FinalCta />
      <LandingFooter />
    </main>
  );
}