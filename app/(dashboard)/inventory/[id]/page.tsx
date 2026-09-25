import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  ClockIcon,
  HistoryIcon,
} from "lucide-react";

import { InventoryItemForm } from "@/app/(dashboard)/inventory/item-form";
import { RecordMovementForm } from "@/app/(dashboard)/inventory/record-movement-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";
import {
  getInventoryItemOrThrow,
  listMovementsForItem,
  STOCK_MOVEMENT_TYPE_LABELS,
  type StockMovementType,
} from "@/services/inventory";

export async function generateMetadata({
  params,
}: PageProps<"/inventory/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ctx = await loadContext("inventory.read");
  const item = await getInventoryItemOrThrow(ctx, id);
  return { title: item.name };
}

function movementBadgeVariant(
  type: StockMovementType,
): "default" | "secondary" | "outline" | "destructive" {
  switch (type) {
    case "STOCK_IN":
    case "RETURN":
      return "default";
    case "ADJUSTMENT":
      return "secondary";
    case "STOCK_OUT":
    case "WASTE":
      return "destructive";
  }
}

export default async function InventoryItemDetailPage({
  params,
}: PageProps<"/inventory/[id]">) {
  const { id } = await params;
  const ctx = await loadContext("inventory.read");

  const [item, movements] = await Promise.all([
    getInventoryItemOrThrow(ctx, id),
    listMovementsForItem(ctx, id, 100),
  ]);

  const qty = Number(item.quantityOnHand);
  const min = Number(item.minimumQuantity);
  const preferred = Number(item.preferredQuantity);
  const isLow = qty <= min && item.isActive;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* Top breadcrumb navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/inventory">
            <ChevronLeftIcon className="mr-1 size-4" />
            Back to Inventory
          </Link>
        </Button>
      </div>

      {/* Item title card */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {item.name}
            </h1>
            {!item.isActive ? (
              <Badge variant="outline" className="text-muted-foreground">
                Inactive
              </Badge>
            ) : null}
            {isLow ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Low Stock Warning
              </Badge>
            ) : null}
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {item.sku ? <span>SKU: <strong className="font-mono text-foreground">{item.sku}</strong></span> : null}
            {item.category ? <span>Category: <strong className="text-foreground">{item.category}</strong></span> : null}
            <span>Unit: <strong className="text-foreground">{item.unit}</strong></span>
          </div>
        </div>

        {/* Stock Level Badge */}
        <div className="rounded-lg border bg-card p-4 text-right shadow-xs min-w-44">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Quantity on Hand
          </p>
          <p className={`font-heading text-3xl font-bold ${isLow ? "text-amber-700 dark:text-amber-400" : ""}`}>
            {qty}{" "}
            <span className="text-muted-foreground text-sm font-normal">
              {item.unit}
            </span>
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Min: {min} · Target: {preferred}
          </p>
        </div>
      </header>

      {/* Low stock alert banner */}
      {isLow ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/70 p-4 text-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-semibold">Stock level is at or below minimum threshold</p>
            <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
              Current stock ({qty} {item.unit}) is below the minimum required ({min} {item.unit}).
              Consider placing an order for {Math.max(0, preferred - qty)} {item.unit} to reach the target stock level.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 cols: Movements history + Record Movement form */}
        <div className="space-y-6 lg:col-span-2">
          {item.isActive ? (
            <RecordMovementForm
              itemId={item.id}
              unit={item.unit}
              currentStock={qty}
            />
          ) : (
            <Card>
              <CardContent className="py-4 text-center text-sm text-muted-foreground">
                This item is deactivated. Reactivate it below to record stock movements.
              </CardContent>
            </Card>
          )}

          {/* Movement history ledger */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <HistoryIcon className="size-4" />
                Movement History Ledger
              </CardTitle>
              <span className="text-muted-foreground text-xs">
                {movements.length} recorded movement{movements.length === 1 ? "" : "s"}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {movements.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No stock movements recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3 text-right">Balance After</th>
                        <th className="px-4 py-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {movements.map((m) => {
                        const mQty = Number(m.quantity);
                        const mBal = Number(m.balanceAfter);
                        const isIncrease = m.type === "STOCK_IN" || m.type === "RETURN";

                        return (
                          <tr key={m.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <ClockIcon className="size-3" />
                                {new Date(m.createdAt).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge variant={movementBadgeVariant(m.type)}>
                                {STOCK_MOVEMENT_TYPE_LABELS[m.type]}
                              </Badge>
                            </td>
                            <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${isIncrease ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                              {isIncrease ? `+${mQty}` : `-${mQty}`} {item.unit}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">
                              {mBal} {item.unit}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                              {m.reason ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right col: Edit Item Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Item Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryItemForm
                defaults={{
                  id: item.id,
                  name: item.name,
                  category: item.category,
                  sku: item.sku,
                  unit: item.unit,
                  minimumQuantity: min,
                  preferredQuantity: preferred,
                  isActive: item.isActive,
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
