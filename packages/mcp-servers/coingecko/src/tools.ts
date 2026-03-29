const GECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number;
}

export interface TokenDetail {
  price: number;
  volume_24h: number;
  price_change_pct_24h: number;
  market_cap_rank: number;
}

export class CoinGeckoClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.apiKey) h['x-cg-demo-api-key'] = this.apiKey;
    return h;
  }

  async getPrice(coinId: string, vsCurrency = 'usd'): Promise<number> {
    const res = await fetch(
      `${GECKO_BASE_URL}/simple/price?ids=${coinId}&vs_currencies=${vsCurrency}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
    const data = await res.json() as Record<string, Record<string, number>>;
    return data[coinId][vsCurrency];
  }

  async getTrending(): Promise<TrendingCoin[]> {
    const res = await fetch(`${GECKO_BASE_URL}/search/trending`, { headers: this.headers() });
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
    const data = await res.json() as {
      coins: Array<{ item: { id: string; name: string; symbol: string; market_cap_rank: number } }>;
    };
    return data.coins.map((c) => ({
      id: c.item.id,
      name: c.item.name,
      symbol: c.item.symbol,
      market_cap_rank: c.item.market_cap_rank,
    }));
  }

  async getTokenInfo(coinId: string): Promise<TokenDetail> {
    const res = await fetch(`${GECKO_BASE_URL}/coins/${coinId}?localization=false&tickers=false`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
    const data = await res.json() as {
      market_cap_rank: number;
      market_data: {
        current_price: { usd: number };
        total_volume: { usd: number };
        price_change_percentage_24h: number;
      };
    };
    return {
      price: data.market_data.current_price.usd,
      volume_24h: data.market_data.total_volume.usd,
      price_change_pct_24h: data.market_data.price_change_percentage_24h,
      market_cap_rank: data.market_cap_rank,
    };
  }
}
