import { afterEach, describe, expect, it } from "vitest";
import { analyze } from "@/lib/analytics";
import { toCoachRequest } from "@/lib/coach";
import { demoHabits } from "@/lib/demo";
import { GET, POST } from "./route";

const payload = toCoachRequest(analyze(demoHabits("2026-09-28"), "2026-09-28"));

function post(body: unknown, ip = `ip-${Math.random()}`) {
  return new Request("http://localhost/api/insights", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("/api/insights", () => {
  const original = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = original;
  });

  it("reports whether AI is enabled", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await (await GET()).json()).toEqual({ enabled: false, model: null });
  });

  it("returns 503 without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(post(payload));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ai_disabled");
  });

  it("rejects malformed and oversized payloads before calling the API", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post({ ...payload, habits: [] }))).status).toBe(400);
    const tooMany = Array.from({ length: 21 }, () => payload.habits[0]);
    expect((await POST(post({ ...payload, habits: tooMany }))).status).toBe(400);
    const longName = [{ ...payload.habits[0], name: "x".repeat(61) }];
    expect((await POST(post({ ...payload, habits: longName }))).status).toBe(400);
  });

  it("rate limits a single client", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await POST(post("bad", "same-ip"))).status);
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
  });
});
