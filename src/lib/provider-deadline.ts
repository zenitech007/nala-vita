import { NextResponse } from "next/server";

export class ProviderTimeoutError extends Error {
  constructor() {
    super("Provider response timed out");
    this.name = "ProviderTimeoutError";
  }
}

function providerBudget(parent: AbortSignal | undefined, milliseconds: number) {
  const controller = new AbortController();
  const signal = parent ? AbortSignal.any([parent, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(new ProviderTimeoutError()), milliseconds);
  return {
    signal,
    close() {
      clearTimeout(timer);
      controller.abort();
    },
  };
}

async function abortable<T>(work: () => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let rejectAbort: (reason: unknown) => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([work(), aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export async function withProviderDeadline<T>(
  work: (signal: AbortSignal) => PromiseLike<T>,
  parent?: AbortSignal,
  milliseconds = 15_000,
): Promise<T> {
  const budget = providerBudget(parent, milliseconds);
  try {
    return await abortable(() => work(budget.signal), budget.signal);
  } finally {
    budget.close();
  }
}

export async function* withProviderStreamDeadline<T>(
  open: (signal: AbortSignal) => PromiseLike<AsyncIterable<T>>,
  parent?: AbortSignal,
): AsyncGenerator<T> {
  const budget = providerBudget(parent, 30_000);
  let iterator: AsyncIterator<T> | undefined;
  try {
    const stream = await abortable(() => open(budget.signal), budget.signal);
    const reader = stream[Symbol.asyncIterator]();
    iterator = reader;
    for (;;) {
      const next = await abortable(() => reader.next(), budget.signal);
      if (next.done) return;
      yield next.value;
    }
  } finally {
    budget.close();
    void iterator?.return?.().catch(() => undefined);
  }
}

export function providerTimeoutResponse(extra?: Record<string, unknown>) {
  return NextResponse.json({
    ...extra, status: "unavailable", reason: "timeout", error: "The provider timed out. Please retry.",
  }, { status: 504 });
}
