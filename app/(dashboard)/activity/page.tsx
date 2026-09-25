import type { Metadata } from "next";
import Link from "next/link";
import {
  BotIcon,
  FilterIcon,
  HistoryIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";
import { listAuditLogs, type AuditLogFilters } from "@/services/audit";
import { getCurrentOrganization } from "@/services/organizations";

export const metadata: Metadata = { title: "Activity Audit Log" };

export default async function ActivityPage({
  searchParams,
}: PageProps<"/activity">) {
  const ctx = await loadContext("audit.read");
  const params = await searchParams;

  const actorType = (typeof params?.actor === "string" ? params.actor : "ALL") as AuditLogFilters["actorType"];
  const entityType = typeof params?.entity === "string" ? params.entity : "ALL";

  const [logs, organization] = await Promise.all([
    listAuditLogs(ctx, { actorType, entityType }),
    getCurrentOrganization(ctx),
  ]);

  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: organization.timezone,
    dateStyle: "medium",
    timeStyle: "medium",
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-6 text-primary" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Activity & Audit Log
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Immutable audit record of clinical transactions, staff actions, and AI-assisted operations in {organization.name}.
        </p>
      </header>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 mr-2">
          <FilterIcon className="size-3" /> Filter by:
        </span>
        <Button
          variant={actorType === "ALL" ? "secondary" : "ghost"}
          size="sm"
          asChild
          className="text-xs h-7"
        >
          <Link href="/activity">All Operations</Link>
        </Button>
        <Button
          variant={actorType === "USER" ? "secondary" : "ghost"}
          size="sm"
          asChild
          className="text-xs h-7"
        >
          <Link href="/activity?actor=USER">Staff Actions</Link>
        </Button>
        <Button
          variant={actorType === "AI_AGENT" ? "secondary" : "ghost"}
          size="sm"
          asChild
          className="text-xs h-7"
        >
          <Link href="/activity?actor=AI_AGENT">AI Assistant Invocations</Link>
        </Button>
      </div>

      {/* Activity Timeline */}
      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No audit log entries matching this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-4 text-xs transition-colors hover:border-primary/30"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {log.actorType === "AI_AGENT" ? (
                    <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <BotIcon className="size-4" />
                    </div>
                  ) : (
                    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <UserIcon className="size-4" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground text-sm font-mono">
                      {log.action}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 px-1.5 ${
                        log.actorType === "AI_AGENT"
                          ? "border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/20"
                          : "border-primary/30 text-primary bg-primary/10"
                      }`}
                    >
                      {log.actorType === "AI_AGENT"
                        ? `AI: ${log.aiToolName ?? "agent"}`
                        : log.actorProfile?.fullName ?? "Staff"}
                    </Badge>
                    {log.entityType && (
                      <span className="text-[11px] text-muted-foreground">
                        targeted <strong className="text-foreground">{log.entityType}</strong>
                      </span>
                    )}
                  </div>

                  {log.metadata && typeof log.metadata === "object" && (
                    <p className="font-mono text-[11px] text-muted-foreground break-all">
                      {JSON.stringify(log.metadata)}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right text-[11px] text-muted-foreground sm:self-center">
                <div className="flex items-center gap-1 sm:justify-end">
                  <ShieldCheckIcon className="size-3 text-emerald-600" />
                  <span>Verified Transaction</span>
                </div>
                <span>{dateFormatter.format(new Date(log.createdAt))}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
