import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, ReceiptIcon } from "lucide-react";

import { BillStatusBadge } from "@/app/(dashboard)/bills/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleHasPermission } from "@/lib/auth/permissions";
import { loadContext } from "@/lib/server/guard";
import {
  listBills,
  computeBalance,
} from "@/services/billing";
import { getCurrentOrganization } from "@/services/organizations";

export const metadata: Metadata = { title: "Bills" };

function formatCurrency(amount: { toString(): string }, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount.toString()));
}

export default async function BillsPage() {
  const ctx = await loadContext("bill.read");
  const [organization, bills] = await Promise.all([
    getCurrentOrganization(ctx),
    listBills(ctx),
  ]);

  const canCreate = roleHasPermission(ctx.role, "bill.create");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Bills</h1>
          <p className="text-muted-foreground text-sm">
            {bills.length} {bills.length === 1 ? "bill" : "bills"}
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/bills/new">
              <PlusIcon aria-hidden="true" />
              New bill
            </Link>
          </Button>
        ) : null}
      </header>

      {bills.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <ReceiptIcon className="text-muted-foreground size-12" aria-hidden="true" />
            <div>
              <p className="font-medium">No bills yet</p>
              <p className="text-muted-foreground text-sm">
                Bills will appear here once you create them.
              </p>
            </div>
            {canCreate ? (
              <Button asChild>
                <Link href="/bills/new">Create first bill</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All bills</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {bills.map((bill) => {
                const { balance } = computeBalance(bill.total, bill.payments);
                const isFullyPaid = balance.lte(0);

                return (
                  <li key={bill.id}>
                    <Link
                      href={`/bills/${bill.id}`}
                      className="hover:bg-muted/50 flex items-center justify-between gap-3 px-6 py-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{bill.patient.fullName}</span>
                          <BillStatusBadge status={bill.status} />
                          {bill.status === "ISSUED" && isFullyPaid ? (
                            <Badge variant="outline" className="text-green-700 border-green-300">
                              Paid
                            </Badge>
                          ) : bill.status === "ISSUED" && !isFullyPaid ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">
                              Outstanding
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {bill.number} ·{" "}
                          {bill.issuedAt
                            ? new Intl.DateTimeFormat("en-IN", {
                                timeZone: organization.timezone,
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }).format(bill.issuedAt)
                            : "Draft"}{" "}
                          · {bill.items.length}{" "}
                          {bill.items.length === 1 ? "item" : "items"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(bill.total, organization.currency)}
                        </p>
                        {bill.status === "ISSUED" && !isFullyPaid ? (
                          <p className="text-muted-foreground text-xs">
                            {formatCurrency(balance, organization.currency)} due
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
