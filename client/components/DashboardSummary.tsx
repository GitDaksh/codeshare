"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Code2,
  FlaskConical,
  Link2,
  MessageSquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { Skeleton } from "@/components/Skeleton";
import { LANGUAGES } from "@/lib/languages";
import { DIFFICULTIES, PROBLEMS, getProblem } from "@/lib/problems";
import type { Profile, ProfileStats } from "@/types/profile";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];
// Matches the server's activity window (16 weeks, today included).
const WEEKS = 16;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
// Busier days are brighter, in four steps.
const LEVEL_CLASS = ["bg-ink-800", "bg-ink-600", "bg-ink-500", "bg-ink-300", "bg-ink-100"];
const DASH = "—";
// The same colors as the Practice page's progress bars.
const BAR: Record<string, string> = { Easy: "bg-success-strong", Medium: "bg-warning-strong", Hard: "bg-danger-strong" };

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// "2026-09-29" in the browser's time zone, the same one the server used.
function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function level(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function languageLabel(value: string) {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

function ago(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Cell = { key: string; date: Date; count: number; future: boolean; today: boolean };

// 16 columns of weeks (Sunday first), ending with the current week.
function buildCalendar(counts: Map<string, number>, today: Date): Cell[][] {
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);
  const todayKey = dayKey(today);
  return Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + day);
      const key = dayKey(date);
      return { key, date, count: counts.get(key) ?? 0, future: date > today, today: key === todayKey };
    }),
  );
}

