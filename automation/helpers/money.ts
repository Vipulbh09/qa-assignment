// Money as the demo's protos define it: whole units plus nanos (1e-9 of a unit).
// Comparisons use integer nanos, never floats, so the tests can't share the bug they look for.

export type Money = { currencyCode: string; units?: number | string; nanos?: number };

const NANOS = 1_000_000_000n;

export const toNanos = (m: Money): bigint => BigInt(m.units ?? 0) * NANOS + BigInt(m.nanos ?? 0);

/** Money rounded to cents, e.g. 57.08, for readable assertions. */
export const toCents = (m: Money): number => Number((toNanos(m) + 5_000_000n) / 10_000_000n) / 100;

export const format = (m: Money): string => `${m.currencyCode} ${toCents(m).toFixed(2)}`;
