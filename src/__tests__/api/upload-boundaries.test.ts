const upload = jest.fn(), signed = jest.fn(), remove = jest.fn();
const create = jest.fn(), aggregate = jest.fn(), discard = jest.fn();
jest.mock("@/lib/auth", () => ({ requireApiUser: async () => ({ ok: true, user: { id: "u", role: "PATIENT" } }) }));
jest.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { storage: { from: () => ({ upload, createSignedUrl: signed, remove }) } },
}));
jest.mock("@/lib/prisma", () => {
  const fileUpload = { create, aggregate, delete: discard };
  return { prisma: { fileUpload, $transaction: (work: (tx: unknown) => unknown) => work({ fileUpload, $queryRaw: async () => [] }) } };
});
import { POST } from "@/app/api/upload/route";
import { readBoundedBody } from "@/lib/bounded-body";
import { imageDataUrlSchema } from "@/lib/image-data-url";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
function request(bytes: BlobPart, contentLength?: string) {
  const form = new FormData();
  form.set("file", new File([bytes], "synthetic.png", { type: "image/png" }));
  const headers = contentLength ? { "Content-Length": contentLength } : undefined;
  return new Request("https://example.test/api/upload", { method: "POST", body: form, headers }) as never;
}
beforeEach(() => {
  jest.resetAllMocks();
  upload.mockResolvedValue({ error: null });
  signed.mockResolvedValue({ data: { signedUrl: "https://example.test/signed" }, error: null });
  remove.mockResolvedValue({ error: null });
  aggregate.mockResolvedValue({ _sum: { fileSize: 0 } });
  create.mockImplementation(async ({ data }) => ({ id: "f", ...data }));
  discard.mockResolvedValue({});
});
it("F36 rejects declared oversize requests before any storage upload", async () => {
  expect((await POST(request(png, "999999999"))).status).toBe(413);
  expect(upload).not.toHaveBeenCalled();
});
it("F36 rejects a forged PNG content type before storage", async () => {
  expect((await POST(request("invalid image"))).status).toBe(400);
  expect(upload).not.toHaveBeenCalled();
});
it("F36 rejects a user who has reached the shared storage quota", async () => {
  aggregate.mockResolvedValue({ _sum: { fileSize: Number.MAX_SAFE_INTEGER } });
  expect((await POST(request(png))).status).toBe(413);
  expect(upload).not.toHaveBeenCalled();
});
it("F36 cleans up a stored object when signed URL creation fails", async () => {
  signed.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  expect((await POST(request(png))).status).toBeGreaterThanOrEqual(500);
  expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
});
it("F36 caps streamed requests that omit Content-Length", async () => {
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(5));
    controller.enqueue(new Uint8Array(5));
    controller.close();
  } });
  const req = new Request("https://example.test", { method: "POST", body, duplex: "half" } as RequestInit);
  await expect(readBoundedBody(req, 8)).rejects.toMatchObject({ status: 413 });
});
it.each(["data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,YWJjZA==",
  "data:image/png;base64," + "A".repeat(1_800_000)])("F36 rejects invalid image input %s", image => {
  expect(imageDataUrlSchema.safeParse(image).success).toBe(false);
});
