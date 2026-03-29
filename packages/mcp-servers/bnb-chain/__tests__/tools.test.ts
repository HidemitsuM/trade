import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { BscClient } from '../src/tools.js';

describe('BscClient', () => {
  let client: BscClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new BscClient('https://bsc-dataseed.binance.org/');
  });

  describe('getBalance', () => {
    it('returns BNB balance in wei', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: '0x4563918244f40000' }),
      });
      const balance = await client.getBalance('0xwallet123');
      expect(balance).toBe('0x4563918244f40000');
    });
  });

  describe('callContract', () => {
    it('calls a smart contract read method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000' }),
      });
      const result = await client.callContract('0xTokenAddr', '0x70a08231');
      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: expect.stringContaining('eth_call') }));
    });
  });

  describe('getTransactionCount', () => {
    it('returns nonce for an address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: '0x5' }),
      });
      const count = await client.getTransactionCount('0xwallet123');
      expect(count).toBe('0x5');
    });
  });
});
