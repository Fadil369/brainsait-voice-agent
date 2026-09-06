/**
 * BrainSAIT Voice Agent — minimal scaffold for deployment.
 *
 * This is a placeholder that proves the Worker deploys and binds
 * to AI + AI_SEARCH. The full voice pipeline (@cloudflare/voice)
 * will be wired when the package stabilizes.
 */

export interface Env {
  AI: Ai;
  AI_SEARCH: AiSearchNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "brainsait-voice-agent",
        version: "1.0.0-alpha",
        status: "scaffold — voice pipeline pending @cloudflare/voice stable release",
        bindings: {
          ai: !!env.AI,
          ai_search: !!env.AI_SEARCH,
        },
      });
    }

    if (url.pathname === "/search") {
      const query = url.searchParams.get("q") || "";
      if (!query) return Response.json({ ok: false, error: "q required" }, { status: 400 });
      const handle = env.AI_SEARCH.get("brainsait-ai-search");
      const result = await handle.search({
        query,
        ai_search_options: { retrieval: { max_num_results: 5 } },
      });
      return Response.json({
        ok: true,
        query,
        chunks: (result.chunks || []).map((c: any) => ({
          text: c.text || "",
          score: c.score || 0,
        })),
      });
    }

    return Response.json({
      ok: false,
      error: "Not found — try /health or /search?q=...",
    }, { status: 404 });
  },
};
