const ONEINCH_API = 'https://api.1inch.dev/swap/v6.0';

export interface SwapQuote {
  fromToken: { symbol: string; address: string };
  toToken: { symbol: string; address: string };
  fromTokenAmount: string;
  toTokenAmount: string;
  estimatedGas: number;
}

export class OneInchClient {
  private apiKey: string;
  private chainId: number;

  constructor(apiKey: string, chainId = 56) {
    this.apiKey = apiKey;
    this.chainId = chainId;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  async getQuote(fromTokenAddress: string, toTokenAddress: string, amount: string): Promise<SwapQuote> {
    const params = new URLSearchParams({ src: fromTokenAddress, dst: toTokenAddress, amount });
    const res = await fetch(`${ONEINCH_API}/${this.chainId}/quote?${params}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`1inch API error: ${res.status}`);
    return res.json() as Promise<SwapQuote>;
  }

  async getSpender(): Promise<string> {
    const res = await fetch(`${ONEINCH_API}/${this.chainId}/approve/spender`, { headers: this.headers() });
    if (!res.ok) throw new Error(`1inch API error: ${res.status}`);
    const data = await res.json() as { address: string };
    return data.address;
  }
}
