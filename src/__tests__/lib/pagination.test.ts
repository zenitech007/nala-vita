import { parsePagination, pageResult, cursorWhere, PaginationError } from "@/lib/pagination";

test.each([["9999",100],["-5",1],["NaN",30],["1.9",1],["Infinity",30]])("bounds limit %s", (value, expected) => {
 expect(parsePagination(new URLSearchParams({limit:String(value)})).limit).toBe(expected);
});
test("uses timestamp and id to avoid losing equal-time rows", () => {
 const at = new Date("2026-01-01T00:00:00Z");
 const page = pageResult([{id:"b",createdAt:at},{id:"a",createdAt:at}], 1, "createdAt");
 expect(page.items).toEqual([{id:"b",createdAt:at}]);
 const input=parsePagination(new URLSearchParams({cursor:page.nextCursor!}));
 expect(cursorWhere(input.cursor,"createdAt")).toEqual({OR:[{createdAt:{lt:at}},{createdAt:at,id:{lt:"b"}}]});
});
test.each(["broken", Buffer.from(JSON.stringify({id:"a",at:"not-date"})).toString("base64url"), "x".repeat(1025)])("rejects malformed cursor before querying", cursor => {
 expect(()=>parsePagination(new URLSearchParams({cursor}))).toThrow(PaginationError);
});
test("no cursor after final page",()=>expect(pageResult([],30,"createdAt").nextCursor).toBeNull());
