"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { AvatarPicker } from "@/components/AvatarPicker";
import { UsernameInput } from "@/components/UsernameInput";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import { LANGUAGES, getLanguageBadgeClasses } from "@/lib/languages";
import type { Profile } from "@/types/profile";

const STEPS = ["Welcome", "Username", "Avatar", "About you", "Review"] as const;

export default function OnboardingPage() {
  const api = useApi();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
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

  if (checkingExisting) {
    return (
      <main className="flex min-h-[calc(100dvh-56px)] items-center justify-center">
        <p className="text-sm text-ink-500">Loading…</p>
      </main>
    );
  }

  const canGoNext = step === 1 ? usernameValid : true;

  return (
    <main className="flex min-h-[calc(100dvh-56px)] items-start justify-center px-4 py-8 sm:items-center sm:py-12">
      <div className="w-full max-w-sm">
        {step > 0 && (
          <div className="mb-4 flex min-w-0 items-center gap-2 text-xs text-ink-500">
            <AvatarIcon avatarId={avatarId} className="h-6 w-6 shrink-0 rounded-full" />
            <span className="truncate">{username ? `@${username}` : "Setting up your profile…"}</span>
          </div>
        )}

        <div className="mb-8 flex items-center gap-1.5">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-ink-100" : "bg-ink-800"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink-100 sm:text-2xl">
                Welcome to CodeShare!
              </h1>
              <p className="mt-1.5 text-sm text-ink-500">
                Let's get your profile set up — it only takes a minute.
              </p>
              <div className="mt-8 flex justify-center">
                <AvatarIcon avatarId={avatarId} className="h-20 w-20 rounded-full" />
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="username"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink-100 sm:text-2xl">
                Pick a username
              </h1>
              <p className="mt-1.5 text-sm text-ink-500">
                This is how others will see you in rooms and chat.
              </p>
              <div className="mt-6">
                <UsernameInput
                  value={username}
                  onChange={setUsername}
                  onValidityChange={setUsernameValid}
                />
              </div>
              <p className="mt-3 text-xs text-ink-600">
                Don't overthink it — you can always change this later.
              </p>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="avatar"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink-100 sm:text-2xl">
                Choose an avatar
              </h1>
              <p className="mt-1.5 text-sm text-ink-500">Shuffle until one feels right — infinite options.</p>
              <div className="mt-6 flex justify-center">
                <AvatarIcon avatarId={avatarId} className="h-20 w-20 rounded-full" />
              </div>
              <div className="mt-6">
                <AvatarPicker value={avatarId} onChange={setAvatarId} />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="about"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink-100 sm:text-2xl">
                Tell us more
              </h1>
              <p className="mt-1.5 text-sm text-ink-500">
                All optional — you can fill these in later too.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-ink-500">Favorite language</label>
                  <select
                    value={favoriteLanguage}
                    onChange={(e) => setFavoriteLanguage(e.target.value)}
                    className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 focus:border-ink-500 focus:outline-none"
                  >
                    <option value="">No preference</option>
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-ink-500">GitHub username</label>
                  <input
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="octocat"
                    maxLength={39}
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-ink-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-ink-500">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 160))}
                    placeholder="Building things, learning as I go."
                    rows={2}
                    className="w-full resize-none rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-ink-500 focus:outline-none"
                  />
                  <p className="mt-1 text-right text-xs text-ink-600">{bio.length}/160</p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink-100 sm:text-2xl">
                Looking good!
              </h1>
              <p className="mt-1.5 text-sm text-ink-500">
                Here's your profile — you can change any of this later.
              </p>

              <div className="mt-6 flex items-center gap-3 rounded-lg border border-ink-800 p-4">
                <AvatarIcon avatarId={avatarId} className="h-14 w-14 shrink-0 rounded-full" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-100">@{username}</p>
                  {bio && <p className="mt-0.5 truncate text-xs text-ink-400">{bio}</p>}
                </div>
              </div>

              {(favoriteLanguage || githubUsername) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  {favoriteLanguage && (
                    <span className={`rounded border px-1.5 py-0.5 ${getLanguageBadgeClasses(favoriteLanguage)}`}>
                      {favoriteLanguage}
                    </span>
                  )}
                  {githubUsername && <span className="truncate">github.com/{githubUsername}</span>}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="py-2 text-sm text-ink-500 transition-colors hover:text-ink-100"
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canGoNext}
              className="rounded-md bg-ink-100 px-5 py-2.5 text-sm font-medium text-ink-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 sm:py-2"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={submitting}
              className="rounded-md bg-ink-100 px-5 py-2.5 text-sm font-medium text-ink-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:py-2"
            >
              {submitting ? "Setting up…" : "Get started"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}