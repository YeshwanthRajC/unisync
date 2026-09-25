import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { InventoryItemForm } from "@/app/(dashboard)/inventory/item-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";

export const metadata: Metadata = { title: "New Inventory Item" };

export default async function NewInventoryItemPage() {
  await loadContext("inventory.create");

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/inventory">
            <ChevronLeftIcon className="mr-1 size-4" />
            Back to Inventory
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Add Inventory Item
        </h1>
        <p className="text-muted-foreground text-sm">
          Register consumable supplies or clinic materials.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Item Information</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryItemForm />
        </CardContent>
      </Card>
    </div>
  );
}
