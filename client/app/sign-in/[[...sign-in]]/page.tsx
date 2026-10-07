import type { Metadata } from "next";
import { ThemedSignIn } from "@/components/ThemedAuth";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function Page() {
  return (
    <AuthShell>
      <ThemedSignIn />
    </AuthShell>
  );
}