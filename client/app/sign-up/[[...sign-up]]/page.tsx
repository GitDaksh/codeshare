import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function Page() {
  return (
    <AuthShell>
      <SignUp />
    </AuthShell>
  );
}