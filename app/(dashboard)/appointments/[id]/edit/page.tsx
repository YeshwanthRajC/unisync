import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import { AppointmentForm } from "@/app/(dashboard)/appointments/appointment-form";
import { loadContext } from "@/lib/server/guard";
import {
  getAppointmentOrThrow,
  isEditable,
  utcToZonedInputValue,
} from "@/services/appointments";
import { getCurrentOrganization } from "@/services/organizations";
import { listPatients } from "@/services/patients";

export const metadata: Metadata = { title: "Edit appointment" };

export default async function EditAppointmentPage({
  params,
}: PageProps<"/appointments/[id]/edit">) {
  const { id } = await params;
  const ctx = await loadContext("appointment.update");
  const [appointment, organization, patients] = await Promise.all([
    getAppointmentOrThrow(ctx, id),
    getCurrentOrganization(ctx),
    listPatients(ctx, { status: "ACTIVE" }),
  ]);

  // Not an error page: a stale "Edit" link (or a status that changed in
  // another tab) should just land the person back on the current state of the
  // record, the same way a stale edit link for any other resource would.
  if (!isEditable(appointment.status)) {
    redirect(`/appointments/${appointment.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href={`/appointments/${appointment.id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {appointment.patient.fullName}
      </Link>

      <h1 className="font-heading mb-6 text-2xl font-semibold tracking-tight">
        Edit appointment
      </h1>

      <AppointmentForm
        patients={patients}
        defaults={{
          id: appointment.id,
          patientId: appointment.patientId,
          scheduledAt: utcToZonedInputValue(appointment.scheduledAt, organization.timezone),
          durationMinutes: appointment.durationMinutes,
          type: appointment.type,
          notes: appointment.notes,
        }}
      />
    </div>
  );
}
