import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";
import { getPrescriptionOrThrow } from "@/services/prescriptions";
import { getPatientOrThrow } from "@/services/patients";

export async function generateMetadata({
  params,
}: PageProps<"/prescriptions/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await loadContext("prescription.read");
  const prescription = await getPrescriptionOrThrow(ctx, id);
  const patient = await getPatientOrThrow(ctx, prescription.patientId);
  return { title: `Prescription · ${patient.fullName}` };
}

export default async function PrescriptionDetailPage({
  params,
}: PageProps<"/prescriptions/[id]">) {
  const { id } = await params;
  const ctx = await loadContext("prescription.read");
  const prescription = await getPrescriptionOrThrow(ctx, id);
  const patient = await getPatientOrThrow(ctx, prescription.patientId);

  const issuedAt = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(prescription.issuedAt);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href={`/patients/${patient.id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {patient.fullName}
      </Link>

      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Prescription
        </h1>
        <p className="text-muted-foreground text-sm">Issued {issuedAt}</p>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Medicines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {prescription.items.map((item) => (
            <div key={item.id} className="border-border border-b pb-3 text-sm last:border-0 last:pb-0">
              <p className="font-medium">{item.medicine}</p>
              <p className="text-muted-foreground">
                {[item.dosage, item.frequency, item.durationDays ? `${item.durationDays} days` : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
              {item.instructions ? (
                <p className="text-muted-foreground mt-0.5">{item.instructions}</p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {prescription.instructions ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {prescription.instructions}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
