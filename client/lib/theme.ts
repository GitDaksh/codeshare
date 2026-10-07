"use client";

import { useSyncExternalStore } from "react";
import { dark } from "@clerk/themes";
import { THEME_COLORS, THEME_STORAGE_KEY } from "@/lib/themeScript";

// The app's theme: dark by default, light as an option, or following the
// device. The choice is per device (localStorage); the page reads it before
// drawing (see THEME_SCRIPT), and switching applies everywhere at once.

export type ThemeChoice = "dark" | "light" | "system";
export type Theme = "dark" | "light";

const EVENT = "codeshare:theme";

export function readThemeChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "system" || saved === "dark") return saved;
  } catch {
    // Storage unavailable: the default.
  }
  return "dark";
}

function resolve(choice: ThemeChoice): Theme {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function apply(choice: ThemeChoice) {
  const theme = resolve(choice);
  document.documentElement.classList.toggle("light", theme === "light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }));
}

// Switching crossfades the whole page where the browser supports it (and
// motion isn't reduced); elsewhere it applies instantly.
export function setThemeChoice(choice: ThemeChoice) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Not being able to save it is harmless: it still applies now.
  }
  const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !calm) doc.startViewTransition(() => apply(choice));
  else apply(choice);
}

// "System" follows the device live (say, when it switches to dark at
// sunset). Watched once for the whole app, so it works on every page, not
// only while a theme control happens to be on screen.
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (readThemeChoice() === "system") apply("system");
  });
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

// The theme showing now, and the choice behind it.
export function useTheme() {
  const theme = useSyncExternalStore<Theme>(subscribe, currentTheme, () => "dark");
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, readThemeChoice, () => "dark");
  return { theme, choice, choose: setThemeChoice };
}

// Clerk's sign-in, sign-up and account screens, matched to each theme.
export function clerkAppearance(theme: Theme) {
  return theme === "light"
    ? {
        variables: {
          colorPrimary: "#18181b",
          colorPrimaryForeground: "#fafafa",
          colorBackground: "#ffffff",
          colorForeground: "#18181b",
          colorMutedForeground: "#71717a",
          colorInput: "#ffffff",
          colorInputForeground: "#18181b",
          colorBorder: "#dfdfe4",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-display)",
        },
      }
    : {
        theme: dark,
        variables: {
          colorPrimary: "#f6f6f7",
          colorPrimaryForeground: "#131316",
          colorBackground: "#1b1b1f",
          colorForeground: "#f6f6f7",
          colorMutedForeground: "#a9a9b2",
          colorInput: "#131316",
          colorInputForeground: "#f6f6f7",
          colorBorder: "#36363d",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-display)",
        },
      };
}