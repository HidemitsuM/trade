export interface TransactionInfo {
  signature: string;
  slot: number;
  meta: { err: unknown; fee: number } | null;
}

export interface TokenInfo {
  mint: string;
  decimals: number;
  symbol: string;
}

export interface BalanceInfo {
  lamports: number;
  value: number;
}

export interface SignatureInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
}

export class HeliusClient {
  private rpcUrl: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
  }

  private async rpcCall(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error(`Helius API error: ${res.status}`);
    const data = await res.json() as { result: unknown };
    return data.result;
  }

  async getTransaction(signature: string): Promise<TransactionInfo> {
    const result = await this.rpcCall('getTransaction', [
      signature,
      { encoding: 'json', commitment: 'confirmed' },
    ]) as TransactionInfo;
    return result;
  }

  async getTokenInfo(mint: string): Promise<TokenInfo> {
    const result = await this.rpcCall('getAsset', [mint]) as TokenInfo;
    return result;
  }

  async getAccountBalance(address: string): Promise<BalanceInfo> {
    const result = await this.rpcCall('getBalance', [address]) as BalanceInfo;
    return result;
  }

  async getSignaturesForAddress(address: string, limit: number = 10): Promise<SignatureInfo[]> {
    const result = await this.rpcCall('getSignaturesForAddress', [
      address,
      { limit },
    ]) as SignatureInfo[];
    return result;
  }
}
