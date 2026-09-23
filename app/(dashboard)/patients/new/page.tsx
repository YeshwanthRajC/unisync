import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { PatientForm } from "@/app/(dashboard)/patients/patient-form";
import { loadContext } from "@/lib/server/guard";

export const metadata: Metadata = { title: "Add patient" };

export default async function NewPatientPage() {
  await loadContext("patient.create");

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href="/patients"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        Patients
      </Link>

      <h1 className="font-heading mb-6 text-2xl font-semibold tracking-tight">
        Add patient
      </h1>

      <PatientForm />
    </div>
  );
}
