"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { clerkAppearance, useTheme } from "@/lib/theme";

// Clerk's sign-in and sign-up cards, in the current theme.
export function ThemedSignIn() {
  const { theme } = useTheme();
  return <SignIn appearance={clerkAppearance(theme)} />;
}

export function ThemedSignUp() {
  const { theme } = useTheme();
  return <SignUp appearance={clerkAppearance(theme)} />;
}