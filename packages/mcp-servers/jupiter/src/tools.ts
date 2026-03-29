const JUPITER_API = 'https://quote-api.jup.ag/v6';

export interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number;
}

export interface Quote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
}

export interface RoutesResult {
  routesSummary: Array<{ inAmount: string; outAmount: string; kind: string }>;
}

export class JupiterClient {
  async getQuote(req: QuoteRequest): Promise<Quote> {
    const params = new URLSearchParams({ inputMint: req.inputMint, outputMint: req.outputMint, amount: String(req.amount) });
    const res = await fetch(`${JUPITER_API}/quote?${params}`);
    if (!res.ok) throw new Error(`Jupiter API error: ${res.status}`);
    return res.json() as Promise<Quote>;
  }

  async getRoutes(req: QuoteRequest): Promise<RoutesResult> {
    const params = new URLSearchParams({ inputMint: req.inputMint, outputMint: req.outputMint, amount: String(req.amount) });
    const res = await fetch(`${JUPITER_API}/routes?${params}`);
    if (!res.ok) throw new Error(`Jupiter API error: ${res.status}`);
    return res.json() as Promise<RoutesResult>;
  }
}
