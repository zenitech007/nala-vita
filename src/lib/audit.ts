import { z } from "zod";
import { prisma } from "@/lib/prisma";

const auditMetadata = z.object({
  appointmentId: z.string().max(128).regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/).optional(),
  status: z.enum(["PENDING", "APPROVED", "DENIED", "REJECTED", "VERIFIED", "COMPLETED", "CANCELLED", "REVOKED"]).optional(),
  role: z.enum(["PATIENT", "DOCTOR", "ADMIN"]).optional(),
  date: z.iso.date().optional(),
  isPrivate: z.boolean().optional(),
  isSharedWithDoctor: z.boolean().optional(),
  taken: z.boolean().optional(),
  urgency: z.enum(["routine", "emergency"]).optional(),
  redFlagCount: z.number().int().min(0).max(1000).optional(),
  streamed: z.boolean().optional(),
});

interface AuditInput {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

/** Persist only approved metadata fields. Monitoring receives a structured event on failure. */
export async function logAudit(input: AuditInput): Promise<void> {
  const action = input.action.toUpperCase();
  const resourceType = input.resourceType.toUpperCase();
  const metadata = auditMetadata.safeParse(input.metadata ?? {});
  try {
    await prisma.auditLog.create({ data: {
      userId: input.userId,
      action,
      resourceType,
      resourceId: input.resourceId,
      metadata: metadata.success && Object.keys(metadata.data).length ? JSON.stringify(metadata.data) : null,
    } });
  } catch {
    console.error(JSON.stringify({ event: "audit.write_failed", action, resourceType }));
  }
}
