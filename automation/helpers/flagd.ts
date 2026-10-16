import { APIRequestContext, expect } from '@playwright/test';

// flagd-ui's read/write API behind the proxy: the same mechanism the demo's own
// Cypress suite uses (src/frontend/cypress/e2e/CheckoutPaymentFailure.cy.ts).
// Flags are global to the stack, so only the serial "faults" project may call this.

async function evaluatedVariant(request: APIRequestContext, flag: string): Promise<string | undefined> {
  const res = await request.post('/flagservice/flagd.evaluation.v1.Service/ResolveAll', { data: { context: {} } });
  return (await res.json()).flags?.[flag]?.variant;
}

export async function setFlag(request: APIRequestContext, flag: string, variant: string) {
  const config = await (await request.get('/feature/api/read')).json();
  if (!config.flags[flag]) throw new Error(`Unknown flag: ${flag}`);
  if (!(variant in config.flags[flag].variants)) throw new Error(`Unknown variant ${variant} for ${flag}`);
  config.flags[flag].defaultVariant = variant;
  const res = await request.post('/feature/api/write', { data: { data: config } });
  if (!res.ok()) throw new Error(`Failed to set ${flag}=${variant}: HTTP ${res.status()}`);

  // The write lands in a file that flagd re-reads; it takes ~2s before services see it.
  // Wait on flagd's own evaluation rather than sleeping a fixed time.
  await expect
    .poll(() => evaluatedVariant(request, flag), { message: `${flag} -> ${variant}`, timeout: 15_000 })
    .toBe(variant);
}
