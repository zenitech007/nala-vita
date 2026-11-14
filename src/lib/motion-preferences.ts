/** Read at the action so a changed OS preference applies without a reload. */
export function preferredScrollBehavior(): ScrollBehavior {
 return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
