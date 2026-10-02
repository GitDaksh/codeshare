"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Eye, LogOut, MoreHorizontal, PencilLine, UserMinus, UserPlus, X } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import type { OnlineUser } from "@/types/presence";
import type { AccessRequest, RoomPerson, RoomRole } from "@/types/room";

const ROLE_LABEL: Record<RoomRole, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" };
const DEFAULT_AVATAR_ID = "codeshare";

type PeoplePanelProps = {
  // Everyone in the room (null while loading: the people online show meanwhile).
  people: RoomPerson[] | null;
  onlineUsers: OnlineUser[];
  currentUserId: string | null;
  myRole: RoomRole;
  following: string | null;
  onFollow: (userId: string | null) => void;
  onChangeRole: (userId: string, role: "editor" | "viewer") => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  onLeave: () => Promise<void>;
  onInvite?: () => void;
  // Owner: viewers asking to edit, and what to do with them.
  requests?: AccessRequest[];
  onAllow?: (userId: string) => void;
  onDismiss?: (userId: string) => void;
  // Viewer: ask the owner for edit access.
  onAskToEdit?: () => void;
  asked?: boolean;
};

// The owner's menu for one person: change their role, or remove them.
function PersonMenu({
  person,
  onChangeRole,
  onRemove,
}: {
  person: RoomPerson;
  onChangeRole: (role: "editor" | "viewer") => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = person.username ?? "this person";

  // Closing the menu also cancels a half-confirmed removal.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const next = person.role === "viewer" ? "editor" : "viewer";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(false);
        }}
        aria-label={`Manage ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-7 z-20 w-48 rounded-lg border border-ink-700 bg-ink-900 p-1 shadow-xl"
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setConfirming(false);
                onChangeRole(next);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink-200 transition-colors hover:bg-ink-800"
            >
              {next === "editor" ? <PencilLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {next === "editor" ? "Make editor" : "Make viewer"}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                setOpen(false);
                setConfirming(false);
                onRemove();
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                confirming ? "bg-ink-100 text-ink-950" : "text-ink-200 hover:bg-ink-800"
              }`}
            >
              <UserMinus className="h-3.5 w-3.5" />
              {confirming ? "Click again to remove" : "Remove from room"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Everyone in the room: who's online, their role, and (for the owner) the
// controls to change roles or remove people.
export function PeoplePanel({
  people,
  onlineUsers,
  currentUserId,
  myRole,
  following,
  onFollow,
  onChangeRole,
  onRemove,
  onLeave,
  onInvite,
  requests = [],
  onAllow,
  onDismiss,
  onAskToEdit,
  asked = false,
}: PeoplePanelProps) {
  const [leaving, setLeaving] = useState(false);
  const online = new Map(onlineUsers.map((user) => [user.userId, user]));
  // While the full list loads, show who's online.
  const list: RoomPerson[] =
    people ??
    Array.from(online.values()).map((user) => ({
      userId: user.userId,
      username: user.name,
      avatarId: user.avatarId,
      role: user.role ?? "editor",
    }));
  const onlineCount = list.filter((person) => online.has(person.userId)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-1.5 pt-3 md:pt-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
          In this room · {list.length}
          {onlineCount > 0 && <span className="normal-case tracking-normal text-ink-500"> ({onlineCount} online)</span>}
        </p>
        {onInvite && (
          <button
            onClick={onInvite}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </button>
        )}
      </div>

      {myRole === "viewer" && (
        <div className="mx-3 mb-2 rounded-lg border border-ink-800 bg-ink-950/50 px-3 py-2.5">
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-400">
            <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            You&apos;re viewing this room. You can follow people and chat.
          </p>
          {onAskToEdit && (
            <button
              type="button"
              onClick={onAskToEdit}
              disabled={asked}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-ink-100 px-2 py-1.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-white disabled:bg-ink-800 disabled:text-ink-400"
            >
              {asked ? <Check className="h-3.5 w-3.5" /> : <PencilLine className="h-3.5 w-3.5" />}
              {asked ? "Asked the owner" : "Ask to edit"}
            </button>
          )}
        </div>
      )}

      {myRole === "owner" && requests.length > 0 && (
        <div className="mx-3 mb-2 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-400">Asking to edit · {requests.length}</p>
          {requests.map((request) => (
            <div
              key={request.userId}
              className="flex items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-800/60 px-2.5 py-2"
            >
              <AvatarIcon avatarId={request.avatarId || DEFAULT_AVATAR_ID} className="h-7 w-7 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-100">{request.name}</span>
              <button
                type="button"
                onClick={() => onAllow?.(request.userId)}
                className="shrink-0 rounded-md bg-ink-100 px-2.5 py-1 text-[11px] font-semibold text-ink-950 transition-colors hover:bg-white"
              >
                Allow
              </button>
              <button
                type="button"
                onClick={() => onDismiss?.(request.userId)}
                aria-label={`Dismiss ${request.name}'s request`}
                title="Dismiss"
                className="shrink-0 rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {list.map((person) => {
          const isYou = person.userId === currentUserId;
          const live = online.get(person.userId);
          const name = person.username ?? live?.name ?? "Someone";
          return (
            <li
              key={person.userId}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-ink-800/60"
            >
              <span className="relative shrink-0">
                <AvatarIcon
                  avatarId={person.avatarId ?? live?.avatarId ?? DEFAULT_AVATAR_ID}
                  className={`h-8 w-8 rounded-full md:h-7 md:w-7 ${live ? "" : "opacity-50"}`}
                />
                {live && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-ink-100" />
                )}
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm font-medium ${live ? "text-ink-100" : "text-ink-400"}`}>
                {isYou ? "You" : name}
              </span>
              <span
                className={`shrink-0 rounded border px-1.5 py-px text-[10px] font-medium ${
                  person.role === "owner" ? "border-ink-600 bg-ink-800 text-ink-200" : "border-ink-700 text-ink-400"
                }`}
              >
                {ROLE_LABEL[person.role]}
              </span>
              {!isYou && live && (
                <button
                  type="button"
                  onClick={() => onFollow(following === person.userId ? null : person.userId)}
                  aria-pressed={following === person.userId}
                  title={following === person.userId ? "Stop following" : `Follow ${name}'s cursor`}
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    following === person.userId
                      ? "border-ink-100 bg-ink-100 text-ink-950"
                      : "border-ink-700 text-ink-300 hover:border-ink-500 hover:text-ink-100"
                  }`}
                >
                  {following === person.userId ? "Following" : "Follow"}
                </button>
              )}
              {myRole === "owner" && person.role !== "owner" && (
                <PersonMenu
                  person={person}
                  onChangeRole={(role) => void onChangeRole(person.userId, role)}
                  onRemove={() => void onRemove(person.userId)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {myRole !== "owner" && (
        <div className="border-t border-ink-800 px-3 py-2">
          <button
            onClick={() => {
              if (!leaving) {
                setLeaving(true);
                setTimeout(() => setLeaving(false), 3000);
                return;
              }
              void onLeave();
            }}
            className={`flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              leaving ? "bg-ink-100 text-ink-950" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            }`}
          >
            <LogOut className="h-3.5 w-3.5" />
            {leaving ? "Click again to leave this room" : "Leave room"}
          </button>
        </div>
      )}
    </div>
  );
}