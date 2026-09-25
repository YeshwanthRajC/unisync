import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  ListTodoIcon,
  PlusIcon,
  UserIcon,
} from "lucide-react";

import { FollowUpStatusBadge } from "@/app/(dashboard)/followups/status-badge";
import {
  CompleteFollowUpButton,
  CancelFollowUpButton,
} from "@/app/(dashboard)/followups/complete-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";
import {
  listFollowUps,
  countOpenFollowUps,
  countOverdueFollowUps,
  type FollowUpStatus,
} from "@/services/followups";

export const metadata: Metadata = { title: "Follow-ups" };

const TABS: Array<{ label: string; value: FollowUpStatus | "ALL" }> = [
  { label: "All Active", value: "ALL" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Due Today", value: "DUE" },
  { label: "Pending", value: "PENDING" },
  { label: "Completed", value: "COMPLETED" },
];

export default async function FollowUpsPage({
  searchParams,
}: PageProps<"/followups">) {
  const ctx = await loadContext("followup.read");
  const params = await searchParams;

  const currentTab = (typeof params?.status === "string" ? params.status : "ALL") as FollowUpStatus | "ALL";

  const [followUps, openCount, overdueCount] = await Promise.all([
    listFollowUps(ctx, { status: currentTab }),
    countOpenFollowUps(ctx),
    countOverdueFollowUps(ctx),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Follow-ups & Recalls
          </h1>
          <p className="text-muted-foreground text-sm">
            Keep track of patient check-ups, post-operative recalls, and treatment reviews.
          </p>
        </div>

        <Button asChild>
          <Link href="/followups/new">
            <PlusIcon className="mr-1.5 size-4" />
            Schedule Follow-up
          </Link>
        </Button>
      </header>

      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className={overdueCount > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <AlertCircleIcon className={overdueCount > 0 ? "size-4 text-destructive" : "size-4"} />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`font-heading text-2xl font-semibold ${overdueCount > 0 ? "text-destructive" : ""}`}>
              {overdueCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <ClockIcon className="size-4" />
              Total Open Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">{openCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <CheckCircle2Icon className="size-4 text-green-600" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold text-green-700 dark:text-green-400">
              Active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b pb-3">
        {TABS.map((tab) => {
          const isActive = currentTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/followups?status=${tab.value}`}
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

      {/* Follow-ups List */}
      {followUps.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="space-y-3">
            <ListTodoIcon className="text-muted-foreground mx-auto size-10 stroke-1" />
            <div className="space-y-1">
              <p className="font-medium">No follow-ups found</p>
              <p className="text-muted-foreground text-sm">
                {currentTab !== "ALL"
                  ? `No follow-ups currently in ${currentTab.toLowerCase()} status.`
                  : "You have no scheduled follow-ups. Set recalls after treatments or visits."}
              </p>
            </div>
            {currentTab === "ALL" ? (
              <Button asChild size="sm">
                <Link href="/followups/new">Schedule First Follow-up</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/followups">View All Follow-ups</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {followUps.map((item) => {
                const isOverdue = item.status === "OVERDUE";
                const isDone = item.status === "COMPLETED";
                const isCancelled = item.status === "CANCELLED";
                const isOpen = !isDone && !isCancelled;

                const formattedDate = new Date(item.dueDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <li
                    key={item.id}
                    className={`flex flex-col gap-4 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      isOverdue ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/patients/${item.patientId}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {item.patient.fullName}
                        </Link>
                        <FollowUpStatusBadge status={item.status} />
                      </div>

                      <p className="text-sm font-medium text-foreground/90">
                        {item.reason}
                      </p>

                      {item.notes ? (
                        <p className="text-muted-foreground text-xs italic">
                          &ldquo;{item.notes}&rdquo;
                        </p>
                      ) : null}

                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="flex items-center gap-1 font-mono">
                          <CalendarIcon className="size-3" />
                          Due: {formattedDate}
                        </span>
                        {item.patient.phone ? <span>Phone: {item.patient.phone}</span> : null}
                        {item.assignedTo ? (
                          <span className="flex items-center gap-1">
                            <UserIcon className="size-3" />
                            {item.assignedTo.fullName ?? item.assignedTo.email}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <>
                          <CompleteFollowUpButton followUpId={item.id} />
                          <CancelFollowUpButton followUpId={item.id} />
                        </>
                      ) : (
                        <div className="text-muted-foreground text-xs text-right">
                          {isDone && item.completedAt ? (
                            <span>
                              Completed on{" "}
                              {new Date(item.completedAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          ) : null}
                          {isCancelled ? <span>Cancelled</span> : null}
                        </div>
                      )}
                    </div>
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
