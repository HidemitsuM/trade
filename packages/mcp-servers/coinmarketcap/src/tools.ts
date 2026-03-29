const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com';

export interface Quote {
  price: number;
  market_cap: number;
  volume_24h: number;
  percent_change_24h: number;
}

export interface FearGreed {
  value: number;
  classification: string;
}

export class CoinMarketCapClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getLatestQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const res = await fetch(`${CMC_BASE_URL}/v2/cryptocurrency/quotes/latest?symbol=${symbols.join(',')}`, {
      headers: { 'X-CMC_PRO_API_KEY': this.apiKey },
    });
    if (!res.ok) throw new Error(`CoinMarketCap API error: ${res.status}`);
    const data = await res.json() as {
      data: Record<string, { quote: { USD: { price: number; market_cap: number; volume_24h: number; percent_change_24h: number } } }>;
    };

    const result: Record<string, Quote> = {};
    for (const [symbol, info] of Object.entries(data.data)) {
      result[symbol] = info.quote.USD;
    }
    return result;
  }

  async getFearGreed(): Promise<FearGreed> {
    const res = await fetch(`${CMC_BASE_URL}/v3/fear-and-greed`, {
      headers: { 'X-CMC_PRO_API_KEY': this.apiKey },
    });
    if (!res.ok) throw new Error(`CoinMarketCap API error: ${res.status}`);
    const data = await res.json() as { data: { value: number; value_classification: string } };
    return { value: data.data.value, classification: data.data.value_classification };
  }
}
