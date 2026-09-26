"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { GithubIcon } from "@/components/GithubIcon";
import { LogoMark } from "@/components/LogoMark";

const GITHUB_URL = "https://github.com/GitDaksh/codeshare";
const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

type NavItem = {
  label: string;
  href: string;
  kind: "route" | "hash" | "external";
};

export function Navbar() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const isLanding = pathname === "/";
  const isOnboarding = pathname === "/onboarding";
  // Room pages have their own header with a back button. On phones the
  // global navbar is hidden there so the editor gets the full screen height.
  const isRoom = pathname.startsWith("/room/");

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the mobile menu on Escape or a tap outside the header.
  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    function handlePointerDown(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMobileOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [mobileOpen]);

  const items: NavItem[] = !isLoaded
    ? []
    : isSignedIn
      ? [
          { label: "Dashboard", href: "/dashboard", kind: "route" },
          { label: "Practice", href: "/practice", kind: "route" },
          { label: "Profile", href: "/profile", kind: "route" },
        ]
      : [
          // On the landing page a plain "#features" link lets smooth scroll
          // handle it; from other pages it navigates home first.
          { label: "Features", href: isLanding ? "#features" : "/#features", kind: "hash" },
          { label: "Practice", href: "/practice", kind: "route" },
          { label: "Source", href: GITHUB_URL, kind: "external" },
        ];

  // Transparent over the top of the landing page, frosted glass everywhere else.
  const solid = scrolled || !isLanding || mobileOpen;

  function isActive(item: NavItem) {
    return item.kind === "route" && pathname.startsWith(item.href);
  }

  function renderItem(item: NavItem, variant: "desktop" | "mobile") {
    const active = isActive(item);
    const onClick = () => setMobileOpen(false);

    const className =
      variant === "desktop"
        ? `relative rounded-full px-3 py-1.5 text-sm transition-colors ${
            active ? "text-ink-100" : "text-ink-400 hover:text-ink-100"
          }`
        : `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
            active ? "bg-ink-900 text-ink-100" : "text-ink-300 active:bg-ink-900"
          }`;

    const content =
      variant === "desktop" ? (
        <>
          {hovered === item.href && (
            <motion.span
              layoutId="nav-hover-pill"
              className="absolute inset-0 rounded-full bg-ink-800/70"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">
            {item.kind === "external" && <GithubIcon className="h-3.5 w-3.5" />}
            {item.label}
          </span>
          {active && <span className="absolute inset-x-3 -bottom-3 h-px bg-ink-100" />}
        </>
      ) : (
        <>
          {item.kind === "external" && <GithubIcon className="h-4 w-4" />}
          {item.label}
        </>
      );

    const hoverProps = variant === "desktop" ? { onMouseEnter: () => setHovered(item.href) } : {};

    if (item.kind === "route") {
      return (
        <Link key={item.href} href={item.href} onClick={onClick} className={className} {...hoverProps}>
          {content}
        </Link>
      );
    }

    return (
      <a
        key={item.href}
        href={item.href}
        onClick={onClick}
        className={className}
        {...(item.kind === "external" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...hoverProps}
      >
        {content}
      </a>
    );
  }

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-30 border-b transition-[background-color,border-color] duration-300 ${
        solid ? "border-ink-800/80 bg-ink-950/75 backdrop-blur-xl" : "border-transparent bg-transparent"
      } ${isRoom ? "hidden md:block" : ""}`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" aria-label="CodeShare home" className="group flex shrink-0 items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-ink-100">
            Code<span className="text-ink-400">Share</span>
          </span>
        </Link>

        {!isOnboarding && (
          <>
            <nav className="ml-4 hidden items-center md:flex" onMouseLeave={() => setHovered(null)}>
              {items.map((item) => renderItem(item, "desktop"))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {!isLoaded ? (
                <span className="h-8 w-8 animate-pulse rounded-full bg-ink-800" />
              ) : isSignedIn ? (
                <AccountMenu />
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="hidden rounded-full px-3 py-1.5 text-sm text-ink-400 transition-colors hover:text-ink-100 md:inline-flex"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="group inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-4 py-1.5 text-sm font-semibold text-ink-950 shadow-[0_0_24px_-8px_rgba(255,255,255,0.6)] transition-all hover:bg-white hover:shadow-[0_0_32px_-6px_rgba(255,255,255,0.75)]"
                  >
                    Get started
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMobileOpen((o) => !o)}
                    aria-label={mobileOpen ? "Close menu" : "Open menu"}
                    aria-expanded={mobileOpen}
                    className="rounded-full p-2 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 md:hidden"
                  >
                    {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Phones, signed out: the rest of the links live in a drop-down panel.
          Signed-in users get the same links inside the account menu instead. */}
      <AnimatePresence>
        {mobileOpen && isLoaded && !isSignedIn && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden border-t border-ink-800/80 md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {items.map((item) => renderItem(item, "mobile"))}
              <Link
                href="/sign-in"
                onClick={() => setMobileOpen(false)}
                className="flex items-center rounded-lg px-3 py-2.5 text-sm text-ink-300 transition-colors active:bg-ink-900"
              >
                Sign in
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}