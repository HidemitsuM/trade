import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { PolymarketClient } from '../src/tools.js';

describe('PolymarketClient', () => {
  let client: PolymarketClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new PolymarketClient('test-api-key', 'test-private-key');
  });

  describe('getMarkets', () => {
    it('returns active markets', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { condition_id: '0xabc', question: 'Will BTC hit 100k?', outcomes: ['Yes', 'No'], active: true },
          { condition_id: '0xdef', question: 'ETH above 5k?', outcomes: ['Yes', 'No'], active: true },
        ]),
      });
      const markets = await client.getMarkets();
      expect(markets).toHaveLength(2);
      expect(markets[0].question).toBe('Will BTC hit 100k?');
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(client.getMarkets()).rejects.toThrow('Polymarket API error: 401');
    });
  });

  describe('getOrderbook', () => {
    it('returns orderbook for a market', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          bids: [{ price: 0.55, size: 100 }],
          asks: [{ price: 0.58, size: 200 }],
        }),
      });
      const book = await client.getOrderbook('token-id-123');
      expect(book.bids).toHaveLength(1);
      expect(book.asks[0].price).toBe(0.58);
    });
  });
});
