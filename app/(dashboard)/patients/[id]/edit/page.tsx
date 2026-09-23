import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { PatientForm } from "@/app/(dashboard)/patients/patient-form";
import { loadContext } from "@/lib/server/guard";
import { getPatientOrThrow } from "@/services/patients";

export const metadata: Metadata = { title: "Edit patient" };

export default async function EditPatientPage({
  params,
}: PageProps<"/patients/[id]/edit">) {
  const { id } = await params;
  const ctx = await loadContext("patient.update");
  const patient = await getPatientOrThrow(ctx, id);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href={`/patients/${patient.id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {patient.fullName}
      </Link>

      <h1 className="font-heading mb-6 text-2xl font-semibold tracking-tight">
        Edit patient
      </h1>

      <PatientForm defaults={patient} />
    </div>
  );
}
