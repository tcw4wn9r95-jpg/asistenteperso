import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/currentUser";
import { getAdapter } from "@/server/integrations/registry";
import { Provider } from "@/server/integrations/adapter";
import { asJson } from "@/server/json";

// POST /api/integrations/:provider/sync?date=yyyy-MM-dd
// Pull a provider's directives for the date and upsert them as IntegrationItems
// the scheduler can consume. Provider stubs return mock data today.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const userId = await getCurrentUserId();
  const date = new URL(req.url).searchParams.get("date") ?? DateTime.now().toISODate()!;

  const adapter = getAdapter(provider.toUpperCase() as Provider);
  if (!adapter) {
    return NextResponse.json({ error: `Unknown provider ${provider}` }, { status: 404 });
  }

  const directives = await adapter.fetchDailyDirectives(date, userId);

  for (const d of directives) {
    await prisma.integrationItem.upsert({
      where: {
        userId_provider_externalId_date: {
          userId,
          provider: d.provider,
          externalId: d.externalId,
          date,
        },
      },
      create: {
        userId,
        provider: d.provider,
        externalId: d.externalId,
        date,
        title: d.title,
        suggestedMinutes: d.suggestedMinutes,
        preferredTimeOfDay: d.preferredTimeOfDay,
        energy: d.energy,
        payload: asJson({ ...d.payload, segments: d.segments }),
      },
      update: {
        title: d.title,
        suggestedMinutes: d.suggestedMinutes,
        preferredTimeOfDay: d.preferredTimeOfDay,
        energy: d.energy,
        payload: asJson({ ...d.payload, segments: d.segments }),
      },
    });
  }

  return NextResponse.json({ provider: adapter.provider, configured: adapter.isConfigured(), synced: directives.length });
}
