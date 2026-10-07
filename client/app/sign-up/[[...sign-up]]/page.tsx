import type { Metadata } from "next";
import { ThemedSignUp } from "@/components/ThemedAuth";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function Page() {
  return (
    <AuthShell>
      <ThemedSignUp />
    </AuthShell>
  );
}