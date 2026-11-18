import { execFileSync } from "node:child_process";

type Rule = { source: string; headers: { key: string; value: string }[] };
it("F20 permits same-origin camera and microphone only on consultation routes", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e",
    "import config from './next.config.mjs'; console.log(JSON.stringify(await config.headers()));"], { encoding: "utf8" });
  const rules = JSON.parse(output.trim().split("\n").at(-1)!) as Rule[];
  const policy = (rule: Rule) => rule.headers.find(header => header.key === "Permissions-Policy")?.value;
  const globalIndex = rules.findIndex(rule => rule.source === "/(.*)");
  expect(policy(rules[globalIndex])).toContain("camera=(), microphone=()");
  const media = rules.filter(rule => policy(rule)?.includes("camera=(self), microphone=(self)"));
  expect(media.map(rule => rule.source).sort()).toEqual(["/doctor/consultation/:path*", "/patient/telemedicine/:path*"]);
  for (const rule of media) expect(rules.indexOf(rule)).toBeGreaterThan(globalIndex);
});
