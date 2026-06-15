// Runs one Claudio turn: a tool-calling loop that lets Claude read and mutate
// the plan via server-side tools until it produces a final text answer.

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, CHAT_MODEL } from "./client";
import { claudioTools, dispatchTool, systemPrompt } from "./tools";

const MAX_TOOL_ROUNDS = 6;

export interface ChatTurnInput {
  userId: string;
  /** Prior turns in the Anthropic message format. */
  history: Anthropic.MessageParam[];
  userMessage: string;
}

export interface ChatTurnResult {
  reply: string;
  messages: Anthropic.MessageParam[];
}

export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const anthropic = getAnthropic();
  const messages: Anthropic.MessageParam[] = [
    ...input.history,
    { role: "user", content: input.userMessage },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system: systemPrompt(),
      tools: claudioTools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply, messages };
    }

    // Execute every tool the model asked for and feed results back.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      let result: unknown;
      try {
        result = await dispatchTool(block.name, block.input as Record<string, unknown>, input.userId);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { reply: "I made several changes but stopped to avoid looping. Ask me to continue if needed.", messages };
}
