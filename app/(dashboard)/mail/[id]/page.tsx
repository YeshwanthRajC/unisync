import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircleIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  FileTextIcon,
  MailIcon,
  ReceiptIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react";

import { DeleteDraftButton } from "@/app/(dashboard)/mail/delete-draft-button";
import { SendEmailButton } from "@/app/(dashboard)/mail/send-button";
import { PatientEmailStatusBadge } from "@/app/(dashboard)/mail/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";
import { getPatientEmailOrThrow } from "@/services/mail";
import { getCurrentOrganization } from "@/services/organizations";

export async function generateMetadata({
  params,
}: PageProps<"/mail/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await loadContext("patient_email.read");
  const email = await getPatientEmailOrThrow(ctx, id);
  return { title: `${email.subject} · Patient Mail` };
}

export default async function PatientEmailDetailPage({
  params,
}: PageProps<"/mail/[id]">) {
  const { id } = await params;
  const ctx = await loadContext("patient_email.read");
  const [email, organization] = await Promise.all([
    getPatientEmailOrThrow(ctx, id),
    getCurrentOrganization(ctx),
  ]);

  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: organization.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });

  const isDraft = email.status === "DRAFT";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      {/* Back Link */}
      <div>
        <Link
          href="/mail"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ChevronLeftIcon className="size-4" />
          Back to Patient Mail
        </Link>
      </div>

      {/* Header Banner */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {email.subject}
            </h1>
            <PatientEmailStatusBadge status={email.status} />
            {email.generatedByAI && (
              <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                <SparklesIcon className="size-3" />
                AI Generated
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Created on {dateFormatter.format(new Date(email.createdAt))}
          </p>
        </div>

        {/* Manual Gate Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && <DeleteDraftButton emailId={email.id} />}
          {(isDraft || email.status === "FAILED") && (
            <SendEmailButton emailId={email.id} />
          )}
        </div>
      </header>

      {/* Informational Alerts */}
      {email.status === "SENT" && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="space-y-1">
            <p className="font-medium">Message Dispatched via Brevo</p>
            <p className="text-muted-foreground text-xs">
              This email was delivered to {email.recipient}.
              {email.providerMessageId ? ` (Provider ID: ${email.providerMessageId})` : ""}
            </p>
          </div>
        </div>
      )}

      {email.status === "FAILED" && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <div className="space-y-1">
            <p className="font-medium">Email Delivery Failed</p>
            <p className="text-muted-foreground text-xs">
              {email.failureReason || "Could not deliver email through Brevo. You can retry sending above."}
            </p>
          </div>
        </div>
      )}

      {email.status === "PROVIDER_NOT_CONFIGURED" && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium">Message Confirmed (Preview Environment)</p>
            <p className="text-muted-foreground text-xs">
              A clinician authorized sending this message. Because external email credentials were not configured at time of sending, the system logged the intent and recorded the dispatch without external delivery.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left: Email Message Body */}
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader className="border-b bg-muted/30 pb-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">To:</span>
                  <span className="font-medium">
                    {email.patient.fullName} &lt;{email.recipient}&gt;
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Subject:</span>
                  <span className="font-semibold text-foreground">{email.subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Status:</span>
                  <span>{email.status}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="rounded-md border bg-muted/10 p-6">
                <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {email.body}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Context & Linked Entities */}
        <div className="space-y-6">
          {/* Patient Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserIcon className="size-4" />
                Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">
                <Link
                  href={`/patients/${email.patient.id}`}
                  className="text-primary hover:underline"
                >
                  {email.patient.fullName}
                </Link>
              </p>
              <p className="text-muted-foreground">{email.recipient}</p>
              {email.patient.phone && (
                <p className="text-muted-foreground text-xs">{email.patient.phone}</p>
              )}
            </CardContent>
          </Card>

          {/* Linked Records */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Linked Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {email.appointment && (
                <div className="flex items-center gap-2 rounded-md border p-2.5">
                  <CalendarDaysIcon className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs">Appointment</p>
                    <Link
                      href={`/appointments/${email.appointment.id}`}
                      className="text-primary text-xs hover:underline truncate block"
                    >
                      {email.appointment.type} · {dateFormatter.format(new Date(email.appointment.scheduledAt))}
                    </Link>
                  </div>
                </div>
              )}

              {email.bill && (
                <div className="flex items-center gap-2 rounded-md border p-2.5">
                  <ReceiptIcon className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs">Bill #{email.bill.number}</p>
                    <Link
                      href={`/bills/${email.bill.id}`}
                      className="text-primary text-xs hover:underline truncate block"
                    >
                      View Invoice
                    </Link>
                  </div>
                </div>
              )}

              {email.followUp && (
                <div className="flex items-center gap-2 rounded-md border p-2.5">
                  <FileTextIcon className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs">Follow-up Task</p>
                    <Link
                      href="/followups"
                      className="text-primary text-xs hover:underline truncate block"
                    >
                      {email.followUp.reason}
                    </Link>
                  </div>
                </div>
              )}

              {!email.appointment && !email.bill && !email.followUp && (
                <p className="text-muted-foreground text-xs italic">
                  No linked clinical records attached.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Delivery & Security Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MailIcon className="size-4" />
                Delivery Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Draft Created:</span>
                <span>{dateFormatter.format(new Date(email.createdAt))}</span>
              </div>
              {email.sentAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent At:</span>
                  <span>{dateFormatter.format(new Date(email.sentAt))}</span>
                </div>
              )}
              {email.sentBy && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent By:</span>
                  <span>{email.sentBy.fullName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gate Enforced:</span>
                <span className="font-medium text-emerald-600">HumanIntent</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