// Days in a row with activity, up to today. A quiet today doesn't break the
// streak yet: the day isn't over.
function currentStreak(counts: Map<string, number>, today: Date) {
  const day = new Date(today);
  if (!counts.get(dayKey(day))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while ((counts.get(dayKey(day)) ?? 0) > 0) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

// A month's name above the week it starts in, skipping labels that would collide.
function monthLabels(weeks: Cell[][]) {
  const labels: { week: number; text: string }[] = [];
  weeks.forEach((week, index) => {
    const month = week[0].date.getMonth();
    if (index > 0 && month === weeks[index - 1][0].date.getMonth()) return;
    const last = labels[labels.length - 1];
    if (last && index - last.week < 3) labels.pop();
    labels.push({ week: index, text: MONTHS[month] });
  });
  return labels;
}

function Card({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cx(
        "flex flex-col rounded-xl border border-ink-800 bg-ink-900 p-5 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-100">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProgressRing({ solved, total }: { solved: number | null; total: number }) {
  const percent = solved && total > 0 ? (solved / total) * 100 : 0;
  return (
    <div className="relative h-[5.5rem] w-[5.5rem] shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.915" fill="none" strokeWidth="3" className="stroke-ink-800" />
        {percent > 0 && (
          <motion.circle
            cx="18"
            cy="18"
            r="15.915"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-ink-100"
            initial={{ strokeDasharray: "0 100" }}
            animate={{ strokeDasharray: `${percent} ${100 - percent}` }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-none tracking-tight text-ink-100 tabular-nums">
          {solved ?? DASH}
        </span>
        <span className="mt-1 text-[10px] text-ink-500">of {total}</span>
      </div>
    </div>
  );
}

// Latest solve and Next up: a small label over one line of content.
function Pointer({ label, href, children }: { label: string; href?: string; children: ReactNode }) {
  const body = (
    <>
      <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">{label}</span>
      <span className="mt-1 flex min-w-0 items-center gap-2">{children}</span>
    </>
  );
  return href ? (
    <Link href={href} className="group -mx-2 block rounded-lg px-2 py-1.5 transition-colors hover:bg-ink-800/60">
      {body}
    </Link>
  ) : (
    <div className="px-0 py-1.5">{body}</div>
  );
}

// The dashboard's sidebar: Practice progress, recent activity and everything
// else the user has on CodeShare.
export function DashboardSummary({
  profile,
  stats,
  statsFailed,
}: {
  // null if the profile couldn't be loaded: numbers show "—", never a wrong 0.
  profile: Profile | null;
  // null while loading (or if it couldn't be loaded).
  stats: ProfileStats | null;
  statsFailed: boolean;
}) {
  // ---------- Practice ----------
  const practice = useMemo(() => {
    const solvedSlugs = new Set((profile?.solvedProblems ?? []).map((s) => s.slug));
    const rows = DIFFICULTIES.map((difficulty) => {
      const inLevel = PROBLEMS.filter((p) => p.difficulty === difficulty);
      return { difficulty, total: inLevel.length, solved: inLevel.filter((p) => solvedSlugs.has(p.slug)).length };
    });
    const latest = [...(profile?.solvedProblems ?? [])]
      .filter((s) => getProblem(s.slug))
      .sort((a, b) => b.solvedAt.localeCompare(a.solvedAt))[0];
    return {
      rows,
      solved: rows.reduce((sum, row) => sum + row.solved, 0),
      latest: latest ? { ...latest, problem: getProblem(latest.slug)! } : null,
      next: PROBLEMS.find((p) => !solvedSlugs.has(p.slug)) ?? null,
    };
  }, [profile]);

  // ---------- Activity ----------
  const activity = useMemo(() => {
    const counts = new Map((stats?.activity ?? []).map((d) => [d.date, d.count]));
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weeks = buildCalendar(counts, today);
    return {
      weeks,
      labels: new Map(monthLabels(weeks).map((label) => [label.week, label.text])),
      activeDays: [...counts.values()].filter((count) => count > 0).length,
      streak: currentStreak(counts, today),
    };
  }, [stats]);

  const statsLoading = !stats && !statsFailed;
  const topLanguage = stats?.languages[0]?.language ?? profile?.favoriteLanguage ?? "";
  const memberSince = stats?.memberSince ?? profile?.createdAt ?? null;

  // Loading shows a placeholder; failing shows a dash.
  const statValue = (value: ReactNode) => (statsLoading ? <Skeleton className="h-4 w-8" /> : stats ? value : DASH);

  const glance: { icon: LucideIcon; label: string; value: ReactNode }[] = [
    { icon: Users, label: "Coding partners", value: statValue(stats?.partners) },
    { icon: MessageSquare, label: "Messages sent", value: statValue(stats?.messages.toLocaleString()) },
    {
      icon: Code2,
      label: "Languages",
      value: statValue(
        <>
          {stats?.languages.length}
          {topLanguage && stats && stats.languages.length > 0 && (
            <span className="ml-1.5 font-normal text-ink-500">· mostly {languageLabel(topLanguage)}</span>
          )}
        </>,
      ),
    },
    { icon: Link2, label: "Shared with you", value: statValue(stats?.sharedRooms) },
    { icon: FlaskConical, label: "Practice rooms", value: statValue(stats?.practiceRooms) },
    {
      icon: CalendarDays,
      label: "Member since",
      value: memberSince
        ? new Date(memberSince).toLocaleDateString(undefined, { month: "short", year: "numeric" })
        : statValue(DASH),
    },
  ];

  return (
    <motion.aside
      aria-label="Your summary"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05, ease: EASE }}
      className="grid content-start gap-3 md:grid-cols-2 lg:grid-cols-1"
    >
      {/* ---------- Practice ---------- */}
      <Card
        title="Practice"
        action={
          <Link
            href="/practice"
            className="inline-flex items-center gap-1 text-xs text-ink-400 transition-colors hover:text-ink-100"
          >
            Open
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      >
        <div className="mt-4 flex items-center gap-5">
          <ProgressRing solved={profile ? practice.solved : null} total={PROBLEMS.length} />
          <div className="min-w-0 flex-1 space-y-2.5">
            {practice.rows.map(({ difficulty, solved, total }) => (
              <div key={difficulty}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-300">{difficulty}</span>
                  <span className="tabular-nums text-ink-500">
                    <span className="text-ink-100">{profile ? solved : DASH}</span> / {total}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <motion.div
                    className={`h-full rounded-full ${BAR[difficulty] ?? "bg-ink-300"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${profile && total > 0 ? (solved / total) * 100 : 0}%` }}
                    transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-1 border-t border-ink-800 pt-3">
          {!profile ? (
            <Pointer label="Latest solve">
              <span className="text-sm text-ink-400">{DASH}</span>
            </Pointer>
          ) : practice.latest ? (
            <Pointer label="Latest solve" href={`/practice/${practice.latest.slug}`}>
              <span className="truncate text-sm font-medium text-ink-100">{practice.latest.problem.title}</span>
              <span className="shrink-0 text-xs text-ink-500">
                {languageLabel(practice.latest.language)} · {ago(practice.latest.solvedAt)}
              </span>
            </Pointer>
          ) : (
            <Pointer label="Latest solve">
              <span className="text-sm text-ink-400">Nothing solved yet</span>
            </Pointer>
          )}
          {profile && practice.next ? (
            <Pointer label="Next up" href={`/practice/${practice.next.slug}`}>
              <span className="truncate text-sm font-medium text-ink-100">{practice.next.title}</span>
              <DifficultyBadge difficulty={practice.next.difficulty} />
              <ArrowRight
                className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-100"
                aria-hidden="true"
              />
            </Pointer>
          ) : profile ? (
            <Pointer label="Next up">
              <span className="text-sm text-ink-100">Every problem solved. Impressive.</span>
            </Pointer>
          ) : null}
        </div>
      </Card>

      {/* ---------- Activity ---------- */}
      <Card title="Activity" action={<span className="text-xs text-ink-500">Last 16 weeks</span>}>
        {/* The grid scales with the card: weeks share the width, days are square. */}
        <div
          role="img"
          aria-label={`${activity.activeDays} active ${activity.activeDays === 1 ? "day" : "days"} in the last 16 weeks`}
          className="mt-4 grid gap-[3px]"
          style={{ gridTemplateColumns: `auto repeat(${WEEKS}, minmax(0, 1fr))` }}
        >
          <span />
          {activity.weeks.map((week, index) => (
            <span key={`month-${week[0].key}`} className="relative h-3.5">
              {activity.labels.has(index) && (
                <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] leading-none text-ink-500">
                  {activity.labels.get(index)}
                </span>
              )}
            </span>
          ))}
          {DAY_LABELS.map((dayLabel, day) => (
            <Fragment key={day}>
              <span className="self-center pr-1.5 text-[9px] leading-none text-ink-600">{dayLabel}</span>
              {activity.weeks.map((week) => {
                const cell = week[day];
                return (
                  <span
                    key={cell.key}
                    data-day={cell.key}
                    title={
                      cell.future
                        ? undefined
                        : `${cell.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${
                            cell.count === 0
                              ? "no activity"
                              : `${cell.count} ${cell.count === 1 ? "activity" : "activities"}`
                          }`
                    }
                    className={cx(
                      "aspect-square rounded-[3px]",
                      cell.future ? "bg-transparent" : LEVEL_CLASS[level(cell.count)],
                      cell.today && "ring-1 ring-ink-300 ring-offset-1 ring-offset-ink-900",
                    )}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex gap-6">
            <div>
              <div className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-ink-100 tabular-nums">
                {statsLoading ? <Skeleton className="h-6 w-8" /> : stats ? activity.activeDays : DASH}
              </div>
              <div className="mt-0.5 text-xs text-ink-500">Active days</div>
            </div>
            <div>
              <div className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-ink-100 tabular-nums">
                {statsLoading ? (
                  <Skeleton className="h-6 w-8" />
                ) : stats ? (
                  `${activity.streak} ${activity.streak === 1 ? "day" : "days"}`
                ) : (
                  DASH
                )}
              </div>
              <div className="mt-0.5 text-xs text-ink-500">Current streak</div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-ink-500" aria-hidden="true">
            Less
            {LEVEL_CLASS.map((className) => (
              <span key={className} className={cx("h-2.5 w-2.5 rounded-[3px]", className)} />
            ))}
            More
          </div>
        </div>
      </Card>

      {/* ---------- At a glance ---------- */}
      <Card title="At a glance" className="md:col-span-2 lg:col-span-1">
        <dl className="mt-3 divide-y divide-ink-800">
          {glance.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5 first:pt-1 last:pb-0">
              <dt className="flex min-w-0 items-center gap-2 text-sm text-ink-400">
                <Icon className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </dt>
              <dd className="flex shrink-0 items-center text-sm font-medium text-ink-100 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </motion.aside>
  );
}