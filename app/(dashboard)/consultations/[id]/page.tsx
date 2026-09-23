import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleHasPermission } from "@/lib/auth/permissions";
import { loadContext } from "@/lib/server/guard";
import { getConsultationOrThrow } from "@/services/consultations";
import { getPatientOrThrow } from "@/services/patients";

export async function generateMetadata({
  params,
}: PageProps<"/consultations/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await loadContext("consultation.read");
  const consultation = await getConsultationOrThrow(ctx, id);
  const patient = await getPatientOrThrow(ctx, consultation.patientId);
  return { title: `Consultation · ${patient.fullName}` };
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-sm font-medium">{label}</dt>
      <dd className="text-sm whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

export default async function ConsultationDetailPage({
  params,
}: PageProps<"/consultations/[id]">) {
  const { id } = await params;
  const ctx = await loadContext("consultation.read");
  const consultation = await getConsultationOrThrow(ctx, id);
  const patient = await getPatientOrThrow(ctx, consultation.patientId);
  const canEdit = roleHasPermission(ctx.role, "consultation.update");

  const consultedAt = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(consultation.consultedAt);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href={`/patients/${patient.id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {patient.fullName}
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Consultation
          </h1>
          <p className="text-muted-foreground text-sm">
            {consultedAt}
            {consultation.followUpNeeded ? (
              <>
                {" "}
                · <Badge variant="outline">Follow-up needed</Badge>
              </>
            ) : null}
          </p>
        </div>
        {canEdit ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/consultations/${consultation.id}/edit`}>
              <PencilIcon aria-hidden="true" />
              Edit
            </Link>
          </Button>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <Field label="Chief complaint" value={consultation.chiefComplaint} />
            <Field label="Diagnosis" value={consultation.diagnosis} />
            <Field label="Treatment given" value={consultation.treatment} />
            <Field label="Notes" value={consultation.notes} />
          </dl>
          {!consultation.chiefComplaint &&
          !consultation.diagnosis &&
          !consultation.treatment &&
          !consultation.notes ? (
            <p className="text-muted-foreground text-sm">Nothing recorded yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
