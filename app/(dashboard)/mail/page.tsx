import type { Metadata } from "next";
import Link from "next/link";
import {
  FileTextIcon,
  MailIcon,
  PenSquareIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";

import { PatientEmailStatusBadge } from "@/app/(dashboard)/mail/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";
import {
  listPatientEmails,
  countDraftEmails,
  type PatientEmailStatus,
} from "@/services/mail";

export const metadata: Metadata = { title: "Patient Mail" };

const TABS: Array<{ label: string; value: PatientEmailStatus | "ALL" }> = [
  { label: "All Messages", value: "ALL" },
  { label: "Drafts", value: "DRAFT" },
  { label: "Sent / Outbox", value: "SENT" },
];

export default async function PatientMailPage({
  searchParams,
}: PageProps<"/mail">) {
  const ctx = await loadContext("patient_email.read");
  const params = await searchParams;

  const currentTab = (typeof params?.status === "string" ? params.status : "ALL") as PatientEmailStatus | "ALL";

  const [emails, draftCount] = await Promise.all([
    listPatientEmails(ctx, { status: currentTab }),
    countDraftEmails(ctx),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Patient Mail & Communications
          </h1>
          <p className="text-muted-foreground text-sm">
            AI-assisted message drafting, appointment reminders, and communication history.
          </p>
        </div>

        <Button asChild>
          <Link href="/mail/new">
            <PlusIcon className="mr-1.5 size-4" />
            Compose Email
          </Link>
        </Button>
      </header>

      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <MailIcon className="size-4" />
              Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">{emails.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <FileTextIcon className="size-4" />
              Pending Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">{draftCount}</p>
          </CardContent>
        </Card>

        <Card className="border-indigo-200/80 bg-indigo-50/20 dark:bg-indigo-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <SparklesIcon className="size-4 text-indigo-600 dark:text-indigo-400" />
              AI Draft Generator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold text-indigo-700 dark:text-indigo-300">
              Enabled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b pb-3">
        {TABS.map((tab) => {
          const isActive = currentTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/mail?status=${tab.value}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Email List */}
      {emails.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="space-y-3">
            <MailIcon className="text-muted-foreground mx-auto size-10 stroke-1" />
            <div className="space-y-1">
              <p className="font-medium">No patient emails found</p>
              <p className="text-muted-foreground text-sm">
                {currentTab !== "ALL"
                  ? `No emails found in this category.`
                  : "Create your first email draft or generate one using the AI assistant."}
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/mail/new">Compose New Email</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {emails.map((email) => {
                const isDraft = email.status === "DRAFT";

                return (
                  <li key={email.id}>
                    <Link
                      href={`/mail/${email.id}`}
                      className="hover:bg-muted/40 flex flex-col gap-3 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {email.patient.fullName}
                          </span>
                          <span className="text-muted-foreground text-xs font-mono">
                            &lt;{email.recipient}&gt;
                          </span>
                          <PatientEmailStatusBadge status={email.status} />
                          {email.generatedByAI ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              <SparklesIcon className="size-3" />
                              AI Draft
                            </span>
                          ) : null}
                        </div>

                        <p className="text-sm font-medium text-foreground/90">
                          {email.subject}
                        </p>

                        <p className="text-muted-foreground text-xs line-clamp-1">
                          {email.body}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div className="text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(email.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        {isDraft ? (
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                            <PenSquareIcon className="size-3.5" />
                            Edit
                          </Button>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
