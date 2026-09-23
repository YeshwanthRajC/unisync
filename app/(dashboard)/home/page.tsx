import type { Metadata } from "next";
import Link from "next/link";
import { UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";
import { getCurrentOrganization } from "@/services/organizations";
import {
  calculateAge,
  countActivePatients,
  listRecentPatients,
} from "@/services/patients";

export const metadata: Metadata = { title: "Home" };

/**
 * Organization Pulse.
 *
 * Grows a tile per module as it ships — this is the FIRST one, driven by the
 * patients module. A module with no service yet has no tile here, rather than
 * a "coming soon" placeholder: an empty state belongs to a page that can
 * actually be empty, and this dashboard cannot yet ask a question it has no
 * service to answer.
 */
export default async function HomePage() {
  const ctx = await loadContext("organization.read");
  const [organization, activePatients, recentPatients] = await Promise.all([
    getCurrentOrganization(ctx),
    countActivePatients(ctx),
    listRecentPatients(ctx, 5),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {organization.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Signed in as {ctx.user.email} · {ctx.role}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/patients" className="sm:col-span-1">
          <Card className="h-full transition-shadow hover:shadow-sm">
            <CardHeader>
              <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <UsersIcon className="size-4" aria-hidden="true" />
                Active patients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-heading text-3xl font-semibold">
                {activePatients}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recently added patients</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPatients.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No patients yet.{" "}
                <Link
                  href="/patients/new"
                  className="text-foreground underline underline-offset-4"
                >
                  Add your first one
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y">
                {recentPatients.map((patient) => {
                  const age = calculateAge(patient.dateOfBirth);
                  return (
                    <li key={patient.id} className="flex items-center justify-between py-2 text-sm">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-medium hover:underline underline-offset-4"
                      >
                        {patient.fullName}
                      </Link>
                      <span className="text-muted-foreground flex items-center gap-2">
                        {age !== null ? <Badge variant="outline">{age}y</Badge> : null}
                        {patient.phone ?? "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
