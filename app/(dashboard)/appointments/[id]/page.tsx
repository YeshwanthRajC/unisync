import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, PencilIcon } from "lucide-react";

import { AppointmentStatusBadge } from "@/app/(dashboard)/appointments/status-badge";
import {
  confirmAppointmentAction,
  markNoShowAction,
  startAppointmentAction,
} from "@/app/(dashboard)/appointments/actions";
import { CancelAppointmentForm } from "@/app/(dashboard)/appointments/cancel-appointment-form";
import { CloseAppointmentForm } from "@/app/(dashboard)/appointments/close-appointment-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleHasPermission } from "@/lib/auth/permissions";
import { loadContext } from "@/lib/server/guard";
import {
  APPOINTMENT_TYPE_LABELS,
  canTransition,
  getAppointmentOrThrow,
  isEditable,
} from "@/services/appointments";
import { getCurrentOrganization } from "@/services/organizations";

export async function generateMetadata({
  params,
}: PageProps<"/appointments/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await loadContext("appointment.read");
  const appointment = await getAppointmentOrThrow(ctx, id);
  return { title: `${appointment.patient.fullName} · Appointment` };
}

export default async function AppointmentDetailPage({
  params,
}: PageProps<"/appointments/[id]">) {
  const { id } = await params;
  const ctx = await loadContext("appointment.read");
  const [appointment, organization] = await Promise.all([
    getAppointmentOrThrow(ctx, id),
    getCurrentOrganization(ctx),
  ]);

  const canUpdate = roleHasPermission(ctx.role, "appointment.update");
  const canCancel = roleHasPermission(ctx.role, "appointment.cancel");
  const canClose = roleHasPermission(ctx.role, "appointment.close");

  const dateTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: organization.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(appointment.scheduledAt);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href="/appointments"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        Appointments
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              <Link href={`/patients/${appointment.patient.id}`} className="hover:underline underline-offset-4">
                {appointment.patient.fullName}
              </Link>
            </h1>
            <AppointmentStatusBadge status={appointment.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            {dateTime} · {appointment.durationMinutes} min ·{" "}
            {APPOINTMENT_TYPE_LABELS[appointment.type]}
          </p>
        </div>

        {canUpdate && isEditable(appointment.status) ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/appointments/${appointment.id}/edit`}>
              <PencilIcon aria-hidden="true" />
              Edit
            </Link>
          </Button>
        ) : null}
      </header>

      {appointment.notes ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{appointment.notes}</CardContent>
        </Card>
      ) : null}

      {appointment.status === "COMPLETED" ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Visit outcome</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {appointment.outcomeNotes}
          </CardContent>
        </Card>
      ) : null}

      {appointment.status === "CANCELLED" ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Cancellation reason</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {appointment.cancellationReason}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-start gap-2">
        {canUpdate && canTransition(appointment.status, "CONFIRMED") ? (
          <form action={confirmAppointmentAction}>
            <input type="hidden" name="id" value={appointment.id} />
            <Button type="submit" variant="outline" size="sm">
              Confirm
            </Button>
          </form>
        ) : null}

        {canUpdate && canTransition(appointment.status, "IN_PROGRESS") ? (
          <form action={startAppointmentAction}>
            <input type="hidden" name="id" value={appointment.id} />
            <Button type="submit" variant="outline" size="sm">
              Start visit
            </Button>
          </form>
        ) : null}

        {canClose && canTransition(appointment.status, "COMPLETED") ? (
          <CloseAppointmentForm appointmentId={appointment.id} />
        ) : null}

        {canUpdate && canTransition(appointment.status, "NO_SHOW") ? (
          <form action={markNoShowAction}>
            <input type="hidden" name="id" value={appointment.id} />
            <Button type="submit" variant="outline" size="sm">
              Mark no-show
            </Button>
          </form>
        ) : null}

        {canCancel && canTransition(appointment.status, "CANCELLED") ? (
          <CancelAppointmentForm appointmentId={appointment.id} />
        ) : null}
      </div>
    </div>
  );
}
