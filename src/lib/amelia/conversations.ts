// src/lib/amelia/conversations.ts
import { prisma } from "@/lib/prisma";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sentAt: string;
}

/** How many characters of the first user message become the sidebar title. */
const TITLE_MAX = 60;

/**
 * Derives a sidebar title from the first user message. We title on read rather
 * than storing a title column so no extra LLM call or migration is needed.
 */
export function deriveTitle(firstUserMessage: string | undefined): string {
  if (!firstUserMessage) return "New conversation";
  const flat = firstUserMessage.replace(/\s+/g, " ").trim();
  if (!flat) return "New conversation";
  if (flat.length <= TITLE_MAX) return flat;
  // Prefer cutting at a word boundary near the limit.
  const clipped = flat.slice(0, TITLE_MAX);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > TITLE_MAX * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

export async function listConversations(patientId: string, limit = 50): Promise<ConversationSummary[]> {
  const convos = await prisma.ameliaConversation.findMany({
    where: { patientId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      messages: {
        where: { role: "user" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  return convos.map((c) => ({
    id: c.id,
    title: deriveTitle(c.messages[0]?.content),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

/** Loads one conversation's messages, scoped to the owning patient. */
export async function getConversation(
  id: string,
  patientId: string
): Promise<{ id: string; messages: StoredMessage[] } | null> {
  const convo = await prisma.ameliaConversation.findFirst({
    where: { id, patientId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!convo) return null;

  return {
    id: convo.id,
    messages: convo.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      sentAt: m.createdAt.toISOString(),
    })),
  };
}

/** Most recently updated conversation — used to resume on page load. */
export async function getLatestConversation(
  patientId: string
): Promise<{ id: string; messages: StoredMessage[] } | null> {
  const latest = await prisma.ameliaConversation.findFirst({
    where: { patientId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!latest) return null;
  return getConversation(latest.id, patientId);
}

export async function deleteConversation(id: string, patientId: string): Promise<void> {
  // deleteMany (not delete) so a mismatched patientId is a no-op rather than a throw.
  await prisma.ameliaConversation.deleteMany({ where: { id, patientId } });
}
