import { describe, it, expect } from 'vitest';
import { NewsEdgeStrategy } from '../src/strategy.js';

describe('NewsEdgeStrategy', () => {
  it('enters when sentiment exceeds threshold', () => {
    const strategy = new NewsEdgeStrategy({ sentiment_threshold: 0.7 });
    const decision = strategy.evaluate({ token: 'BTC', sentiment_score: 0.85, fear_greed: 75, source: 'github-sentiment-repo' });
    expect(decision.should_enter).toBe(true);
  });
  it('skips when sentiment is low', () => {
    const strategy = new NewsEdgeStrategy({ sentiment_threshold: 0.7 });
    const decision = strategy.evaluate({ token: 'BTC', sentiment_score: 0.4, fear_greed: 30, source: 'github-sentiment-repo' });
    expect(decision.should_enter).toBe(false);
  });
});
