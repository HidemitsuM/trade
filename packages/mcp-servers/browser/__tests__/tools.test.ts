import { describe, it, expect, vi } from 'vitest';

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        title: vi.fn().mockResolvedValue('Test Page'),
        content: vi.fn().mockResolvedValue('<html><body><h1>Hello</h1></body></html>'),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { BrowserClient } from '../src/tools.js';

describe('BrowserClient', () => {
  describe('scrapePage', () => {
    it('scrapes page title and content', async () => {
      const client = new BrowserClient();
      const result = await client.scrapePage('https://example.com');
      expect(result.title).toBe('Test Page');
      expect(result.content).toContain('<h1>Hello</h1>');
    });
  });

  describe('checkSocial', () => {
    it('returns page content for social analysis', async () => {
      const client = new BrowserClient();
      const result = await client.checkSocial('https://twitter.com/token', 5000);
      expect(result.content).toBeDefined();
    });
  });
});
