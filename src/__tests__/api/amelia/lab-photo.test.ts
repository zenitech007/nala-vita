import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }),
}));

const userFindUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync: async () => ({
    allowed: true,
    remaining: 4,
    resetAt: Date.now() + 60000,
  }),
}));

const extractLabsFromImage = jest.fn();
jest.mock("@/lib/amelia/labvision", () => ({
  extractLabsFromImage: (...a: unknown[]) => extractLabsFromImage(...a),
}));

import { POST } from "@/app/api/ai/lab-photo/route";

function req(body: unknown) {
  return new Request("http://localhost/api/ai/lab-photo", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() =>
  [getUser, userFindUnique, extractLabsFromImage].forEach((m) => m.mockReset())
);

describe("POST /api/ai/lab-photo", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(
      (
        await POST(req({ imageDataUrl: "data:image/jpeg;base64,AAA" }))
      ).status
    ).toBe(401);
  });

  it("422s when the body is not a base64 image", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    const res = await POST(
      req({ imageDataUrl: "https://example.com/x.png" })
    );
    expect(res.status).toBe(422);
  });

  it("returns the extracted result on the happy path", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    extractLabsFromImage.mockResolvedValue({
      results: [
        {
          name: "Glucose",
          value: "110",
          unit: "mg/dL",
          referenceRange: "70-99",
          flag: "abnormal",
        },
      ],
      summary: "Slightly high.",
      overallNote: "Confirm with your doctor.",
    });
    const res = await POST(req({ imageDataUrl: "data:image/jpeg;base64,AAA" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.results[0].name).toBe("Glucose");
    expect(extractLabsFromImage).toHaveBeenCalledWith(
      "data:image/jpeg;base64,AAA"
    );
  });
});
