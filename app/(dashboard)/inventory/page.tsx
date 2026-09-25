import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangleIcon,
  BoxesIcon,
  CheckCircle2Icon,
  FilterIcon,
  PlusIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loadContext } from "@/lib/server/guard";
import {
  listInventoryItems,
  countLowStock,
  listCategories,
} from "@/services/inventory";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: PageProps<"/inventory">) {
  const ctx = await loadContext("inventory.read");
  const params = await searchParams;

  const search = typeof params?.search === "string" ? params.search : undefined;
  const category = typeof params?.category === "string" ? params.category : undefined;
  const lowStockOnly = params?.lowStock === "true";

  const [items, lowStockCount, categories] = await Promise.all([
    listInventoryItems(ctx, {
      search,
      category,
      lowStockOnly,
      activeOnly: false,
    }),
    countLowStock(ctx),
    listCategories(ctx),
  ]);

  const totalItems = items.length;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Inventory & Consumables
          </h1>
          <p className="text-muted-foreground text-sm">
            Track supplies, consumable stock levels, and ledger movements.
          </p>
        </div>

        <Button asChild>
          <Link href="/inventory/new">
            <PlusIcon className="mr-1.5 size-4" />
            Add Item
          </Link>
        </Button>
      </header>

      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <BoxesIcon className="size-4" />
              Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">{totalItems}</p>
          </CardContent>
        </Card>

        <Card className={lowStockCount > 0 ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/10" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <AlertTriangleIcon className={lowStockCount > 0 ? "size-4 text-amber-600" : "size-4"} />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`font-heading text-2xl font-semibold ${lowStockCount > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>
              {lowStockCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <CheckCircle2Icon className="size-4 text-green-600" />
              Adequately Stocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold">
              {Math.max(0, totalItems - lowStockCount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter / Search Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form method="GET" className="flex flex-1 items-center gap-2">
          <Input
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search items by name, SKU or category..."
            className="max-w-md"
          />
          {category ? <input type="hidden" name="category" value={category} /> : null}
          {lowStockOnly ? <input type="hidden" name="lowStock" value="true" /> : null}
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2">
          {categories.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FilterIcon className="size-3.5" />
              <Link
                href={`/inventory?${new URLSearchParams({
                  ...(search ? { search } : {}),
                  ...(lowStockOnly ? { lowStock: "true" } : {}),
                }).toString()}`}
                className={`rounded px-2 py-1 transition-colors ${!category ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
              >
                All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat}
                  href={`/inventory?${new URLSearchParams({
                    ...(search ? { search } : {}),
                    category: cat,
                    ...(lowStockOnly ? { lowStock: "true" } : {}),
                  }).toString()}`}
                  className={`rounded px-2 py-1 transition-colors ${category === cat ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
                >
                  {cat}
                </Link>
              ))}
            </div>
          ) : null}

          <Button
            variant={lowStockOnly ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link
              href={`/inventory?${new URLSearchParams({
                ...(search ? { search } : {}),
                ...(category ? { category } : {}),
                ...(lowStockOnly ? {} : { lowStock: "true" }),
              }).toString()}`}
            >
              {lowStockOnly ? "Show All Items" : "Low Stock Only"}
            </Link>
          </Button>
        </div>
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="space-y-3">
            <BoxesIcon className="text-muted-foreground mx-auto size-10 stroke-1" />
            <div className="space-y-1">
              <p className="font-medium">No inventory items found</p>
              <p className="text-muted-foreground text-sm">
                {search || category || lowStockOnly
                  ? "Try clearing filters to view all stocked items."
                  : "Add consumables, instruments, or materials to track stock levels."}
              </p>
            </div>
            {!search && !category && !lowStockOnly ? (
              <Button asChild size="sm">
                <Link href="/inventory/new">Add First Item</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/inventory">Clear Filters</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {items.map((item) => {
                const qty = Number(item.quantityOnHand);
                const min = Number(item.minimumQuantity);
                const isLow = qty <= min && item.isActive;

                return (
                  <li key={item.id}>
                    <Link
                      href={`/inventory/${item.id}`}
                      className="hover:bg-muted/50 flex flex-col gap-2 px-6 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground hover:underline">
                            {item.name}
                          </span>
                          {!item.isActive ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactive
                            </Badge>
                          ) : null}
                          {isLow ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Low Stock
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          {item.sku ? <span>SKU: {item.sku}</span> : null}
                          {item.category ? <span>Category: {item.category}</span> : null}
                          <span>Min: {min} {item.unit}</span>
                          <span>Target: {Number(item.preferredQuantity)} {item.unit}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className={`font-heading text-xl font-semibold ${isLow ? "text-amber-700 dark:text-amber-400" : ""}`}>
                            {qty}{" "}
                            <span className="text-muted-foreground text-xs font-normal">
                              {item.unit}
                            </span>
                          </p>
                          <p className="text-muted-foreground text-xs">On hand</p>
                        </div>
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
