const query = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: (...args: unknown[]) => query(...args) } }));
import { GET as health } from "@/app/api/health/route";
import { GET as ready } from "@/app/api/ready/route";

test("liveness does not access the database", async () => {
  expect((await health()).status).toBe(200);
  expect(query).not.toHaveBeenCalled();
});
test("readiness reports a reachable database", async () => {
  query.mockResolvedValue([{ ready: 1 }]);
  expect((await ready()).status).toBe(200);
});
test("readiness fails without leaking database errors", async () => {
  query.mockRejectedValue(new Error("synthetic-secret-connection"));
  const response = await ready();
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("synthetic-secret");
});
