import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Offline contract only: this never connects to the configured database.
const root = path.join(process.cwd(), "prisma");
const schema = readFileSync(path.join(root, "schema.prisma"), "utf8");
const migrations = readdirSync(path.join(root, "migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((entry) => readFileSync(path.join(root, "migrations", entry.name, "migration.sql"), "utf8"))
  .join("\n");

describe("F17 fresh-deployment migration contract", () => {
  it("provides every declared composite/index definition in the migration chain", () => {
    const absent: string[] = [];
    for (const model of schema.matchAll(/model \w+ \{([\s\S]*?)\n\}/g)) {
      const body = model[1];
      const table = body.match(/@@map\("([^"]+)"\)/)?.[1];
      if (!table) continue;
      const fields = new Map<string, string>();
      for (const field of body.matchAll(/^\s+(\w+)\s+[^\n]+/gm)) {
        fields.set(field[1], field[0].match(/@map\("([^"]+)"\)/)?.[1] ?? field[1]);
      }
      for (const index of body.matchAll(/@@index\(\[([^\]]+)\]\)/g)) {
        const columns = index[1].split(",").map((name) => fields.get(name.trim())!);
        const sqlColumns = columns.map((name) => `"${name}"`).join(", ");
        const suffix = `ON "${table}"(${sqlColumns});`;
        if (!migrations.includes(suffix)) absent.push(`${table}(${columns.join(", ")})`);
      }
    }
    expect(absent).toEqual([]);
  });

  it("can store prescription origin, sharing choice and usage on a fresh database", () => {
    expect(migrations).toMatch(/"added_by"\s+TEXT\s+NOT NULL\s+DEFAULT 'DOCTOR'/);
    expect(migrations).toMatch(/"is_shared_with_doctor"\s+BOOLEAN\s+NOT NULL\s+DEFAULT true/);
    expect(migrations).toMatch(/"usage_logs"\s+TEXT\[\]\s+(?:NOT NULL\s+)?DEFAULT (?:ARRAY\[\]|'\{\}')/);
  });

  it("supports patient-added prescriptions without a doctor, as the current schema requires", () => {
    expect(migrations).toMatch(/ALTER TABLE "prescriptions"[\s\S]*?ALTER COLUMN "doctor_id" DROP NOT NULL/);
  });
});
