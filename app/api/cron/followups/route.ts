import { NextResponse } from "next/server";

import { materializeDueStatuses } from "@/services/followups";
import { toErrorResponse } from "@/lib/server/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  try {
    // If CRON_SECRET is set in environment, check Authorization header
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await materializeDueStatuses();

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      overdueUpdated: result.totalOverdue,
      dueUpdated: result.totalDue,
    });
  } catch (error) {
    return toErrorResponse(error, "cron:followups");
  }
}
