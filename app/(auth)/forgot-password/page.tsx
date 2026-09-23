import Link from "next/link";
import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="text-muted-foreground text-sm">
          We&apos;ll email you a link to choose a new one.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-muted-foreground text-sm">
        <Link
          href="/sign-in"
          className="text-foreground hover:text-primary font-medium underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
