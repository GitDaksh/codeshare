import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function Page() {
  return (
    <AuthShell>
      <SignIn />
    </AuthShell>
  );
}