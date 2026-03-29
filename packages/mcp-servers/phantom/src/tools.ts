export interface TokenAccount {
  mint: string;
  amount: string;
}

export class PhantomClient {
  private rpcUrl: string;
  private privateKey: string;

  constructor(rpcUrl: string, privateKey: string) {
    this.rpcUrl = rpcUrl;
    this.privateKey = privateKey;
  }

  private async rpcCall(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error(`Phantom RPC error: ${res.status}`);
    return (await res.json() as { result: unknown }).result;
  }

  async getBalance(address: string): Promise<number> {
    const result = await this.rpcCall('getBalance', [address]) as { value: number };
    return result.value;
  }

  async sendTransaction(serializedTx: string): Promise<string> {
    const result = await this.rpcCall('sendTransaction', [
      serializedTx,
      { encoding: 'base64' },
    ]) as string | null;
    if (!result) throw new Error('Transaction failed');
    return result;
  }

  async getTokenAccounts(address: string): Promise<TokenAccount[]> {
    const result = await this.rpcCall('getTokenAccountsByOwner', [
      address,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed' },
    ]) as { value: Array<{ account: { info: { mint: string; amount: string } } }> };
    return (result.value ?? []).map((v) => ({
      mint: v.account.info.mint,
      amount: v.account.info.amount,
    }));
  }
}
