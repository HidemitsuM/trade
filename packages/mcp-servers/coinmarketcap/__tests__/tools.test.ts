import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { CoinMarketCapClient } from '../src/tools.js';

describe('CoinMarketCapClient', () => {
  let client: CoinMarketCapClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new CoinMarketCapClient('test-api-key');
  });

  describe('getLatestQuotes', () => {
    it('returns price quotes for specified symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            SOL: { quote: { USD: { price: 150.5, market_cap: 65000000000 } } },
            ETH: { quote: { USD: { price: 3200.0, market_cap: 385000000000 } } },
          },
        }),
      });

      const quotes = await client.getLatestQuotes(['SOL', 'ETH']);
      expect(quotes.SOL.price).toBe(150.5);
      expect(quotes.ETH.market_cap).toBe(385000000000);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(client.getLatestQuotes(['BTC'])).rejects.toThrow('CoinMarketCap API error: 401');
    });
  });

  describe('getFearGreed', () => {
    it('returns current Fear & Greed index', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { value: 72, value_classification: 'Greed' },
        }),
      });

      const fg = await client.getFearGreed();
      expect(fg.value).toBe(72);
      expect(fg.classification).toBe('Greed');
    });
  });
});
