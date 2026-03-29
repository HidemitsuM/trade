import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GitHubClient } from '../src/tools.js';

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new GitHubClient('test-token');
  });

  describe('searchRepos', () => {
    it('searches GitHub repositories by query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          total_count: 1,
          items: [
            { full_name: 'user/crypto-sentiment', description: 'Crypto sentiment analysis', html_url: 'https://github.com/user/crypto-sentiment', stargazers_count: 42 },
          ],
        }),
      });

      const repos = await client.searchRepos('crypto sentiment');
      expect(repos).toHaveLength(1);
      expect(repos[0].full_name).toBe('user/crypto-sentiment');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search/repositories?q=crypto%20sentiment'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
      );
    });
  });

  describe('getFileContent', () => {
    it('reads file content from a repository', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: Buffer.from('line1\nline2\nline3').toString('base64'),
          encoding: 'base64',
        }),
      });

      const content = await client.getFileContent('user/repo', 'data/sentiment.csv');
      expect(content).toBe('line1\nline2\nline3');
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(client.getFileContent('user/repo', 'missing.txt')).rejects.toThrow('GitHub API error: 404');
    });
  });

  describe('getRepoInfo', () => {
    it('returns repository metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          full_name: 'user/repo',
          description: 'Test repo',
          stargazers_count: 100,
          updated_at: '2026-03-29T00:00:00Z',
        }),
      });

      const info = await client.getRepoInfo('user/repo');
      expect(info.stargazers_count).toBe(100);
    });
  });
});
