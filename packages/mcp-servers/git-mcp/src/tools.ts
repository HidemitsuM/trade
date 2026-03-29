const GITHUB_API = 'https://api.github.com';

export interface RepoInfo {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  updated_at: string;
}

export class GitHubClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github.v3+json',
    };
  }

  async searchRepos(query: string): Promise<RepoInfo[]> {
    const res = await fetch(`${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json() as { items: RepoInfo[] };
    return data.items;
  }

  async getFileContent(repo: string, path: string): Promise<string> {
    const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json() as { content: string; encoding: string };
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async getRepoInfo(repo: string): Promise<RepoInfo> {
    const res = await fetch(`${GITHUB_API}/repos/${repo}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    return res.json() as Promise<RepoInfo>;
  }
}
