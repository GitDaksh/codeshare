"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LayoutDashboard, LogOut, Settings, Target, User, type LucideIcon } from "lucide-react";
import { useApi } from "@/lib/api";
import { AvatarIcon } from "@/components/AvatarIcon";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import type { Profile } from "@/types/profile";

const ITEM_CLASS =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100";

function MenuLink({
  href,
  icon: Icon,
  label,
  onSelect,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Link href={href} role="menuitem" onClick={onSelect} className={ITEM_CLASS}>
      <Icon className="h-4 w-4 text-ink-500" />
      {label}
    </Link>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button type="button" role="menuitem" onClick={onSelect} className={ITEM_CLASS}>
      <Icon className="h-4 w-4 text-ink-500" />
      {label}
    </button>
  );
}

export function AccountMenu() {
  const api = useApi();
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Refetch on every navigation, so a new avatar or username picked on the
  // profile page shows up here as soon as you move to another page.
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

  // Close on outside click or Escape.
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

  const avatarId = profile?.avatarId ?? DEFAULT_AVATAR_ID;
  const username = profile?.username;
  const email = user?.primaryEmailAddress?.emailAddress;

  function close() {
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-2 transition-colors sm:pr-2.5 ${
          open ? "border-ink-600 bg-ink-900" : "border-ink-800 bg-ink-900/60 hover:border-ink-600"
        }`}
      >
        {profile ? (
          <AvatarIcon avatarId={avatarId} className="h-6 w-6 rounded-full" />
        ) : (
          <span className="h-6 w-6 animate-pulse rounded-full bg-ink-800" />
        )}
        {username && <span className="hidden max-w-[120px] truncate text-sm text-ink-300 sm:inline">{username}</span>}
        <ChevronDown
          className={`h-3.5 w-3.5 text-ink-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-ink-800 bg-ink-900/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 px-2.5 py-2.5">
              <AvatarIcon avatarId={avatarId} className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-100">{username ? `@${username}` : "Your account"}</p>
                {email && <p className="truncate text-xs text-ink-500">{email}</p>}
              </div>
            </div>

            <div className="my-1 h-px bg-ink-800" />

            <MenuLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" onSelect={close} />
            <MenuLink href="/practice" icon={Target} label="Practice" onSelect={close} />
            <MenuLink href="/profile" icon={User} label="Profile" onSelect={close} />
            <MenuButton
              icon={Settings}
              label="Account settings"
              onSelect={() => {
                close();
                openUserProfile();
              }}
            />

            <div className="my-1 h-px bg-ink-800" />

            <MenuButton
              icon={LogOut}
              label="Sign out"
              onSelect={() => {
                close();
                void signOut({ redirectUrl: "/" });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}