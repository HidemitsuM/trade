import { chromium, type Browser } from 'playwright';

export interface ScrapeResult {
  title: string;
  content: string;
  url: string;
}

export class BrowserClient {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  async scrapePage(url: string, timeout = 30000): Promise<ScrapeResult> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto(url, { timeout, waitUntil: 'domcontentloaded' });
      const [title, content] = await Promise.all([page.title(), page.content()]);
      return { title, content, url };
    } finally {
      await page.close();
    }
  }

  async checkSocial(url: string, timeout = 10000): Promise<ScrapeResult> {
    return this.scrapePage(url, timeout);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
