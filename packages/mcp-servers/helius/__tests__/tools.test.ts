import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { HeliusClient } from '../src/tools.js';

describe('HeliusClient', () => {
  let client: HeliusClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new HeliusClient('https://mainnet.helius-rpc.com?api-key=test-key');
  });

  describe('getTransaction', () => {
    it('fetches transaction details by signature', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            signature: 'abc123',
            slot: 123456,
            meta: { err: null, fee: 5000 },
          },
        }),
      });

      const tx = await client.getTransaction('abc123');
      expect(tx.signature).toBe('abc123');
      expect(tx.slot).toBe(123456);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(client.getTransaction('bad')).rejects.toThrow('Helius API error: 500');
    });
  });

  describe('getTokenInfo', () => {
    it('returns token metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            mint: 'TokenMintAddress',
            decimals: 9,
            symbol: 'SOL',
          },
        }),
      });

      const info = await client.getTokenInfo('TokenMintAddress');
      expect(info.symbol).toBe('SOL');
      expect(info.decimals).toBe(9);
    });
  });

  describe('getAccountBalance', () => {
    it('returns SOL balance in lamports', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: { value: 5000000000, lamports: 5000000000 },
        }),
      });

      const balance = await client.getAccountBalance('wallet123');
      expect(balance.lamports).toBe(5000000000);
    });
  });
});
