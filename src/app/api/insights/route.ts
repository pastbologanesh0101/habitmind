import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  COACH_SYSTEM_PROMPT,
  CoachReportSchema,
  CoachRequestSchema,
  coachUserPrompt,
} from "@/lib/coach";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";

function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function error(status: number, code: string, message: string) {
  return Response.json({ error: code, message }, { status });
}

export async function GET() {
  return Response.json({ enabled: aiEnabled(), model: aiEnabled() ? MODEL : null });
}

export async function POST(request: Request) {
  if (!aiEnabled()) {
    return error(503, "ai_disabled", "No ANTHROPIC_API_KEY is configured on this deployment.");
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(ip)) {
    return error(429, "rate_limited", "Too many coaching requests. Try again in a minute.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = CoachRequestSchema.safeParse(body);
  if (!parsed.success) {
    return error(400, "bad_request", "Stats payload failed validation.");
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(CoachReportSchema) },
      system: COACH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: coachUserPrompt(parsed.data) }],
    });

    if (response.stop_reason === "refusal") {
      return error(422, "refused", "The coach declined to answer this request.");
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return error(502, "incomplete", "The coach's answer was cut off. Try again.");
    }
    return Response.json({ source: "ai", model: response.model, report: response.parsed_output });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return error(503, "ai_disabled", "The configured API key was rejected.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      return error(429, "rate_limited", "The AI service is busy. Try again shortly.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      return error(502, "upstream", "The AI service returned an error.");
    }
    throw err;
  }
}
