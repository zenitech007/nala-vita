import { readFileSync } from "node:fs";
import path from "node:path";
jest.mock("@/lib/auth-cache", () => ({ getAuthenticatedUserWithProfile: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/components/layout/PatientSidebar", () => () => null);
jest.mock("@/components/layout/DoctorSidebar", () => () => null);
jest.mock("@/components/layout/AdminSidebar", () => () => null);
jest.mock("@/components/amelia/AmeliaLauncher", () => () => null);
import * as patient from "@/app/(patient)/patient/layout";
import * as doctor from "@/app/(doctor)/doctor/layout";
import * as admin from "@/app/(admin)/admin/layout";

test.each(["manifest.json", "site.webmanifest"])("%s references real 192 and 512 PNG icons", name => {
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "public", name), "utf8"));
  expect(manifest.name).toBe("Nala Vita");
  for (const size of [192, 512]) {
    const icon = manifest.icons.find((item: { sizes: string }) => item.sizes === size + "x" + size);
    expect(icon?.type).toBe("image/png");
    const bytes = readFileSync(path.join(process.cwd(), "public", icon.src));
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
});

test("robots does not advertise an absent sitemap or an obsolete domain", () => {
  const robots = readFileSync(path.join(process.cwd(), "public/robots.txt"), "utf8");
  expect(robots).not.toMatch(/Sitemap:|mediconnect\.app/);
});

test.each([patient, doctor, admin])("authenticated layouts prohibit indexing", layout => {
  expect((layout as { metadata?: { robots?: object } }).metadata?.robots).toEqual({ index: false, follow: false });
});
