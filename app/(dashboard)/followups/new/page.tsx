import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { FollowUpForm } from "@/app/(dashboard)/followups/followup-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";
import { listPatients, getPatientOrThrow } from "@/services/patients";

export const metadata: Metadata = { title: "Schedule Follow-up" };

export default async function NewFollowUpPage({
  searchParams,
}: PageProps<"/followups/new">) {
  const ctx = await loadContext("followup.create");
  const params = await searchParams;

  const patientId = typeof params?.patientId === "string" ? params.patientId : undefined;
  const appointmentId = typeof params?.appointmentId === "string" ? params.appointmentId : undefined;
  const consultationId = typeof params?.consultationId === "string" ? params.consultationId : undefined;

  let preselectedPatient: { id: string; fullName: string } | null = null;
  if (patientId) {
    try {
      const patient = await getPatientOrThrow(ctx, patientId);
      preselectedPatient = { id: patient.id, fullName: patient.fullName };
    } catch {
      // Ignore if invalid
    }
  }

  const allPatients = preselectedPatient
    ? []
    : await listPatients(ctx, { status: "ACTIVE" });

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/followups">
            <ChevronLeftIcon className="mr-1 size-4" />
            Back to Follow-ups
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Schedule Follow-up
        </h1>
        <p className="text-muted-foreground text-sm">
          Plan a check-up, recall, or treatment review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Follow-up Details</CardTitle>
        </CardHeader>
        <CardContent>
          <FollowUpForm
            defaults={{
              patientId: preselectedPatient?.id,
              patientName: preselectedPatient?.fullName,
              appointmentId,
              consultationId,
            }}
            patients={allPatients.map((p) => ({
              id: p.id,
              fullName: p.fullName,
              phone: p.phone,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
