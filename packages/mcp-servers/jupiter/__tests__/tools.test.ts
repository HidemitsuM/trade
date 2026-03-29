import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { JupiterClient } from '../src/tools.js';

describe('JupiterClient', () => {
  let client: JupiterClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new JupiterClient();
  });

  describe('getQuote', () => {
    it('returns a swap quote for a token pair', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          inAmount: '100000000',
          outAmount: '5670000',
          priceImpactPct: 0.12,
        }),
      });
      const quote = await client.getQuote({ inputMint: 'So11111111111111111111111111111111111111112', outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amount: 100000000 });
      expect(quote.outAmount).toBe('5670000');
      expect(quote.priceImpactPct).toBe(0.12);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
      await expect(client.getQuote({ inputMint: 'So1', outputMint: 'EPj', amount: 100 })).rejects.toThrow('Jupiter API error: 400');
    });
  });

  describe('getRoutes', () => {
    it('returns available swap routes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routesSummary: [
            { inAmount: '100000000', outAmount: '5600000', kind: 'Route' },
            { inAmount: '100000000', outAmount: '5550000', kind: 'Route' },
          ],
        }),
      });
      const routes = await client.getRoutes({ inputMint: 'So1', outputMint: 'EPj', amount: 100000000 });
      expect(routes.routesSummary).toHaveLength(2);
    });
  });
});
