import { APIRequestContext, expect } from '@playwright/test';

/**
 * Feature-flag control through flagd-ui's read/write API behind the proxy: the same mechanism the
 * demo's own Cypress suite uses (src/frontend/cypress/e2e/CheckoutPaymentFailure.cy.ts).
 *
 * Flags are global to the stack, so only the serial specs (*.serial.spec.ts) use this. Every flag a test
 * changes is put back by restore(), which the `flags` fixture calls when the test ends.
 */
export class FlagdApi {
  private readonly originals = new Map<string, string>();

  constructor(private readonly request: APIRequestContext) {}

  /** Set a flag's default variant and wait until flagd itself evaluates it that way (about 2 s). */
  async set(flag: string, variant: string): Promise<void> {
    const config = await (await this.request.get('/feature/api/read')).json();
    const current = config.flags[flag];
    if (!current) throw new Error(`Unknown flag: ${flag}`);
    if (!(variant in current.variants)) throw new Error(`Unknown variant ${variant} for ${flag}`);

    if (!this.originals.has(flag)) this.originals.set(flag, current.defaultVariant);
    current.defaultVariant = variant;
    const res = await this.request.post('/feature/api/write', { data: { data: config } });
    if (!res.ok()) throw new Error(`Failed to set ${flag}=${variant}: HTTP ${res.status()}`);

    // The write lands in a file that flagd re-reads. Poll flagd's evaluation instead of sleeping.
    await expect
      .poll(() => this.evaluatedVariant(flag), { message: `${flag} -> ${variant}`, timeout: 15_000 })
      .toBe(variant);
  }

  /** Put every flag this instance changed back to the variant it had before. */
  async restore(): Promise<void> {
    for (const [flag, variant] of [...this.originals]) {
      await this.set(flag, variant);
      this.originals.delete(flag);
    }
  }

  private async evaluatedVariant(flag: string): Promise<string | undefined> {
    const res = await this.request.post('/flagservice/flagd.evaluation.v1.Service/ResolveAll', { data: { context: {} } });
    return (await res.json()).flags?.[flag]?.variant;
  }
}
