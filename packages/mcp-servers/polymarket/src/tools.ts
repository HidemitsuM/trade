const POLY_API = 'https://clob.polymarket.com';

export interface Market {
  condition_id: string;
  question: string;
  outcomes: string[];
  active: boolean;
}

export interface OrderbookEntry {
  price: number;
  size: number;
}

export interface Orderbook {
  bids: OrderbookEntry[];
  asks: OrderbookEntry[];
}

export class PolymarketClient {
  private apiKey: string;
  private privateKey: string;

  constructor(apiKey: string, privateKey: string) {
    this.apiKey = apiKey;
    this.privateKey = privateKey;
  }

  private headers(): Record<string, string> {
    return { 'POLY_API_KEY': this.apiKey, 'POLY_SECRET': this.privateKey, 'Content-Type': 'application/json' };
  }

  async getMarkets(): Promise<Market[]> {
    const res = await fetch(`${POLY_API}/markets`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
    return res.json() as Promise<Market[]>;
  }

  async getOrderbook(tokenId: string): Promise<Orderbook> {
    const res = await fetch(`${POLY_API}/book?token_id=${tokenId}`);
    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
    return res.json() as Promise<Orderbook>;
  }
}
