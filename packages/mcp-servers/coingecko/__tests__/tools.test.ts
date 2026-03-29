import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { CoinGeckoClient } from '../src/tools.js';

describe('CoinGeckoClient', () => {
  let client: CoinGeckoClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new CoinGeckoClient('test-api-key');
  });

  describe('getPrice', () => {
    it('returns current price for a coin', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ solana: { usd: 150.5 } }),
      });

      const price = await client.getPrice('solana');
      expect(price).toBe(150.5);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
      await expect(client.getPrice('bitcoin')).rejects.toThrow('CoinGecko API error: 429');
    });
  });

  describe('getTrending', () => {
    it('returns trending coins', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          coins: [
            { item: { id: 'pepe', name: 'Pepe', symbol: 'PEPE', market_cap_rank: 23 } },
            { item: { id: 'bonk', name: 'Bonk', symbol: 'BONK', market_cap_rank: 45 } },
          ],
        }),
      });

      const trending = await client.getTrending();
      expect(trending).toHaveLength(2);
      expect(trending[0].symbol).toBe('PEPE');
    });
  });

  describe('getTokenInfo', () => {
    it('returns detailed token information', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          market_cap_rank: 5,
          market_data: {
            current_price: { usd: 150.5 },
            total_volume: { usd: 2500000000 },
            price_change_percentage_24h: 3.2,
          },
        }),
      });

      const info = await client.getTokenInfo('solana');
      expect(info.price).toBe(150.5);
      expect(info.volume_24h).toBe(2500000000);
    });
  });
});
