// src/lib/amelia/audit.ts
import { prisma } from "@/lib/prisma";

const PHI_PATTERNS: { test: RegExp; replace: string }[] = [
  { test: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replace: "[email]" },
  { test: /\b\+?\d[\d\s-]{7,}\d\b/g, replace: "[phone]" },
];

export function stripPhi(text: string): string {
  return PHI_PATTERNS.reduce((acc, p) => acc.replace(p.test, p.replace), text);
}

export async function logAmeliaAudit(params: {
  userId: string;
  action: string;
  conversationId: string;
  summary: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resourceType: "AmeliaConversation",
      resourceId: params.conversationId,
      metadata: stripPhi(params.summary).slice(0, 500),
    },
  });
}
