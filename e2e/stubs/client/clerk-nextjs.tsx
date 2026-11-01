"use client";
// Test-only stand-in for @clerk/nextjs. The signed-in user is the
// "cs-test-user" cookie (set by the tests). Like real Clerk, auth isn't
// "loaded" during server rendering and hydration, so pages hydrate cleanly.
import { useSyncExternalStore, type ReactNode } from "react";

function cookieUser(): string {
  const match = /(?:^|; )cs-test-user=([A-Za-z0-9_-]{1,40})/.exec(document.cookie);
  return match ? match[1] : "";
}
const subscribe = () => () => {};
function useName(): string | null {
  return useSyncExternalStore(subscribe, cookieUser, () => null);
}
// Like Clerk's, the token getter is one stable function that waits for
// nothing: it reads the signed-in user whenever it's called.
const getToken = async () => {
  if (typeof document === "undefined") return null;
  const name = cookieUser();
  return name ? `test:${name}` : null;
};

export function ClerkProvider({ children }: { children: ReactNode; [key: string]: unknown }) {
  return <>{children}</>;
}
export function useAuth() {
  const name = useName();
  return {
    isLoaded: name !== null,
    isSignedIn: name === null ? undefined : !!name,
    userId: name ? `user_${name}` : null,
    getToken,
  };
}
const users = new Map<string, unknown>();
export function useUser() {
  const name = useName();
  if (name && !users.has(name)) {
    users.set(name, { id: `user_${name}`, fullName: name, username: name, primaryEmailAddress: { emailAddress: `${name}@test.dev` } });
  }
  return { isLoaded: name !== null, isSignedIn: name === null ? undefined : !!name, user: name ? users.get(name) : null };
}
const clerk = {
  signOut: async () => {
    document.cookie = "cs-test-user=; Max-Age=0; path=/";
    location.href = "/";
  },
  openUserProfile: () => {},
  openSignIn: () => {},
};
export function useClerk() {
  return clerk;
}
export function SignIn() {
  return <div data-test="sign-in">Sign in (test stub)</div>;
}
export function SignUp() {
  return <div data-test="sign-up">Sign up (test stub)</div>;
}
