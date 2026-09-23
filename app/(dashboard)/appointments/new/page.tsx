import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { AppointmentForm } from "@/app/(dashboard)/appointments/appointment-form";
import { loadContext } from "@/lib/server/guard";
import { listPatients } from "@/services/patients";

export const metadata: Metadata = { title: "Schedule appointment" };

export default async function NewAppointmentPage({
  searchParams,
}: PageProps<"/appointments/new">) {
  const ctx = await loadContext("appointment.create");
  const params = await searchParams;
  const patients = await listPatients(ctx, { status: "ACTIVE" });

  const patientId = typeof params.patientId === "string" ? params.patientId : undefined;
  const date = typeof params.date === "string" ? params.date : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href="/appointments"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        Appointments
      </Link>

      <h1 className="font-heading mb-6 text-2xl font-semibold tracking-tight">
        Schedule appointment
      </h1>

      {patients.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          There are no active patients yet.{" "}
          <Link href="/patients/new" className="text-foreground underline underline-offset-4">
            Add one
          </Link>{" "}
          before scheduling a visit.
        </p>
      ) : (
        <AppointmentForm
          patients={patients}
          defaults={{
            patientId,
            scheduledAt: date ? `${date}T09:00` : undefined,
          }}
        />
      )}
    </div>
  );
}
