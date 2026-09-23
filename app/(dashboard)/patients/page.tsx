import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, SearchIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleHasPermission } from "@/lib/auth/permissions";
import { loadContext } from "@/lib/server/guard";
import { calculateAge, listPatients, patientFilterSchema } from "@/services/patients";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({
  searchParams,
}: PageProps<"/patients">) {
  const ctx = await loadContext("patient.read");
  const params = await searchParams;

  const filter = patientFilterSchema.parse({
    search: typeof params.search === "string" ? params.search : undefined,
    status: typeof params.status === "string" ? params.status : undefined,
  });

  const patients = await listPatients(ctx, filter);
  const canCreate = roleHasPermission(ctx.role, "patient.create");

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Patients
          </h1>
          <p className="text-muted-foreground text-sm">
            {patients.length} {filter.status === "ACTIVE" ? "active " : ""}
            {patients.length === 1 ? "patient" : "patients"}
          </p>
        </div>

        {canCreate ? (
          <Button asChild>
            <Link href="/patients/new">
              <PlusIcon aria-hidden="true" />
              Add patient
            </Link>
          </Button>
        ) : null}
      </header>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="search"
            placeholder="Search by name, phone or email"
            defaultValue={filter.search ?? ""}
            className="pl-8"
          />
        </div>
        <input type="hidden" name="status" value={filter.status} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        <Link
          href={{
            pathname: "/patients",
            query: {
              search: filter.search ?? undefined,
              status: filter.status === "ACTIVE" ? "ALL" : "ACTIVE",
            },
          }}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          {filter.status === "ACTIVE" ? "Show inactive too" : "Active only"}
        </Link>
      </form>

      {patients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <UsersIcon className="text-muted-foreground size-8" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">
                {filter.search ? "No patients match that search." : "No patients yet."}
              </p>
              <p className="text-muted-foreground text-sm">
                {filter.search
                  ? "Try a different name, phone number or email."
                  : "Add your first patient to start building their record."}
              </p>
            </div>
            {canCreate && !filter.search ? (
              <Button asChild size="sm" className="mt-1">
                <Link href="/patients/new">
                  <PlusIcon aria-hidden="true" />
                  Add patient
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((patient) => {
                const age = calculateAge(patient.dateOfBirth);
                return (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="block whitespace-normal underline-offset-4 hover:underline"
                      >
                        {patient.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {age !== null ? age : "—"}
                    </TableCell>
                    <TableCell>
                      {patient.isActive ? (
                        <Badge variant="outline">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
