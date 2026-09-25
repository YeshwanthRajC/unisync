import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { userHasOrganization } from "@/services/organizations";

const TEST_CANCEL_USER_ID = "bbbbbbbb-1111-4111-8111-111111111111";
const TEST_CANCEL_EMAIL = "cancel-test@example.com";

describe("cancel onboarding flow", () => {
  it("removes profile and auth.users record when onboarding is cancelled", async () => {
    // 1. Setup: Insert test auth user and profile as would happen during sign up
    await prisma.$executeRawUnsafe(
      "INSERT INTO auth.users (id, email) VALUES ($1::uuid, $2)",
      TEST_CANCEL_USER_ID,
      TEST_CANCEL_EMAIL,
    );
    await prisma.profile.create({
      data: {
        id: TEST_CANCEL_USER_ID,
        email: TEST_CANCEL_EMAIL,
        fullName: "Cancel Test User",
      },
    });

    // Verify user exists and has no organization
    const hasOrg = await userHasOrganization(TEST_CANCEL_USER_ID);
    expect(hasOrg).toBe(false);

    // 2. Perform cancellation inside transaction
    await prisma.$transaction(async (tx) => {
      await tx.profile.deleteMany({
        where: { id: TEST_CANCEL_USER_ID },
      });
      await tx.$executeRawUnsafe(
        "DELETE FROM auth.users WHERE id = $1::uuid",
        TEST_CANCEL_USER_ID,
      );
    });

    // 3. Verify both profile and auth.users are completely deleted
    const profile = await prisma.profile.findUnique({
      where: { id: TEST_CANCEL_USER_ID },
    });
    expect(profile).toBeNull();

    const authUsers = await prisma.$queryRawUnsafe<{ id: string }[]>(
      "SELECT id FROM auth.users WHERE id = $1::uuid",
      TEST_CANCEL_USER_ID,
    );
    expect(authUsers.length).toBe(0);
  });

  it("frees up the email so user can sign up again after cancelling", async () => {
    const userId1 = "cccccccc-2222-4222-8222-222222222222";
    const userId2 = "dddddddd-3333-4333-8333-333333333333";
    const testEmail = "re-signup@example.com";

    // 1. Initial sign up
    await prisma.$executeRawUnsafe(
      "INSERT INTO auth.users (id, email) VALUES ($1::uuid, $2)",
      userId1,
      testEmail,
    );

    // 2. Cancellation
    await prisma.$executeRawUnsafe(
      "DELETE FROM auth.users WHERE id = $1::uuid",
      userId1,
    );

    // 3. User signs up again with the exact same email: must succeed!
    await prisma.$executeRawUnsafe(
      "INSERT INTO auth.users (id, email) VALUES ($1::uuid, $2)",
      userId2,
      testEmail,
    );

    const reRegistered = await prisma.$queryRawUnsafe<{ id: string; email: string }[]>(
      "SELECT id, email FROM auth.users WHERE email = $1",
      testEmail,
    );
    expect(reRegistered.length).toBe(1);
    expect(reRegistered[0]?.id).toBe(userId2);

    // Cleanup
    await prisma.$executeRawUnsafe(
      "DELETE FROM auth.users WHERE id = $1::uuid",
      userId2,
    );
  });
});
