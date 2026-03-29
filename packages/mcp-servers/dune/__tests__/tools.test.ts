import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { DuneClient } from '../src/tools.js';

describe('DuneClient', () => {
  let client: DuneClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new DuneClient('test-api-key');
  });

  describe('executeQuery', () => {
    it('executes a Dune query by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            rows: [{ wallet: '0xabc', volume_usd: 15000 }],
            execution_id: 'exec-123',
          },
        }),
      });

      const result = await client.executeQuery(12345);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].volume_usd).toBe(15000);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dune.com/api/v1/query/12345/execute',
        expect.objectContaining({ headers: expect.objectContaining({ 'X-DUNE-API-Key': 'test-api-key' }) })
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(client.executeQuery(1)).rejects.toThrow('Dune API error: 401');
    });
  });

  describe('getQueryResults', () => {
    it('retrieves cached query results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            rows: [{ token: 'SOL', price: 150.5 }],
            result_set_rows: 1,
          },
        }),
      });

      const result = await client.getQueryResults(99999);
      expect(result.rows).toHaveLength(1);
    });
  });
});
