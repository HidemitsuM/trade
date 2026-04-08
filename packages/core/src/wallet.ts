import type { MCPConnectionPool } from './mcp-pool.js';
import type { Database } from './db.js';
import { logger } from './logger.js';

export interface WalletConfig {
  mcpPool: MCPConnectionPool;
  db: Database;
  walletAddress: string;
  chain: string;
  maxGasLamports?: number;
}

export interface WalletBalance {
  nativeLamports: number;
  nativeSol: number;
  tokens: Array<{ mint: string; amount: string }>;
}

export interface TradeRequest {
  agent: string;
  pair: string;
  side: 'buy' | 'sell';
  amountLamports: number;
  tokenMint: string;
  maxSlippageBps: number;
}

export interface TradeResult {
  success: boolean;
  txHash: string | null;
  inAmount: number;
  outAmount: number;
  priceImpactPct: number;
  feeLamports: number;
  error?: string;
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const GAS_RESERVE = 10000; // lamports reserved for rent + gas

export class WalletManager {
  private mcpPool: MCPConnectionPool;
  private db: Database;
  private walletAddress: string;
  private chain: string;
  private maxGasLamports: number;

  constructor(config: WalletConfig) {
    this.mcpPool = config.mcpPool;
    this.db = config.db;
    this.walletAddress = config.walletAddress;
    this.chain = config.chain;
    this.maxGasLamports = config.maxGasLamports ?? 50000;
  }

  get address(): string {
    return this.walletAddress;
  }

  get chainName(): string {
    return this.chain;
  }

  async getBalance(): Promise<WalletBalance> {
    const balanceResult = await this.mcpPool.callTool('phantom', 'get_balance', { address: this.walletAddress }) as { lamports: number; sol: number };
    const tokenAccounts = await this.mcpPool.callTool('phantom', 'get_token_accounts', { address: this.walletAddress }) as Array<{ mint: string; amount: string }>;

    return {
      nativeLamports: balanceResult.lamports,
      nativeSol: balanceResult.sol,
      tokens: tokenAccounts,
    };
  }

  async hasSufficientBalance(requiredLamports: number): Promise<boolean> {
    try {
      const balance = await this.getBalance();
      return balance.nativeLamports >= requiredLamports + GAS_RESERVE;
    } catch (err) {
      logger.error('Balance check failed', { error: String(err) });
      return false;
    }
  }

  async estimateFee(): Promise<number> {
    // Solana base fee: 5000 lamports per signature
    // Priority fees vary; use conservative estimate
    return 5000;
  }

  async executeTrade(request: TradeRequest): Promise<TradeResult> {
    try {
      // Pre-trade balance check
      const hasBalance = await this.hasSufficientBalance(request.amountLamports);
      if (!hasBalance) {
        return {
          success: false, txHash: null, inAmount: 0, outAmount: 0,
          priceImpactPct: 0, feeLamports: 0, error: 'Insufficient balance',
        };
      }

      // Gas check
      const gasEstimate = await this.estimateFee();
      if (gasEstimate > this.maxGasLamports) {
        return {
          success: false, txHash: null, inAmount: 0, outAmount: 0,
          priceImpactPct: 0, feeLamports: gasEstimate, error: `Gas estimate ${gasEstimate} exceeds max ${this.maxGasLamports}`,
        };
      }

      // Get swap quote via Jupiter
      const inputMint = request.side === 'buy' ? USDC_MINT : request.tokenMint;
      const outputMint = request.side === 'buy' ? request.tokenMint : USDC_MINT;

      const quote = await this.mcpPool.callTool('jupiter', 'get_quote', {
        inputMint, outputMint, amount: request.amountLamports,
      }) as { inAmount: string; outAmount: string; priceImpactPct: number };

      logger.info('Trade quote received', {
        agent: request.agent, pair: request.pair, side: request.side,
        inAmount: quote.inAmount, outAmount: quote.outAmount, impact: quote.priceImpactPct,
      });

      // Check slippage
      if (quote.priceImpactPct * 100 > request.maxSlippageBps) {
        return {
          success: false, txHash: null, inAmount: Number(quote.inAmount), outAmount: Number(quote.outAmount),
          priceImpactPct: quote.priceImpactPct, feeLamports: gasEstimate, error: `Price impact ${quote.priceImpactPct}% exceeds max slippage`,
        };
      }

      // NOTE: Actual transaction signing requires @solana/web3.js integration
      // with the private key. This returns the quote data as a "prepared trade"
      // that would be signed and sent in a production environment.
      logger.warn('Trade prepared but not signed — signing requires @solana/web3.js integration', {
        agent: request.agent, pair: request.pair,
      });

      return {
        success: true,
        txHash: null, // Populated after sendTransaction with signing
        inAmount: Number(quote.inAmount),
        outAmount: Number(quote.outAmount),
        priceImpactPct: quote.priceImpactPct,
        feeLamports: gasEstimate,
      };
    } catch (err) {
      logger.error('Trade execution failed', { error: String(err), agent: request.agent });
      return {
        success: false, txHash: null, inAmount: 0, outAmount: 0,
        priceImpactPct: 0, feeLamports: 0, error: String(err),
      };
    }
  }

  async syncState(): Promise<void> {
    try {
      const balance = await this.getBalance();
      const balanceJson = JSON.stringify({
        nativeLamports: balance.nativeLamports,
        nativeSol: balance.nativeSol,
        tokens: balance.tokens,
      });

      this.db.upsertWalletState({
        id: `wallet-${this.chain}`,
        chain: this.chain,
        address: this.walletAddress,
        balance_json: balanceJson,
        updated_at: new Date().toISOString(),
      });

      logger.debug('Wallet state synced', { chain: this.chain, sol: balance.nativeSol });
    } catch (err) {
      logger.error('Failed to sync wallet state', { error: String(err) });
    }
  }

  // Convert common token symbols to Solana mint addresses
  static tokenToMint(token: string): string {
    const mints: Record<string, string> = {
      SOL: SOL_MINT,
      USDC: USDC_MINT,
      USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYg',
      ETH: '7vfCXTUXx5rXg8dB5A2kB4CgBfKfYK3gKeMq5q6QKQoA',
      BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    };
    return mints[token] ?? token; // Assume already a mint address if not found
  }
}
