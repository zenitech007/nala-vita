export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchJson<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(0, "Could not reach the service. Check your connection and retry.");
  }
  if (response.status === 204) return undefined as T;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(response.status, response.ok ? "The service returned an invalid response." : "The request failed. Please retry.");
  }
  if (!response.ok) {
    const body = data as { error?: unknown; code?: unknown } | null;
    throw new ApiError(
      response.status,
      typeof body?.error === "string" ? body.error : "The request failed. Please retry.",
      typeof body?.code === "string" ? body.code : undefined,
    );
  }
  return data as T;
}
