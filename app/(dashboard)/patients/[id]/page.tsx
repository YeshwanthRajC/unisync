import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, PencilIcon, PlusIcon } from "lucide-react";

import {
  deactivatePatientAction,
  reactivatePatientAction,
} from "@/app/(dashboard)/patients/actions";
import { AppointmentStatusBadge } from "@/app/(dashboard)/appointments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleHasPermission } from "@/lib/auth/permissions";
import { loadContext } from "@/lib/server/guard";
import {
  APPOINTMENT_TYPE_LABELS,
  listAppointmentsForPatient,
} from "@/services/appointments";
import { listConsultationsForPatient } from "@/services/consultations";
import { calculateAge, getPatientOrThrow, initialsFor } from "@/services/patients";
import { getCurrentOrganization } from "@/services/organizations";
import { listPrescriptionsForPatient } from "@/services/prescriptions";

export async function generateMetadata({
  params,
}: PageProps<"/patients/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await loadContext("patient.read");
  const patient = await getPatientOrThrow(ctx, id);
  return { title: patient.fullName };
}

const GENDER_LABEL: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNDISCLOSED: "Not disclosed",
};

export default async function PatientDetailPage({
  params,
}: PageProps<"/patients/[id]">) {
  const { id } = await params;
  const ctx = await loadContext("patient.read");
  const [patient, organization, appointments, consultations, prescriptions] =
    await Promise.all([
      getPatientOrThrow(ctx, id),
      getCurrentOrganization(ctx),
      roleHasPermission(ctx.role, "appointment.read")
        ? listAppointmentsForPatient(ctx, id)
        : Promise.resolve([]),
      roleHasPermission(ctx.role, "consultation.read")
        ? listConsultationsForPatient(ctx, id)
        : Promise.resolve([]),
      roleHasPermission(ctx.role, "prescription.read")
        ? listPrescriptionsForPatient(ctx, id)
        : Promise.resolve([]),
    ]);

  const age = calculateAge(patient.dateOfBirth);
  const canEdit = roleHasPermission(ctx.role, "patient.update");
  const canDeactivate = roleHasPermission(ctx.role, "patient.delete");
  const canScheduleAppointment = roleHasPermission(ctx.role, "appointment.create");
  const canRecordConsultation = roleHasPermission(ctx.role, "consultation.create");
  const canIssuePrescription = roleHasPermission(ctx.role, "prescription.create");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <Link
        href="/patients"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        Patients
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-full text-base font-medium">
            {initialsFor(patient.fullName)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">
                {patient.fullName}
              </h1>
              {patient.isActive ? (
                <Badge variant="outline">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {age !== null ? `${age} years old` : "Date of birth not on file"} ·{" "}
              {GENDER_LABEL[patient.gender]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/patients/${patient.id}/edit`}>
                <PencilIcon aria-hidden="true" />
                Edit
              </Link>
            </Button>
          ) : null}
          {canDeactivate && patient.isActive ? (
            <form action={deactivatePatientAction}>
              <input type="hidden" name="id" value={patient.id} />
              <Button type="submit" variant="destructive" size="sm">
                Deactivate
              </Button>
            </form>
          ) : null}
          {canEdit && !patient.isActive ? (
            <form action={reactivatePatientAction}>
              <input type="hidden" name="id" value={patient.id} />
              <Button type="submit" variant="outline" size="sm">
                Reactivate
              </Button>
            </form>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Phone" value={patient.phone} />
            <Row label="Email" value={patient.email} />
            <Row
              label="Address"
              value={[patient.addressLine, patient.city, patient.state, patient.postalCode]
                .filter(Boolean)
                .join(", ") || null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emergency contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Name" value={patient.emergencyContactName} />
            <Row label="Phone" value={patient.emergencyContactPhone} />
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {patient.notes ? (
              <p className="whitespace-pre-wrap">{patient.notes}</p>
            ) : (
              <p className="text-muted-foreground">No notes on file.</p>
            )}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Appointments</CardTitle>
            {canScheduleAppointment ? (
              <Button asChild size="sm" variant="outline">
                <Link href={{ pathname: "/appointments/new", query: { patientId: patient.id } }}>
                  <PlusIcon aria-hidden="true" />
                  Schedule
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="text-sm">
            {appointments.length === 0 ? (
              <p className="text-muted-foreground">No appointments yet.</p>
            ) : (
              <ul className="divide-y">
                {appointments.map((appointment) => (
                  <li key={appointment.id} className="flex items-center justify-between gap-3 py-2">
                    <Link
                      href={`/appointments/${appointment.id}`}
                      className="hover:underline underline-offset-4"
                    >
                      {new Intl.DateTimeFormat("en-IN", {
                        timeZone: organization.timezone,
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      }).format(appointment.scheduledAt)}{" "}
                      · {APPOINTMENT_TYPE_LABELS[appointment.type]}
                    </Link>
                    <AppointmentStatusBadge status={appointment.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Consultations</CardTitle>
            {canRecordConsultation ? (
              <Button asChild size="sm" variant="outline">
                <Link href={{ pathname: "/consultations/new", query: { patientId: patient.id } }}>
                  <PlusIcon aria-hidden="true" />
                  Record
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="text-sm">
            {consultations.length === 0 ? (
              <p className="text-muted-foreground">No consultations recorded yet.</p>
            ) : (
              <ul className="divide-y">
                {consultations.map((consultation) => (
                  <li key={consultation.id} className="flex items-center justify-between gap-3 py-2">
                    <Link
                      href={`/consultations/${consultation.id}`}
                      className="hover:underline underline-offset-4"
                    >
                      {new Intl.DateTimeFormat("en-IN", {
                        timeZone: organization.timezone,
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(consultation.consultedAt)}
                      {consultation.diagnosis ? ` · ${consultation.diagnosis}` : ""}
                    </Link>
                    {consultation.followUpNeeded ? (
                      <Badge variant="outline">Follow-up needed</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Prescriptions</CardTitle>
            {canIssuePrescription ? (
              <Button asChild size="sm" variant="outline">
                <Link href={{ pathname: "/prescriptions/new", query: { patientId: patient.id } }}>
                  <PlusIcon aria-hidden="true" />
                  Issue
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="text-sm">
            {prescriptions.length === 0 ? (
              <p className="text-muted-foreground">No prescriptions issued yet.</p>
            ) : (
              <ul className="divide-y">
                {prescriptions.map((prescription) => (
                  <li key={prescription.id} className="flex items-center justify-between gap-3 py-2">
                    <Link
                      href={`/prescriptions/${prescription.id}`}
                      className="hover:underline underline-offset-4"
                    >
                      {new Intl.DateTimeFormat("en-IN", {
                        timeZone: organization.timezone,
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(prescription.issuedAt)}{" "}
                      · {prescription.items.length}{" "}
                      {prescription.items.length === 1 ? "medicine" : "medicines"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value ?? "—"}</dd>
    </div>
  );
}
