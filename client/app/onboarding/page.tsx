"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Pencil, Sparkles } from "lucide-react";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { AvatarPicker } from "@/components/AvatarPicker";
import { UsernameInput } from "@/components/UsernameInput";
import { ProfilePreviewCard } from "@/components/ProfilePreviewCard";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import { LANGUAGES } from "@/lib/languages";
import type { Profile } from "@/types/profile";

const STEPS = ["Welcome", "Username", "Avatar", "About you", "Review"] as const;
const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

// Direction-aware slide: forward steps enter from the right, "Back" from the left.
const SLIDE = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 28, filter: "blur(4px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: (direction: number) => ({ opacity: 0, x: direction * -28, filter: "blur(4px)" }),
};

const WELCOME_ITEMS = [
  { title: "Pick a username", body: "How others see you in rooms and chat" },
  { title: "Choose an avatar", body: "Shows up next to your cursor and messages" },
  { title: "Say a bit about you", body: "All optional, and editable any time" },
];

const LANGUAGE_CHOICES: { value: string; label: string }[] = [
  { value: "", label: "No preference" },
  ...LANGUAGES.map((l) => ({ value: l.value, label: l.label })),
];

function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="text-gradient pb-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-ink-400">{subtitle}</p>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-ink-300">{label}</span>
        {hint && <span className="text-[11px] text-ink-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function OnboardingPage() {
  const api = useApi();
  const router = useRouter();
  const { toast } = useToast();
  const reduce = useReducedMotion();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [username, setUsername] = useState("");
  const [usernameValid, setUsernameValid] = useState(false);
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [bio, setBio] = useState("");
  const [favoriteLanguage, setFavoriteLanguage] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    document.title = "Set up your profile — CodeShare";
  }, []);

  useEffect(() => {
    api
      .get<Profile>("/api/profile")
      .then((res) => {
        if (res.data.username) {
          router.replace("/dashboard");
          return;
        }
        setAvatarId(res.data.avatarId);
      })
      .finally(() => setCheckingExisting(false));
  }, [api, router]);

  async function handleFinish() {
    setSubmitting(true);
    try {
      await api.put("/api/profile", {
        username,
        avatarId,
        bio: bio.trim(),
        favoriteLanguage,
        githubUsername: githubUsername.trim(),
      });
      toast(`Welcome, @${username}!`);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Could not save your profile.";
      toast(message, "error");
      setSubmitting(false);
    }
  }

  const canGoNext = step === 1 ? usernameValid : true;
  const isLastStep = step === STEPS.length - 1;

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  // The whole flow is one form, so pressing Enter moves forward (Enter inside
  // the bio textarea still inserts a new line, as textareas never submit).
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLastStep) {
      if (!submitting) handleFinish();
      return;
    }
    if (canGoNext) goTo(step + 1);
  }

  if (checkingExisting) {
    return (
      <main className="flex min-h-[calc(100dvh-56px)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-600" />
      </main>
    );
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div>
            <div className="relative h-24 w-24">
              <motion.div
                className="absolute -inset-3 rounded-full border border-dashed border-ink-700"
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              />
              <AvatarIcon avatarId={avatarId} className="h-24 w-24 rounded-full" />
            </div>
            <div className="mt-10">
              <StepHeader
                title="Welcome to CodeShare"
                subtitle="Let's set up your profile. It takes about a minute."
              />
            </div>
            <ul className="mt-8 space-y-2.5">
              {WELCOME_ITEMS.map((item, i) => (
                <motion.li
                  key={item.title}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.08, ease: EASE }}
                  className="flex items-start gap-3 rounded-xl border border-ink-800 bg-ink-950/60 p-3.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-900 font-[family-name:var(--font-mono)] text-[11px] text-ink-400">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm text-ink-100">{item.title}</p>
                    <p className="text-xs text-ink-500">{item.body}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        );

      case 1:
        return (
          <div>
            <StepHeader title="Pick a username" subtitle="This is how others will see you in rooms and chat." />
            <div className="mt-8">
              <UsernameInput value={username} onChange={setUsername} onValidityChange={setUsernameValid} />
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-600">
              <Sparkles className="h-3 w-3" />
              Don&apos;t overthink it. You can always change it later.
            </p>
          </div>
        );

      case 2:
        return (
          <div>
            <StepHeader title="Choose an avatar" subtitle="Shuffle until one feels like you. There are endless options." />
            <div className="mt-6 flex justify-center lg:hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={avatarId}
                  initial={{ scale: 0.75, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.75, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                >
                  <AvatarIcon avatarId={avatarId} className="h-20 w-20 rounded-full" />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-6 rounded-2xl border border-ink-800 bg-ink-950/60 p-4">
              <AvatarPicker value={avatarId} onChange={setAvatarId} />
            </div>
          </div>
        );

      case 3:
        return (
          <div>
            <StepHeader title="Tell us a bit more" subtitle="All optional. You can fill these in later, too." />
            <div className="mt-8 space-y-6">
              <Field label="Favorite language" hint="Pre-selected when you create rooms">
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGE_CHOICES.map((lang) => {
                    const active = favoriteLanguage === lang.value;
                    return (
                      <button
                        key={lang.value || "none"}
                        type="button"
                        onClick={() => setFavoriteLanguage(lang.value)}
                        aria-pressed={active}
                        className={`h-8 rounded-full border px-3 text-xs transition-colors ${
                          active
                            ? "border-ink-100 bg-ink-100 text-ink-950"
                            : "border-ink-800 text-ink-400 hover:border-ink-600 hover:text-ink-100"
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="GitHub">
                <div className="flex h-11 items-center rounded-xl border border-ink-800 bg-ink-950 transition-colors focus-within:border-ink-500">
                  <span className="pl-3.5 text-sm text-ink-600">github.com/</span>
                  <input
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="octocat"
                    maxLength={39}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm text-ink-100 placeholder:text-ink-700 focus:outline-none"
                  />
                </div>
              </Field>

              <Field label="Bio" hint={`${bio.length}/160`}>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 160))}
                  placeholder="Building things, learning as I go."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-ink-800 bg-ink-950 px-3.5 py-3 text-sm text-ink-100 placeholder:text-ink-700 transition-colors focus:border-ink-500 focus:outline-none"
                />
              </Field>
            </div>
          </div>
        );

      default: {
        const rows: { label: string; value: ReactNode; editStep: number }[] = [
          { label: "Username", value: `@${username}`, editStep: 1 },
          {
            label: "Avatar",
            value: <AvatarIcon avatarId={avatarId} className="h-6 w-6 rounded-full" />,
            editStep: 2,
          },
          {
            label: "Language",
            value: favoriteLanguage ? languageLabel(favoriteLanguage) : <span className="text-ink-600">No preference</span>,
            editStep: 3,
          },
          {
            label: "GitHub",
            value: githubUsername.trim() ? githubUsername.trim() : <span className="text-ink-600">Not set</span>,
            editStep: 3,
          },
          {
            label: "Bio",
            value: bio.trim() ? bio.trim() : <span className="text-ink-600">Not set</span>,
            editStep: 3,
          },
        ];

        return (
          <div>
            <StepHeader title="Looking good!" subtitle="Here's your profile. You can change any of this later." />
            <div className="mt-6 lg:hidden">
              <ProfilePreviewCard
                avatarId={avatarId}
                username={username}
                bio={bio}
                favoriteLanguage={favoriteLanguage}
                githubUsername={githubUsername}
              />
            </div>
            <div className="mt-6 divide-y divide-ink-900 overflow-hidden rounded-2xl border border-ink-800 bg-ink-950/60">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-20 shrink-0 text-xs text-ink-500">{row.label}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-100">{row.value}</span>
                  <button
                    type="button"
                    onClick={() => goTo(row.editStep)}
                    aria-label={`Edit ${row.label.toLowerCase()}`}
                    className="flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs text-ink-500 transition-colors hover:bg-ink-900 hover:text-ink-100"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      }
    }
  }

  return (
    <main className="relative min-h-[calc(100dvh-56px)] overflow-hidden">
      <div className="hero-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-[-14rem] h-[30rem] w-[52rem] max-w-[140vw] -translate-x-1/2 rounded-full bg-white/[0.05] blur-[130px]" />

      <div className="relative mx-auto grid max-w-5xl gap-12 px-4 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:gap-16 lg:py-16">
        <div className="mx-auto w-full max-w-md lg:mx-0">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-500">
                Step {step + 1} of {STEPS.length}
              </span>
              <span className="text-ink-300">{STEPS[step]}</span>
            </div>
            <div className="mt-3 flex gap-1.5">
              {STEPS.map((label, i) => (
                <div key={label} className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
                  <motion.div
                    className="h-full rounded-full bg-ink-100"
                    initial={false}
                    animate={{ width: i <= step ? "100%" : "0%" }}
                    transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Phones/tablets: compact identity chip (the big preview card is desktop-only) */}
          {step > 0 && (
            <div className="mb-6 flex min-w-0 items-center gap-2 text-xs text-ink-500 lg:hidden">
              <AvatarIcon avatarId={avatarId} className="h-6 w-6 shrink-0 rounded-full" />
              <span className="truncate">{username ? `@${username}` : "Setting up your profile…"}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="sm:min-h-[26rem]">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={SLIDE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: reduce ? 0 : 0.32, ease: EASE }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-10 flex items-center justify-between">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => goTo(step - 1)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-ink-500 transition-colors hover:text-ink-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={isLastStep ? submitting : !canGoNext}
                className="group inline-flex h-10 items-center gap-2 rounded-full bg-ink-100 px-5 text-sm font-semibold text-ink-950 shadow-[0_0_30px_-8px_rgba(255,255,255,0.6)] transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                {isLastStep ? (
                  submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Setting up…
                    </>
                  ) : (
                    <>
                      Enter CodeShare
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )
                ) : (
                  <>
                    {step === 0 ? "Let's go" : "Continue"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </div>

            {step !== 3 && (
              <p className="mt-4 hidden text-right text-[11px] text-ink-600 sm:block">
                or press{" "}
                <kbd className="rounded border border-ink-800 px-1 font-[family-name:var(--font-mono)] text-ink-500">
                  Enter ↵
                </kbd>
              </p>
            )}
          </form>
        </div>

        {/* Desktop: live member card */}
        <div className="hidden lg:block">
          <ProfilePreviewCard
            avatarId={avatarId}
            username={username}
            bio={bio}
            favoriteLanguage={favoriteLanguage}
            githubUsername={githubUsername}
          />
        </div>
      </div>
    </main>
  );
}