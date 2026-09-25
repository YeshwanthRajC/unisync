import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { BillStatusBadge } from "@/app/(dashboard)/bills/status-badge";
import { ConfirmPaymentForm } from "@/app/(dashboard)/bills/confirm-payment-form";
import { VoidBillForm } from "@/app/(dashboard)/bills/void-bill-form";
import { RecordPaymentForm } from "@/app/(dashboard)/bills/record-payment-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleHasPermission } from "@/lib/auth/permissions";
import { loadContext } from "@/lib/server/guard";
import {
  getBillOrThrow,
  computeBalance,
  PAYMENT_METHOD_LABELS,
} from "@/services/billing";
import { getCurrentOrganization } from "@/services/organizations";

export async function generateMetadata({
  params,
}: PageProps<"/bills/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await loadContext("bill.read");
  const bill = await getBillOrThrow(ctx, id);
  return { title: `${bill.number} · Bill` };
}

function formatCurrency(amount: { toString(): string }, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount.toString()));
}

export default async function BillDetailPage({
  params,
}: PageProps<"/bills/[id]">) {
  const { id } = await params;
  const ctx = await loadContext("bill.read");
  const [bill, organization] = await Promise.all([
    getBillOrThrow(ctx, id),
    getCurrentOrganization(ctx),
  ]);

  const canVoid = roleHasPermission(ctx.role, "bill.void");
  const canRecordPayment = roleHasPermission(ctx.role, "payment.record");
  const canConfirmPayment = roleHasPermission(ctx.role, "payment.confirm");

  const { amountPaid, balance } = computeBalance(bill.total, bill.payments);
  const isFullyPaid = balance.lte(0);

  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: organization.timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href="/bills"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        Bills
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {bill.number}
            </h1>
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
          <p className="text-muted-foreground text-sm">
            <Link
              href={`/patients/${bill.patient.id}`}
              className="hover:underline underline-offset-4"
            >
              {bill.patient.fullName}
            </Link>
            {bill.issuedAt ? ` · Issued ${dateFormatter.format(bill.issuedAt)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canVoid && bill.status !== "VOID" ? (
            <VoidBillForm billId={bill.id} />
          ) : null}
        </div>
      </header>

      {/* Line items */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Services</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-muted-foreground px-6 py-2 text-left font-medium">
                  Description
                </th>
                <th className="text-muted-foreground px-4 py-2 text-right font-medium">
                  Qty
                </th>
                <th className="text-muted-foreground px-4 py-2 text-right font-medium">
                  Unit price
                </th>
                <th className="text-muted-foreground px-6 py-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-6 py-2">{item.description}</td>
                  <td className="px-4 py-2 text-right">
                    {item.quantity.toString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(item.unitPrice, organization.currency)}
                  </td>
                  <td className="px-6 py-2 text-right">
                    {formatCurrency(item.lineTotal, organization.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="mb-4">
        <CardContent className="space-y-1.5 pt-6 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(bill.subtotal, organization.currency)}</span>
          </div>
          {bill.discount.gt(0) ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>−{formatCurrency(bill.discount, organization.currency)}</span>
            </div>
          ) : null}
          {bill.tax.gt(0) ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(bill.tax, organization.currency)}</span>
            </div>
          ) : null}
          <div className="border-t pt-1.5 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCurrency(bill.total, organization.currency)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Paid (confirmed)</span>
            <span>{formatCurrency(amountPaid, organization.currency)}</span>
          </div>
          <div
            className={`flex justify-between font-medium ${
              balance.gt(0) ? "text-amber-700" : "text-green-700"
            }`}
          >
            <span>Balance due</span>
            <span>{formatCurrency(balance, organization.currency)}</span>
          </div>
        </CardContent>
      </Card>

      {bill.notes ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{bill.notes}</CardContent>
        </Card>
      ) : null}

      {bill.status === "VOID" && bill.voidReason ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Void reason</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{bill.voidReason}</CardContent>
        </Card>
      ) : null}

      {/* Payments */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Payments</CardTitle>
          {canRecordPayment && bill.status !== "VOID" ? (
            <RecordPaymentForm billId={bill.id} currency={organization.currency} />
          ) : null}
        </CardHeader>
        <CardContent>
          {bill.payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y">
              {bill.payments.map((payment) => (
                <li key={payment.id} className="space-y-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatCurrency(payment.amount, organization.currency)}
                        </span>
                        <Badge
                          variant={
                            payment.status === "CONFIRMED"
                              ? "default"
                              : payment.status === "REFUNDED"
                                ? "secondary"
                                : payment.status === "FAILED"
                                  ? "destructive"
                                  : "outline"
                          }
                        >
                          {payment.status.charAt(0) +
                            payment.status.slice(1).toLowerCase()}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {PAYMENT_METHOD_LABELS[payment.method]}{" "}
                        {payment.reference ? `· ${payment.reference}` : ""} ·{" "}
                        {dateFormatter.format(payment.recordedAt)}
                      </p>
                      {payment.notes ? (
                        <p className="text-muted-foreground text-xs">{payment.notes}</p>
                      ) : null}
                      {payment.status === "CONFIRMED" && payment.confirmedAt ? (
                        <p className="text-muted-foreground text-xs">
                          Confirmed {dateFormatter.format(payment.confirmedAt)}
                        </p>
                      ) : null}
                      {payment.status === "REFUNDED" && payment.refundReason ? (
                        <p className="text-muted-foreground text-xs">
                          Refunded: {payment.refundReason}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* The confirm-payment manual gate */}
                  {canConfirmPayment && payment.status === "RECORDED" ? (
                    <ConfirmPaymentForm paymentId={payment.id} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
