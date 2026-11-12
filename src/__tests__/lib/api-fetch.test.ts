import { fetchJson, ApiError } from "@/lib/api-fetch";

test("rejects a non-2xx JSON response with a typed error", async () => {
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Not allowed", code: "FORBIDDEN" }), { status: 403 }));
  await expect(fetchJson("/api/synthetic")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN", message: "Not allowed" });
});

test("rejects invalid success JSON instead of treating it as data", async () => {
  global.fetch = jest.fn().mockResolvedValue(new Response("not json", { status: 200 }));
  await expect(fetchJson("/api/synthetic")).rejects.toBeInstanceOf(ApiError);
});

test("preserves successful JSON and handles empty responses", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(new Response('{"ok":true}')).mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(fetchJson("/api/synthetic")).resolves.toEqual({ ok: true });
  await expect(fetchJson("/api/synthetic")).resolves.toBeUndefined();
});
