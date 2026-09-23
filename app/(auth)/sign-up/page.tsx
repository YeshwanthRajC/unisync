import Link from "next/link";
import type { Metadata } from "next";

import { SignUpForm } from "@/app/(auth)/sign-up/sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-muted-foreground text-sm">
          You&apos;ll set up your organization in the next step.
        </p>
      </div>

      <SignUpForm />

      <p className="text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-foreground hover:text-primary font-medium underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
