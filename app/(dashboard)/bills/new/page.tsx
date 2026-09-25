import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { BillForm } from "@/app/(dashboard)/bills/bill-form";
import { loadContext } from "@/lib/server/guard";
import { listPatients } from "@/services/patients";
import { getCurrentOrganization } from "@/services/organizations";

export const metadata: Metadata = { title: "New bill" };

export default async function NewBillPage({
  searchParams,
}: PageProps<"/bills/new">) {
  const ctx = await loadContext("bill.create");
  const params = await searchParams;
  const [patients, organization] = await Promise.all([
    listPatients(ctx, { status: "ACTIVE" }),
    getCurrentOrganization(ctx),
  ]);

  const patientId = typeof params.patientId === "string" ? params.patientId : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href="/bills"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        Bills
      </Link>

      <h1 className="font-heading mb-6 text-2xl font-semibold tracking-tight">
        New bill
      </h1>

      {patients.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          There are no active patients yet.{" "}
          <Link href="/patients/new" className="text-foreground underline underline-offset-4">
            Add one
          </Link>{" "}
          before creating a bill.
        </p>
      ) : (
        <BillForm
          patients={patients}
          defaults={{ patientId }}
          currency={organization.currency}
        />
      )}
    </div>
  );
}
