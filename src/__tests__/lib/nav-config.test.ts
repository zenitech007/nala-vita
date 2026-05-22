import { describe, it, expect } from "@jest/globals";
import { PATIENT_NAV, DOCTOR_NAV, ADMIN_NAV } from "@/lib/nav-config";

describe("nav-config", () => {
  it("PATIENT_NAV has 11 entries (matches current sidebar)", () => {
    expect(PATIENT_NAV).toHaveLength(11);
  });

  it("DOCTOR_NAV has 11 entries", () => {
    expect(DOCTOR_NAV).toHaveLength(11);
  });

  it("ADMIN_NAV has 5 entries", () => {
    expect(ADMIN_NAV).toHaveLength(5);
  });

  it("every patient href starts with /patient/", () => {
    for (const item of PATIENT_NAV) {
      expect(item.href).toMatch(/^\/patient\//);
    }
  });

  it("every doctor href starts with /doctor/", () => {
    for (const item of DOCTOR_NAV) {
      expect(item.href).toMatch(/^\/doctor\//);
    }
  });

  it("every admin href starts with /admin/", () => {
    for (const item of ADMIN_NAV) {
      expect(item.href).toMatch(/^\/admin\//);
    }
  });

  it("each entry has icon, label, href", () => {
    for (const item of [...PATIENT_NAV, ...DOCTOR_NAV, ...ADMIN_NAV]) {
      expect(item.icon).toBeDefined();
      expect(typeof item.label).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.href).toBe("string");
      expect(item.href.length).toBeGreaterThan(0);
    }
  });
});
