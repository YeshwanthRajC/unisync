import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { PrescriptionForm } from "@/app/(dashboard)/prescriptions/prescription-form";
import { loadContext } from "@/lib/server/guard";
import { getPatientOrThrow } from "@/services/patients";

export const metadata: Metadata = { title: "Issue prescription" };

export default async function NewPrescriptionPage({
  searchParams,
}: PageProps<"/prescriptions/new">) {
  const ctx = await loadContext("prescription.create");
  const params = await searchParams;
  const patientId = typeof params.patientId === "string" ? params.patientId : "";
  const consultationId =
    typeof params.consultationId === "string" ? params.consultationId : undefined;

  const patient = await getPatientOrThrow(ctx, patientId);

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
        Issue prescription
      </h1>

      <PrescriptionForm patientId={patient.id} consultationId={consultationId} />
    </div>
  );
}
