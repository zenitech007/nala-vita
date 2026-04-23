import { prisma } from "@/lib/prisma";

// ─── PHI field patterns to strip from metadata ───────────
// HIPAA Safe Harbor: these fields must never appear in audit logs

const PHI_PATTERNS = [
  /name/i,
  /first.?name/i,
  /last.?name/i,
  /email/i,
  /phone/i,
  /address/i,
  /date.?of.?birth/i,
  /dob/i,
  /ssn/i,
  /social.?security/i,
  /insurance.?number/i,
  /insurance.?provider/i,
  /emergency.?name/i,
  /emergency.?phone/i,
  /avatar/i,
  /ip.?address/i,
  /license.?number/i,
  /blood.?type/i,
  /allergies/i,
  /medical.?record/i,
  /mrn/i,
  /content/i,
  /notes/i,
  /bio/i,
];

/**
 * Recursively strip PHI fields from an object.
 * Returns a sanitized copy safe for audit logging.
 */
function stripPhi(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip any key that matches a PHI pattern
    if (PHI_PATTERNS.some((pattern) => pattern.test(key))) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    // Recursively sanitize nested objects
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = stripPhi(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        item !== null && typeof item === "object"
          ? stripPhi(item as Record<string, unknown>)
          : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ─── Audit log input ─────────────────────────────────────

interface AuditInput {
  /** Prisma User.id of the actor */
  userId: string;
  /** Action performed: READ, CREATE, UPDATE, DELETE, EXPORT, LOGIN, etc. */
  action: string;
  /** Type of resource: PATIENT_RECORD, PRESCRIPTION, APPOINTMENT, LAB_ORDER, etc. */
  resourceType: string;
  /** ID of the specific resource being accessed */
  resourceId: string;
  /** Optional extra context — PHI will be automatically stripped */
  metadata?: Record<string, unknown>;
}

/**
 * Write a HIPAA-compliant audit log entry.
 *
 * - All PHI fields are automatically redacted from metadata.
 * - Logs are append-only (no update/delete on audit_logs).
 * - Fire-and-forget: errors are caught and logged to console
 *   so they never break the calling request.
 */
export async function logAudit({
  userId,
  action,
  resourceType,
  resourceId,
  metadata,
}: AuditInput): Promise<void> {
  try {
    const sanitizedMeta = metadata ? stripPhi(metadata) : undefined;

    await prisma.auditLog.create({
      data: {
        userId,
        action: action.toUpperCase(),
        resourceType: resourceType.toUpperCase(),
        resourceId,
        metadata: sanitizedMeta ? JSON.stringify(sanitizedMeta) : null,
      },
    });
  } catch (error) {
    // Audit failures must not break the calling operation.
    // Log to server console for ops alerting.
    console.error("[AUDIT] Failed to write audit log:", error);
  }
}
