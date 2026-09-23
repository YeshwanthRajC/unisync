import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, PencilIcon } from "lucide-react";

import {
  deactivatePatientAction,
  reactivatePatientAction,
} from "@/app/(dashboard)/patients/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleHasPermission } from "@/lib/auth/permissions";
import { loadContext } from "@/lib/server/guard";
import { calculateAge, getPatientOrThrow, initialsFor } from "@/services/patients";

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
  const patient = await getPatientOrThrow(ctx, id);

  const age = calculateAge(patient.dateOfBirth);
  const canEdit = roleHasPermission(ctx.role, "patient.update");
  const canDeactivate = roleHasPermission(ctx.role, "patient.delete");

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
