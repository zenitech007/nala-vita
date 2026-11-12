import fs from "node:fs";
import postcss from "postcss";
const css = postcss.parse(fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8"));
const rules = new Map();
css.walkRules(rule => {
  const tokens = {};
  rule.walkDecls(declaration => { if (declaration.prop.startsWith("--")) tokens[declaration.prop] = declaration.value; });
  for (const selector of rule.selectors) rules.set(selector, { ...rules.get(selector), ...tokens });
});
function luminance(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error("Expected an opaque six-digit color, received " + hex);
  const values = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
let failed = false;
let checked = 0;
for (const brand of ["rose", "fuchsia", "ocean", "emerald"]) {
  for (const mode of ["light", "dark", "high-contrast"]) {
    const tokens = {
      ...rules.get(":root"), ...rules.get(".theme-" + brand),
      ...rules.get('html[data-brand="' + brand + '"]'),
      ...rules.get("html." + mode),
    };
    const background = tokens["--action-bg"] ?? tokens["--primary"];
    const foreground = tokens["--action-fg"] ?? "#ffffff";
    const pairs = ["", "-hover", "-disabled", "-focus"].map(state => [
      state || "-normal", tokens["--action" + state + "-bg"] ?? background, tokens["--action" + state + "-fg"] ?? foreground,
    ]);
    pairs.push(["-focus-outline", tokens["--focus-outline"] ?? background, tokens["--background"]]);
    for (const [state, bg, fg] of pairs) {
      const ratio = contrast(bg, fg);
      checked++;
      if (ratio < 4.5) {
        failed = true;
        console.error(brand + "/" + mode + state + " contrast " + ratio.toFixed(2) + " is below 4.5");
      }
    }
  }
}
console.log("Checked " + checked + " theme/state contrast pairs.");
if (failed) process.exitCode = 1;
