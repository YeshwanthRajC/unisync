import type { Metadata } from "next";
import {
  AlertCircleIcon,
  BarChart3Icon,
  BoxesIcon,
  CalendarCheckIcon,
  CheckCircle2Icon,
  DollarSignIcon,
  ListTodoIcon,
  UsersIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";
import { getCurrentOrganization } from "@/services/organizations";
import { getClinicReportsData } from "@/services/reports";

export const metadata: Metadata = { title: "Reports & Analytics" };

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ReportsPage() {
  const ctx = await loadContext("report.read");
  const [data, organization] = await Promise.all([
    getClinicReportsData(ctx),
    getCurrentOrganization(ctx),
  ]);

  const collectionRate =
    data.financialSummary.totalBilled > 0
      ? Math.round(
          (data.financialSummary.totalCollected /
            data.financialSummary.totalBilled) *
            100,
        )
      : 100;

  const completionRate =
    data.appointmentsSummary.total > 0
      ? Math.round(
          (data.appointmentsSummary.completed /
            data.appointmentsSummary.total) *
            100,
        )
      : 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <BarChart3Icon className="size-6 text-primary" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Clinic Reports & Performance
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Real-time financial, operational, and patient care metrics for {organization.name}.
        </p>
      </header>

      {/* Top Level KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue Collected */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Collections
            </CardTitle>
            <DollarSignIcon className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">
              {formatCurrency(data.financialSummary.totalCollected, organization.currency)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {collectionRate}% collection rate across all bills
            </p>
          </CardContent>
        </Card>

        {/* Outstanding Receivables */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Outstanding Balance
            </CardTitle>
            <AlertCircleIcon className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">
              {formatCurrency(data.financialSummary.outstandingBalance, organization.currency)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Unpaid from {data.financialSummary.billsCount} issued bills
            </p>
          </CardContent>
        </Card>

        {/* Active Patients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Active Patients
            </CardTitle>
            <UsersIcon className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">
              {data.activePatientCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {data.patientCount} total registrations
            </p>
          </CardContent>
        </Card>

        {/* Appointment Completion */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Appointment Rate
            </CardTitle>
            <CalendarCheckIcon className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">
              {completionRate}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {data.appointmentsSummary.completed} completed of {data.appointmentsSummary.total} booked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operations & Breakdown Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Appointments Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Appointment Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                  Completed Consultations
                </span>
                <span className="font-semibold">{data.appointmentsSummary.completed}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${data.appointmentsSummary.total > 0 ? (data.appointmentsSummary.completed / data.appointmentsSummary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5">
                  <CalendarCheckIcon className="size-3.5 text-primary" />
                  Upcoming / Scheduled
                </span>
                <span className="font-semibold">{data.appointmentsSummary.upcoming}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${data.appointmentsSummary.total > 0 ? (data.appointmentsSummary.upcoming / data.appointmentsSummary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertCircleIcon className="size-3.5 text-amber-500" />
                  Cancelled by Patient / Clinic
                </span>
                <span className="font-semibold">{data.appointmentsSummary.cancelled}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${data.appointmentsSummary.total > 0 ? (data.appointmentsSummary.cancelled / data.appointmentsSummary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertCircleIcon className="size-3.5 text-destructive" />
                  No Show
                </span>
                <span className="font-semibold">{data.appointmentsSummary.noShow}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-destructive rounded-full"
                  style={{
                    width: `${data.appointmentsSummary.total > 0 ? (data.appointmentsSummary.noShow / data.appointmentsSummary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collections by Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Collections by Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.paymentMethods.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No confirmed payments recorded yet.
              </p>
            ) : (
              data.paymentMethods.map((pm) => {
                const pct =
                  data.financialSummary.totalCollected > 0
                    ? Math.round(
                        (pm.totalAmount / data.financialSummary.totalCollected) *
                          100,
                      )
                    : 0;
                return (
                  <div key={pm.method} className="space-y-1.5 text-xs">
                    <div className="flex justify-between font-medium">
                      <span>{pm.method}</span>
                      <span>
                        {formatCurrency(pm.totalAmount, organization.currency)} ({pm.count} txns · {pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary/80 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Inventory Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">
              Inventory & Supply Status
            </CardTitle>
            <BoxesIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-xs">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Total Active SKU Catalog:</span>
              <span className="font-semibold">{data.inventorySummary.totalItems} items</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Items Needing Reorder:</span>
              <span
                className={`font-semibold ${
                  data.inventorySummary.lowStockCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600"
                }`}
              >
                {data.inventorySummary.lowStockCount} items
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Thresholds are evaluated against minimum safe stocking levels per clinic guidelines.
            </p>
          </CardContent>
        </Card>

        {/* Follow-ups & Recalls */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">
              Patient Care Follow-ups
            </CardTitle>
            <ListTodoIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-xs">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Pending Upcoming:</span>
              <span className="font-semibold">{data.followUpsSummary.pending} tasks</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Due Today:</span>
              <span className="font-semibold text-primary">{data.followUpsSummary.due} tasks</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Overdue (Needs Action):</span>
              <span
                className={`font-semibold ${
                  data.followUpsSummary.overdue > 0
                    ? "text-destructive"
                    : "text-emerald-600"
                }`}
              >
                {data.followUpsSummary.overdue} tasks
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed Recalls:</span>
              <span className="font-semibold text-emerald-600">{data.followUpsSummary.completed} tasks</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
