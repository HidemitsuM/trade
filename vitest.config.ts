import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@trade/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@trade/agent-arb-scanner': path.resolve(__dirname, 'packages/agents/arb-scanner/src/agent.js'),
      '@trade/agent-pump-sniper': path.resolve(__dirname, 'packages/agents/pump-sniper/src/agent.js'),
      '@trade/agent-spread-farmer': path.resolve(__dirname, 'packages/agents/spread-farmer/src/agent.js'),
      '@trade/agent-whale-tracker': path.resolve(__dirname, 'packages/agents/whale-tracker/src/agent.js'),
      '@trade/agent-copy-trader': path.resolve(__dirname, 'packages/agents/copy-trader/src/agent.js'),
      '@trade/agent-news-edge': path.resolve(__dirname, 'packages/agents/news-edge/src/agent.js'),
      '@trade/agent-liquidity-hunter': path.resolve(__dirname, 'packages/agents/liquidity-hunter/src/agent.js'),
      '@trade/agent-portfolio-guard': path.resolve(__dirname, 'packages/agents/portfolio-guard/src/agent.js'),
    },
  },
});
