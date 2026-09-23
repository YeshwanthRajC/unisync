import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { ConsultationForm } from "@/app/(dashboard)/consultations/consultation-form";
import { loadContext } from "@/lib/server/guard";
import { getConsultationOrThrow } from "@/services/consultations";
import { getPatientOrThrow } from "@/services/patients";

export const metadata: Metadata = { title: "Edit consultation" };

export default async function EditConsultationPage({
  params,
}: PageProps<"/consultations/[id]/edit">) {
  const { id } = await params;
  const ctx = await loadContext("consultation.update");
  const consultation = await getConsultationOrThrow(ctx, id);
  const patient = await getPatientOrThrow(ctx, consultation.patientId);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href={`/consultations/${consultation.id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {patient.fullName}
      </Link>

      <h1 className="font-heading mb-6 text-2xl font-semibold tracking-tight">
        Edit consultation
      </h1>

      <ConsultationForm
        defaults={{
          id: consultation.id,
          chiefComplaint: consultation.chiefComplaint,
          diagnosis: consultation.diagnosis,
          treatment: consultation.treatment,
          notes: consultation.notes,
          followUpNeeded: consultation.followUpNeeded,
        }}
      />
    </div>
  );
}
