import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/currentUser";
import { isAiConfigured } from "@/server/ai/client";
import { runChatTurn } from "@/server/ai/runChat";

const schema = z.object({
  message: z.string().min(1),
  sessionId: z.string().default("default"),
});

// POST /api/chat -> one Claudio turn (persists history; runs the tool loop)
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { message, sessionId } = schema.parse(await req.json());

  if (!isAiConfigured()) {
    return NextResponse.json({
      reply:
        "Claudio's AI is offline (no ANTHROPIC_API_KEY set). I can still schedule your day and manage tasks — set the key to enable chat.",
    });
  }

  // Load prior turns for this session.
  const prior = await prisma.chatMessage.findMany({
    where: { userId, sessionId },
    orderBy: { createdAt: "asc" },
  });
  const history = prior.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content as Anthropic.MessageParam["content"],
  })) as Anthropic.MessageParam[];

  const { reply } = await runChatTurn({ userId, history, userMessage: message });

  await prisma.chatMessage.create({
    data: { userId, sessionId, role: "USER", content: message },
  });
  await prisma.chatMessage.create({
    data: { userId, sessionId, role: "ASSISTANT", content: reply },
  });

  return NextResponse.json({ reply });
}
