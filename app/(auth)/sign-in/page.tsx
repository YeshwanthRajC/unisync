import Link from "next/link";
import type { Metadata } from "next";

import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const LINK_ERRORS: Record<string, string> = {
  "link-expired":
    "That link has expired or was already used. Sign in, or request a new one.",
  "missing-code": "That link was incomplete. Please use the most recent email.",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="text-muted-foreground text-sm">
          Welcome back. Enter your details to continue.
        </p>
      </div>

      <SignInForm linkError={errorKey ? LINK_ERRORS[errorKey] : undefined} />

      <p className="text-muted-foreground text-sm">
        New to UniSync?{" "}
        <Link
          href="/sign-up"
          className="text-foreground font-medium underline underline-offset-4 hover:text-primary"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
