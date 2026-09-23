import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";

import { AppointmentStatusBadge } from "@/app/(dashboard)/appointments/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleHasPermission } from "@/lib/auth/permissions";
import { loadContext } from "@/lib/server/guard";
import {
  APPOINTMENT_TYPE_LABELS,
  appointmentDaySchema,
  dateKeyInZone,
  listAppointmentsForDay,
  shiftDateKey,
} from "@/services/appointments";
import { getCurrentOrganization } from "@/services/organizations";

export const metadata: Metadata = { title: "Appointments" };

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatDayHeading(dateKey: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export default async function AppointmentsPage({
  searchParams,
}: PageProps<"/appointments">) {
  const ctx = await loadContext("appointment.read");
  const organization = await getCurrentOrganization(ctx);
  const params = await searchParams;
  const { date } = appointmentDaySchema.parse({
    date: typeof params.date === "string" ? params.date : undefined,
  });

  const todayKey = dateKeyInZone(new Date(), organization.timezone);
  const dateKey = date ?? todayKey;

  const appointments = await listAppointmentsForDay(ctx, dateKey, organization.timezone);
  const canCreate = roleHasPermission(ctx.role, "appointment.create");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Appointments
          </h1>
          <p className="text-muted-foreground text-sm">
            {formatDayHeading(dateKey, organization.timezone)}
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href={{ pathname: "/appointments/new", query: { date: dateKey } }}>
              <PlusIcon aria-hidden="true" />
              Schedule
            </Link>
          </Button>
        ) : null}
      </header>

      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="outline" size="icon-sm">
          <Link href={{ pathname: "/appointments", query: { date: shiftDateKey(dateKey, -1) } }}>
            <ChevronLeftIcon aria-hidden="true" />
            <span className="sr-only">Previous day</span>
          </Link>
        </Button>
        <Button
          asChild
          variant={dateKey === todayKey ? "secondary" : "outline"}
          size="sm"
        >
          <Link href={{ pathname: "/appointments", query: { date: todayKey } }}>Today</Link>
        </Button>
        <Button asChild variant="outline" size="icon-sm">
          <Link href={{ pathname: "/appointments", query: { date: shiftDateKey(dateKey, 1) } }}>
            <ChevronRightIcon aria-hidden="true" />
            <span className="sr-only">Next day</span>
          </Link>
        </Button>
      </div>

      {appointments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <CalendarDaysIcon className="text-muted-foreground size-8" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">Nothing scheduled for this day.</p>
              <p className="text-muted-foreground text-sm">
                {canCreate ? "Schedule a visit to fill this page in." : "Check another day."}
              </p>
            </div>
            {canCreate ? (
              <Button asChild size="sm" className="mt-1">
                <Link href={{ pathname: "/appointments/new", query: { date: dateKey } }}>
                  <PlusIcon aria-hidden="true" />
                  Schedule
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {formatTime(appointment.scheduledAt, organization.timezone)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/appointments/${appointment.id}`}
                      className="hover:underline underline-offset-4"
                    >
                      {appointment.patient.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {APPOINTMENT_TYPE_LABELS[appointment.type]}
                  </TableCell>
                  <TableCell>
                    <AppointmentStatusBadge status={appointment.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
