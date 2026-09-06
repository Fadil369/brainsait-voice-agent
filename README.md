# BrainSAIT Voice Agent

Talk to your clinical knowledge base using voice. Built with Cloudflare Agents + AI Search.

## What it is

A voice agent that:
1. Transcribes your speech (Workers AI STT)
2. Searches the BrainSAIT clinical knowledge base (AI Search)
3. Generates a grounded answer (Workers AI LLM)
4. Speaks the answer back (Workers AI TTS)

Supports bilingual Arabic/English — responds in the language you speak.

## Architecture

```
Browser → WebSocket → Durable Object → STT → onTurn(search) → TTS → Browser
```

- **STT/TTS:** Workers AI (no API keys needed)
- **Retrieval:** AI Search `brainsait-ai-search` instance
- **Generation:** Workers AI `@cf/zai-org/glm-5.2`
- **Protocol:** @cloudflare/voice (beta)

## Deploy

```bash
npm install
npm run deploy
```

## Links

- [BrainSAIT Clinical RAG](https://github.com/Fadil369/brainsait-clinical-rag)
- [BrainSAIT Ecosystem](https://brainsait.org)
