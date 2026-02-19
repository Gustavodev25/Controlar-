import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

describe('Asaas payment - card token persistence', () => {
  it('should use creditCardToken and persist token on annual installments flow', async () => {
    const routesPath = path.join(process.cwd(), 'api', 'routes.js');
    const content = await readFile(routesPath, 'utf8');

    const start = content.indexOf('CASE 1: Annual Plan with Installments');
    expect(start).toBeGreaterThan(-1);

    const end = content.indexOf("const payment = await asaasRequest('POST', '/payments'", start);
    expect(end).toBeGreaterThan(start);

    const segment = content.slice(start, end);

    expect(segment).toContain("asaasRequest('POST', '/creditCard/tokenizeCreditCard'");
    expect(segment).toContain("'subscription.creditCardToken'");
    expect(segment).toContain("'profile.subscription.creditCardToken'");

    const paymentDataMatch = segment.match(/const paymentData = \{[\s\S]*?\r?\n\s*\};/);
    expect(paymentDataMatch).not.toBeNull();
    expect(paymentDataMatch?.[0]).toContain('creditCardToken: creditCardToken');
    expect(paymentDataMatch?.[0]).not.toContain('creditCard:');
  });
});
