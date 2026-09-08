import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function Page() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
      <SignIn />
    </div>
  );
}