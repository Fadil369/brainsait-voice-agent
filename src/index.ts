/**
 * BrainSAIT Voice Agent — talk to your clinical knowledge base.
 *
 * Uses @cloudflare/voice for the speech pipeline (STT + TTS via Workers AI)
 * and AI Search as the retrieval tool. The model searches the clinical
 * knowledge base when it needs facts, grounds its reply, and speaks the answer.
 *
 * Browser → WebSocket → Durable Object → STT → onTurn(search) → TTS → Browser
 */
import { Agent, routeAgentRequest } from "agents";
import { withVoice, WorkersAIFluxSTT, WorkersAITTS } from "@cloudflare/voice";
import { generateText, tool, stepCountIs } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

export interface Env {
  AI: Ai;
  AI_SEARCH: AiSearchNamespace;
}

const VoiceAgentBase = withVoice(Agent);

export class VoiceAgent extends VoiceAgentBase<Env> {
  transcriber = new WorkersAIFluxSTT(this.env.AI);
  tts = new WorkersAITTS(this.env.AI);

  async onTurn(transcript: string, context: any) {
    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = await generateText({
      model: workersai("@cf/zai-org/glm-5.2"),
      system:
        "You are a helpful clinical voice assistant for BrainSAIT. " +
        "Answer from the clinical knowledge base using the searchKnowledgeBase tool. " +
        "For clinical questions, always search first and cite the source. " +
        "Keep replies concise and professional. Respond in the same language the user speaks. " +
        "If the user speaks Arabic, respond in Arabic. If English, respond in English.",
      messages: [
        ...context.messages.map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: transcript },
      ],
      tools: {
        searchKnowledgeBase: tool({
          description: "Search the BrainSAIT clinical knowledge base for medical information, ICD-10 codes, NPHIES claims, and healthcare protocols.",
          inputSchema: z.object({
            query: z.string().describe("Search query in Arabic or English"),
          }),
          execute: async ({ query }) => {
            const res = await this.env.AI_SEARCH.get("brainsait-ai-search").search({
              query,
              ai_search_options: { retrieval: { max_num_results: 5 } },
            });
            return res.chunks.map((c: any) => c.text).join("\n\n");
          },
        }),
      },
      stopWhen: stepCountIs(4),
    });

    return result.text;
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
};
