"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronsUpDown,
  ClipboardList,
  Keyboard,
  LayoutDashboard,
  LogOut,
  ScanEye,
  Settings,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { AvatarIcon } from "@/components/AvatarIcon";
import { GithubIcon } from "@/components/GithubIcon";
import { LogoMark } from "@/components/LogoMark";
import { openShortcutsDialog } from "@/components/ShortcutsDialog";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { clerkAppearance, currentTheme } from "@/lib/theme";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import type { Profile } from "@/types/profile";

const GITHUB_URL = "https://github.com/GitDaksh/codeshare";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/practice", label: "Practice", icon: Target },
  { href: "/lens", label: "Lens", icon: ScanEye },
  { href: "/interviews", label: "Interviews", icon: ClipboardList },
  { href: "/profile", label: "Profile", icon: UserRound },
];

const ITEM = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors";
const MENU_ITEM =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// You: your avatar and name, opening a menu with your account's actions.
function AccountButton({ profile, compact = false }: { profile: Profile | null; compact?: boolean }) {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const email = user?.primaryEmailAddress?.emailAddress;
  const avatarId = profile?.avatarId ?? DEFAULT_AVATAR_ID;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account"
        className={
          compact
            ? "flex items-center rounded-lg p-1 transition-colors hover:bg-ink-800"
            : `flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors ${open ? "bg-ink-800" : "hover:bg-ink-800"}`
        }
      >
        {profile ? (
          <AvatarIcon avatarId={avatarId} className="h-8 w-8 shrink-0 rounded-full" />
        ) : (
          <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-ink-800" />
        )}
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-100">
                {profile?.username ? `@${profile.username}` : "Your account"}
              </span>
              {email && <span className="block truncate text-xs text-ink-500">{email}</span>}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-500" />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: compact ? -4 : 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: compact ? -4 : 4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={`absolute z-50 w-60 rounded-xl border border-ink-800 bg-ink-900 p-1.5 shadow-raised ${
              compact ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2"
            }`}
          >
            <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className={MENU_ITEM}>
              <UserRound className="h-4 w-4 text-ink-500" />
              Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                openUserProfile({ appearance: clerkAppearance(currentTheme()) });
              }}
              className={MENU_ITEM}
            >
              <Settings className="h-4 w-4 text-ink-500" />
              Account settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                openShortcutsDialog();
              }}
              className={MENU_ITEM}
            >
              <Keyboard className="h-4 w-4 text-ink-500" />
              Keyboard shortcuts
            </button>
            <div className="my-1 h-px bg-ink-800" />
            <ThemeSwitcher />
            <div className="my-1 h-px bg-ink-800" />
            <button type="button" role="menuitem" onClick={() => signOut({ redirectUrl: "/" })} className={MENU_ITEM}>
              <LogOut className="h-4 w-4 text-ink-500" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The frame around every signed-in page (except rooms, which are full-screen).
// Desktop: the sidebar sits right on the page background (no border, so it
// blends in), and the page floats beside it as one rounded panel. The active
// section's highlight is the panel's own surface, and it slides from item to
// item as you move around. Phones: a top bar and bottom tabs.
export function AppShell({ children }: { children: ReactNode }) {
  const api = useApi();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);

  // Refetched on every navigation, so a new avatar or username picked on the
  // profile page shows up as soon as you move to another page.
  useEffect(() => {
    let cancelled = false;
    api
      .get<Profile>("/api/profile")
      .then((res) => {
        if (!cancelled) setProfile(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, pathname]);

  return (
    <div className="min-h-dvh bg-ink-950">
      {/* ---------- Desktop: the sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col md:flex">
        <Link href="/dashboard" className="group flex h-16 shrink-0 items-center gap-2.5 px-5">
          <LogoMark className="h-7 w-7 transition-transform duration-300 group-hover:scale-105" />
          <span className="text-[15px] font-semibold tracking-tight text-ink-100">CodeShare</span>
        </Link>
        <nav className="flex-1 space-y-0.5 px-3 pt-2" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative ${ITEM} ${active ? "text-ink-100" : "text-ink-400 hover:bg-ink-900/50 hover:text-ink-100"}`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-ink-900 shadow-xs ring-1 ring-ink-800"
                    transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.9 }}
                  />
                )}
                <item.icon
                  className={`relative h-4 w-4 transition-colors ${active ? "text-ink-100" : "text-ink-500 group-hover:text-ink-300"}`}
                />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="space-y-0.5 px-3 pb-2">
          <button type="button" onClick={openShortcutsDialog} className={`${ITEM} text-ink-400 hover:bg-ink-900/50 hover:text-ink-100`}>
            <Keyboard className="h-4 w-4 text-ink-500" />
            Shortcuts
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ITEM} text-ink-400 hover:bg-ink-900/50 hover:text-ink-100`}
          >
            <GithubIcon className="h-4 w-4 text-ink-500" />
            Source code
          </a>
        </div>
        <div className="p-3 pt-1">
          <AccountButton profile={profile} />
        </div>
      </aside>

      {/* ---------- Phones: a top bar ---------- */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-800 bg-ink-900/85 px-4 backdrop-blur-xl md:hidden">
        <Link href="/dashboard" className="group flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight text-ink-100">CodeShare</span>
        </Link>
        <AccountButton profile={profile} compact />
      </header>

      {/* ---------- The page: a floating panel beside the sidebar ---------- */}
      <div className="pb-20 md:pb-2 md:pl-60 md:pr-2 md:pt-2">
        <div className="min-h-[calc(100dvh-3.5rem)] bg-ink-900 md:min-h-[calc(100dvh-1rem)] md:rounded-xl md:border md:border-ink-800 md:shadow-card">
          {children}
        </div>
      </div>

      {/* ---------- Phones: bottom tabs ---------- */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-800 bg-ink-900/90 px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 backdrop-blur-xl md:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium"
            >
              {active && (
                <motion.span
                  layoutId="tabbar-active"
                  className="absolute -top-1 h-0.5 w-8 rounded-full bg-ink-100"
                  transition={{ type: "spring", stiffness: 520, damping: 42 }}
                />
              )}
              <item.icon className={`h-5 w-5 transition-colors ${active ? "text-ink-100" : "text-ink-500"}`} />
              <span className={`transition-colors ${active ? "text-ink-100" : "text-ink-500"}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}