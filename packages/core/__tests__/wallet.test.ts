import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletManager } from '../src/wallet.js';

const mockPool = {
  callTool: vi.fn(),
  register: vi.fn(),
  disconnectAll: vi.fn(),
};

const mockDb = {
  upsertWalletState: vi.fn(),
  getWalletState: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WalletManager', () => {
  const wallet = new WalletManager({
    mcpPool: mockPool as any,
    db: mockDb as any,
    walletAddress: 'TestWallet11111111111111111111111111111111',
    chain: 'solana',
  });

  it('exposes address and chain', () => {
    expect(wallet.address).toBe('TestWallet11111111111111111111111111111111');
    expect(wallet.chainName).toBe('solana');
  });

  it('gets balance via phantom MCP', async () => {
    mockPool.callTool
      .mockResolvedValueOnce({ lamports: 2000000000, sol: 2 })
      .mockResolvedValueOnce([{ mint: 'USDC_MINT', amount: '1000000' }]);

    const balance = await wallet.getBalance();
    expect(balance.nativeLamports).toBe(2000000000);
    expect(balance.nativeSol).toBe(2);
    expect(balance.tokens).toHaveLength(1);
  });

  it('checks sufficient balance', async () => {
    mockPool.callTool
      .mockResolvedValueOnce({ lamports: 2000000000, sol: 2 })
      .mockResolvedValueOnce([]);

    const result = await wallet.hasSufficientBalance(1000000000);
    expect(result).toBe(true);
  });

  it('detects insufficient balance', async () => {
    mockPool.callTool
      .mockResolvedValueOnce({ lamports: 5000, sol: 0.000005 })
      .mockResolvedValueOnce([]);

    const result = await wallet.hasSufficientBalance(1000);
    expect(result).toBe(false);
  });

  it('estimates fee', async () => {
    const fee = await wallet.estimateFee();
    expect(fee).toBe(5000);
  });

  it('rejects trade with insufficient balance', async () => {
    mockPool.callTool
      .mockResolvedValueOnce({ lamports: 5000, sol: 0.000005 })
      .mockResolvedValueOnce([]);

    const result = await wallet.executeTrade({
      agent: 'test-agent',
      pair: 'SOL/USDT',
      side: 'buy',
      amountLamports: 1000000,
      tokenMint: 'So11111111111111111111111111111111111111112',
      maxSlippageBps: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient balance');
  });

  it('syncs wallet state to DB', async () => {
    mockPool.callTool
      .mockResolvedValueOnce({ lamports: 1000000000, sol: 1 })
      .mockResolvedValueOnce([]);

    await wallet.syncState();
    expect(mockDb.upsertWalletState).toHaveBeenCalled();
    const call = mockDb.upsertWalletState.mock.calls[0][0];
    expect(call.chain).toBe('solana');
    expect(call.address).toBe('TestWallet11111111111111111111111111111111');
  });

  it('handles balance check failure gracefully', async () => {
    mockPool.callTool.mockRejectedValue(new Error('RPC error'));

    const result = await wallet.hasSufficientBalance(1000);
    expect(result).toBe(false);
  });

  it('converts token symbols to mint addresses', () => {
    expect(WalletManager.tokenToMint('SOL')).toBe('So11111111111111111111111111111111111111112');
    expect(WalletManager.tokenToMint('USDC')).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(WalletManager.tokenToMint('UNKNOWN_MINT')).toBe('UNKNOWN_MINT');
  });
});
