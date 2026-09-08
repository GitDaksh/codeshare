import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function Page() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
      <SignUp />
    </div>
  );
}