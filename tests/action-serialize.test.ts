import { describe, expect, it } from "vitest";
import { Decimal } from "@/lib/db/generated/internal/prismaNamespace";
import { serializePlain } from "@/lib/server/action";

describe("serializePlain", () => {
  it("leaves primitives, null, and undefined unchanged", () => {
    expect(serializePlain(null)).toBeNull();
    expect(serializePlain(undefined)).toBeUndefined();
    expect(serializePlain("hello")).toBe("hello");
    expect(serializePlain(123)).toBe(123);
    expect(serializePlain(true)).toBe(true);
  });

  it("preserves native Date instances", () => {
    const now = new Date();
    const result = serializePlain(now);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(now.getTime());
  });

  it("converts a Decimal instance to a string", () => {
    const decimal = new Decimal("123.45");
    const result = serializePlain(decimal);
    expect(result).toBe("123.45");
    expect(typeof result).toBe("string");
  });

  it("recursively converts Decimal objects inside nested structures and arrays", () => {
    const raw = {
      id: "pay-1",
      amount: new Decimal("500.00"),
      recordedAt: new Date("2026-09-25T10:00:00Z"),
      metadata: {
        tax: new Decimal("25.50"),
        items: [
          { qty: new Decimal("2"), price: new Decimal("100.00") },
          { qty: new Decimal("1"), price: new Decimal("50.00") },
        ],
      },
    };

    const serialized = serializePlain(raw);

    expect(serialized.id).toBe("pay-1");
    expect(serialized.amount).toBe("500");
    expect(serialized.recordedAt).toBeInstanceOf(Date);
    expect(serialized.metadata.tax).toBe("25.5");
    expect(serialized.metadata.items[0]?.qty).toBe("2");
    expect(serialized.metadata.items[0]?.price).toBe("100");

    // Must be a pure plain object suitable for React Server Action serialization
    expect(Object.getPrototypeOf(serialized)).toBe(Object.prototype);
    expect(typeof (serialized.amount as unknown)).toBe("string");
  });
});
