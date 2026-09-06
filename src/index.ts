/**
 * BrainSAIT Voice Agent — with ElevenLabs TTS integration.
 *
 * Endpoints:
 * GET  /health           → service info
 * GET  /search?q=X       → AI Search retrieval
 * POST /tts              → ElevenLabs text-to-speech (returns audio)
 * POST /chat             → AI Search + ElevenLabs TTS (search → generate → speak)
 */

export interface Env {
  AI: Ai;
  AI_SEARCH: AiSearchNamespace;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
}

const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah — mature, confident
const TTS_MODEL = "eleven_turbo_v2_5";

async function tts(env: Env, text: string, voiceId?: string): Promise<Response> {
  if (!env.ELEVENLABS_API_KEY) {
    return Response.json({ ok: false, error: "ELEVENLABS_API_KEY not configured" }, { status: 503 });
  }
  const voice = voiceId || env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({ text, model_id: TTS_MODEL }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    return Response.json({ ok: false, error: `ElevenLabs error: ${res.status}`, detail: err.slice(0, 200) }, { status: 502 });
  }
  return new Response(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": 'attachment; filename="speech.mp3"',
      "Cache-Control": "no-store",
    },
  });
}

async function search(env: Env, query: string, instance?: string): Promise<any> {
  const handle = env.AI_SEARCH.get(instance || "brainsait-ai-search");
  const result = await handle.search({
    query,
    ai_search_options: { retrieval: { max_num_results: 5 } },
  });
  return {
    ok: true,
    query,
    chunks: (result.chunks || []).map((c: any) => ({
      text: c.text || "",
      score: c.score || 0,
      key: c.item?.key || "",
    })),
    answer: (result.chunks || []).map((c: any) => c.text).join("\n\n"),
  };
}

async function chat(env: Env, query: string): Promise<Response> {
  // Search first
  const searchResult = await search(env, query);
  if (!searchResult.ok || searchResult.chunks.length === 0) {
    return Response.json({ ok: false, error: "No results found", query }, { status: 404 });
  }

  // Generate a concise answer from the top 3 chunks
  const topChunks = searchResult.chunks.slice(0, 3).map((c: any) => c.text).join("\n\n");
  const answer = `Based on the clinical knowledge base: ${topChunks.slice(0, 500)}`;

  // TTS the answer
  const audioRes = await tts(env, answer);
  if (!audioRes.ok) return audioRes;

  return new Response(JSON.stringify({
    ok: true,
    query,
    answer: answer.slice(0, 500),
    searchChunks: searchResult.chunks.length,
    audioUrl: "/tts?text=" + encodeURIComponent(answer.slice(0, 500)),
  }), {
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
      });
    }

    if (path === "/" || path === "/health") {
      return Response.json({
        ok: true,
        service: "brainsait-voice-agent",
        version: "1.1.0",
        status: "live with ElevenLabs TTS",
        bindings: { ai: !!env.AI, ai_search: !!env.AI_SEARCH, elevenlabs: !!env.ELEVENLABS_API_KEY },
        endpoints: ["/health", "/search?q=...", "/tts", "/chat"],
      });
    }

    if (path === "/search") {
      const query = url.searchParams.get("q") || "";
      if (!query) return Response.json({ ok: false, error: "q required" }, { status: 400 });
      const result = await search(env, query);
      return Response.json(result);
    }

    if (path === "/tts" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const text = body.text || url.searchParams.get("text") || "";
      const voice = body.voice || url.searchParams.get("voice");
      if (!text) return Response.json({ ok: false, error: "text required" }, { status: 400 });
      return tts(env, text, voice);
    }

    if (path === "/chat" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as any;
      const query = body.query || "";
      if (!query) return Response.json({ ok: false, error: "query required" }, { status: 400 });
      return chat(env, query);
    }

    return Response.json({ ok: false, error: "Not found — try /health, /search, /tts, /chat" }, { status: 404 });
  },
};
