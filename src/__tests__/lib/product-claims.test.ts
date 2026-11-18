import { readFileSync } from "node:fs";
import path from "node:path";
import { PRIVACY_NOTICE } from "@/lib/amelia/safety";
test.each([
  "src/app/page.tsx", "src/app/layout.tsx",
  "src/components/settings/SettingsPanel.tsx", "src/components/amelia/AmeliaChat.tsx",
  "src/app/(admin)/admin/settings/page.tsx", "src/lib/amelia/prompts.ts",
])("removes unconditional regulatory claims from %s", file => {
  expect(/HIPAA|GDPR/.test(readFileSync(path.join(process.cwd(), file), "utf8"))).toBe(false);
});
test("the assistant privacy notice avoids a regulatory guarantee", () => {
  expect(PRIVACY_NOTICE).not.toMatch(/HIPAA|GDPR|protected under applicable health privacy/);
});
test("chat does not claim a peer is online without presence evidence", () => {
  expect(readFileSync(path.join(process.cwd(), "src/components/chat/ChatWindow.tsx"), "utf8")).not.toMatch(/>Online</);
});
test.each(["src/components/settings/SettingsPanel.tsx", "src/app/(admin)/admin/settings/page.tsx"])("does not hardcode operational service status in %s", file => {
  expect(/Operational|status: "operational"/.test(readFileSync(path.join(process.cwd(), file), "utf8"))).toBe(false);
});
