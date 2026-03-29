import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { PhantomClient } from '../src/tools.js';

describe('PhantomClient', () => {
  let client: PhantomClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new PhantomClient('https://mainnet.helius-rpc.com?api-key=test', 'test-private-key');
  });

  describe('getBalance', () => {
    it('returns SOL balance for a wallet', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: { value: 5000000000 } }),
      });

      const balance = await client.getBalance('wallet123');
      expect(balance).toBe(5000000000);
    });
  });

  describe('sendTransaction', () => {
    it('sends a signed transaction and returns signature', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: 'txSignature123' }),
      });

      const sig = await client.sendTransaction('serialized-txn-data');
      expect(sig).toBe('txSignature123');
    });

    it('throws on failed transaction', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: null }) });
      await expect(client.sendTransaction('bad-txn')).rejects.toThrow('Transaction failed');
    });
  });

  describe('getTokenAccounts', () => {
    it('returns token accounts for a wallet', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: { value: [
            { account: { data: 'parsed', info: { mint: 'TokenMint1', amount: '1000' } } },
            { account: { data: 'parsed', info: { mint: 'TokenMint2', amount: '500' } } },
          ]},
        }),
      });

      const accounts = await client.getTokenAccounts('wallet123');
      expect(accounts).toHaveLength(2);
    });
  });
});
