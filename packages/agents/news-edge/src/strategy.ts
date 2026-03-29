export interface NewsEdgeConfig { sentiment_threshold: number; }
export interface NewsEvalResult { should_enter: boolean; reason?: string; }

export class NewsEdgeStrategy {
  private config: NewsEdgeConfig;
  constructor(config: NewsEdgeConfig) { this.config = config; }
  evaluate(data: { token: string; sentiment_score: number; fear_greed: number; source: string }): NewsEvalResult {
    if (data.sentiment_score >= this.config.sentiment_threshold) {
      return { should_enter: true };
    }
    return { should_enter: false, reason: `Sentiment ${data.sentiment_score} below threshold ${this.config.sentiment_threshold}` };
  }
}
