import { z } from "zod";

const cursorSchema = z.object({ id: z.string().min(1).max(128), at: z.iso.datetime() }).strict();
const paginationSchema = z.object({
  limit: z.number().finite().int().min(1).max(100),
  cursor: cursorSchema.nullable(),
});
export class PaginationError extends Error {}
export type PageCursor = z.infer<typeof cursorSchema>;
/** Bounded keyset pagination. Cursors are positions, never authorization. */
export function parsePagination(query: URLSearchParams, defaultLimit = 30) {
  const raw = Number(query.get("limit") ?? defaultLimit);
  const limit = Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.trunc(raw))) : defaultLimit;
  let cursor: PageCursor | null = null;
  const encoded = query.get("cursor");
  if (encoded) {
    try {
      if (encoded.length > 1024) throw new Error();
      cursor = cursorSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    } catch { throw new PaginationError("Invalid pagination cursor"); }
  }
  return paginationSchema.parse({limit, cursor});
}
export function cursorWhere(cursor: PageCursor | null, field: "createdAt" | "recordedAt" | "updatedAt") {
  if (!cursor) return {};
  const at = new Date(cursor.at);
  return { OR: [{ [field]: { lt: at } }, { [field]: at, id: { lt: cursor.id } }] };
}
export function pageResult<T extends {id: string}>(rows: T[], limit: number, field: keyof T) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const at = last?.[field];
  const nextCursor = rows.length > limit && last && at instanceof Date
    ? Buffer.from(JSON.stringify({id:last.id, at:at.toISOString()})).toString("base64url") : null;
  return {items, nextCursor};
}
