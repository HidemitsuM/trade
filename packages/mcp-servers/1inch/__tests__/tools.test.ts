import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { OneInchClient } from '../src/tools.js';

describe('OneInchClient', () => {
  let client: OneInchClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new OneInchClient('test-api-key', 56);
  });

  describe('getQuote', () => {
    it('returns a swap quote for a token pair on BSC', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          fromToken: { symbol: 'BNB', address: '0x...bnb' },
          toToken: { symbol: 'BUSD', address: '0x...busd' },
          fromTokenAmount: '1000000000000000000',
          toTokenAmount: '580000000000000000000',
          estimatedGas: 150000,
        }),
      });
      const quote = await client.getQuote('0xWBNB', '0xBUSD', '1000000000000000000');
      expect(quote.toTokenAmount).toBe('580000000000000000000');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/swap/v6.0/56/quote'), expect.anything());
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
      await expect(client.getQuote('0xA', '0xB', '1')).rejects.toThrow('1inch API error: 400');
    });
  });

  describe('getSpender', () => {
    it('returns the 1inch spender address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ address: '0x1111111254eeb25477b68fb85ed929f73a960582' }),
      });
      const spender = await client.getSpender();
      expect(spender).toBe('0x1111111254eeb25477b68fb85ed929f73a960582');
    });
  });
});
