import { createRequire } from "node:module";
const requireConfig = createRequire(process.cwd() + "/package.json");
test("Node test transformation checks diagnostics", () => {
  const config = requireConfig("./jest.config.js");
  const node = config.projects.find((project: { displayName: string }) => project.displayName === "node");
  const transform = Object.values(node.transform)[0] as [string, { diagnostics: unknown }];
  expect(transform[1].diagnostics).toBe(true);
});
