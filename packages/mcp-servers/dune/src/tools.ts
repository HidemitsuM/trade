const DUNE_BASE_URL = 'https://api.dune.com/api/v1';

export interface DuneRow {
  [key: string]: unknown;
}

export interface DuneResult {
  rows: DuneRow[];
  execution_id?: string;
  result_set_rows?: number;
}

export class DuneClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async executeQuery(queryId: number): Promise<DuneResult> {
    const res = await fetch(`${DUNE_BASE_URL}/query/${queryId}/execute`, {
      method: 'POST',
      headers: {
        'X-DUNE-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Dune API error: ${res.status}`);
    const data = await res.json() as { result: DuneResult };
    return data.result;
  }

  async getQueryResults(queryId: number): Promise<DuneResult> {
    const res = await fetch(`${DUNE_BASE_URL}/query/${queryId}/results`, {
      headers: { 'X-DUNE-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dune API error: ${res.status}`);
    const data = await res.json() as { result: DuneResult };
    return data.result;
  }
}
