import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { MailComposer } from "@/app/(dashboard)/mail/mail-composer";
import { Button } from "@/components/ui/button";
import { loadContext } from "@/lib/server/guard";
import { listPatients, getPatientOrThrow } from "@/services/patients";

export const metadata: Metadata = { title: "Compose Email" };

export default async function NewPatientMailPage({
  searchParams,
}: PageProps<"/mail/new">) {
  const ctx = await loadContext("patient_email.draft");
  const params = await searchParams;

  const patientId = typeof params?.patientId === "string" ? params.patientId : undefined;

  let preselectedPatient: { id: string; fullName: string; email?: string | null } | null = null;
  if (patientId) {
    try {
      const patient = await getPatientOrThrow(ctx, patientId);
      preselectedPatient = {
        id: patient.id,
        fullName: patient.fullName,
        email: patient.email,
      };
    } catch {
      // Ignore if invalid
    }
  }

  const allPatients = preselectedPatient
    ? []
    : await listPatients(ctx, { status: "ACTIVE" });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/mail">
            <ChevronLeftIcon className="mr-1 size-4" />
            Back to Messages
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Compose Patient Email
        </h1>
        <p className="text-muted-foreground text-sm">
          Draft communications, instructions, or recalls with AI assistance.
        </p>
      </div>

      <MailComposer
        defaults={{
          patientId: preselectedPatient?.id,
          patientName: preselectedPatient?.fullName,
          recipient: preselectedPatient?.email ?? "",
        }}
        patients={allPatients.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          email: p.email,
        }))}
      />
    </div>
  );
}
