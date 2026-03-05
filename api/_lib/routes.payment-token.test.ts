import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

describe('Asaas payment - direct credit card architecture', () => {
  it('should pass creditCard data directly without manual tokenization', async () => {
    // Ensure accurate path to routes.js
    const routesPath = path.join(process.cwd(), 'api', '_lib', 'routes.js');
    const content = await readFile(routesPath, 'utf8');

    // 1. Assert tokenization endpoint is NO LONGER called
    expect(content).not.toContain("asaasRequest('POST', '/creditCard/tokenize'");
    expect(content).not.toContain("asaasRequest('POST', '/creditCard/tokenizeCreditCard'");

    // 2. Assert we are NO LONGER saving the token to Firestore
    expect(content).not.toContain("'subscription.creditCardToken':");
    expect(content).not.toContain("'profile.subscription.creditCardToken':");

    // 3. Assert we DO save the last 4 digits
    expect(content).toContain("'subscription.creditCardLast4':");

    // 4. Assert the payload injects 'creditCard' wrapper
    // Check that 'creditCard: {' is present in the file multiple times now
    const creditCardMatches = content.match(/creditCard: \{/g);
    expect(creditCardMatches?.length).toBeGreaterThan(0);

    // 5. Assert 'creditCardHolderInfo' is present
    expect(content).toContain('creditCardHolderInfo: {');
  });
});
