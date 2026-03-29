export class BscClient {
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
    if (!res.ok) throw new Error(`BSC RPC error: ${res.status}`);
    const data = await res.json() as { result: unknown };
    return data.result;
  }

  async getBalance(address: string): Promise<string> {
    return this.rpcCall('eth_getBalance', [address, 'latest']) as Promise<string>;
  }

  async callContract(contractAddress: string, data: string): Promise<string> {
    const params: unknown[] = [{ to: contractAddress, data }, 'latest'];
    return this.rpcCall('eth_call', params) as Promise<string>;
  }

  async getTransactionCount(address: string): Promise<string> {
    return this.rpcCall('eth_getTransactionCount', [address, 'latest']) as Promise<string>;
  }
}
