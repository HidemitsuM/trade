# 全体アーキテクチャ

## システム概要

Solana/BSCチェーン対応の暗号通貨自動取引システム。8つの自律エージェントが12のMCPサーバー経由で外部APIと通信し、Redis Pub/Subでシグナルを共有しながら取引を実行する。

## レイヤー構成

```
┌─────────────────────────────────────────────────────┐
│  packages/dashboard/  (HTTP:3000)                    │
│  SQLiteを読み取り、P&L・トレード履歴を表示            │
└──────────────────────┬──────────────────────────────┘
                       │ SQLite共有 (ボリュームマウント)
┌──────────────────────┴──────────────────────────────┐
│  packages/orchestrator/                               │
│  AgentManager: 8エージェントの起動・停止・管理         │
│  WalletManager / MCPConnectionPool の初期化           │
└──────────┬───────────┬───────────┬───────────────────┘
           │           │           │
┌──────────┴──┐  ┌─────┴──────┐  ┌┴──────────────────┐
│  SignalBus  │  │  Database  │  │ SimulationEngine   │
│ (Redis)     │  │ (SQLite)   │  │ (テスト用ダミー)   │
└─────────────┘  └────────────┘  └────────────────────┘
           │
┌──────────┴──────────────────────────────────────────┐
│  packages/agents/*  (8エージェント)                   │
│  各エージェント = Strategy(純粋ロジック)              │
│                + Agent(BaseAgent継承・ライフサイクル)  │
└──────────┬───────────────────────────────────────────┘
           │ MCP (stdio プロトコル)
┌──────────┴───────────────────────────────────────────┐
│  packages/mcp-servers/*  (12サーバー)                 │
│  各サーバー = tools.ts(外部APIクライアント)            │
│             + index.ts(MCPサーバー登録)               │
└──────────────────────────────────────────────────────┘
```

## パッケージ構成

| パッケージ | 役割 | 主要技術 |
|-----------|------|---------|
| `@trade/core` | 共通型・DB・SignalBus・BaseAgent・Logger | better-sqlite3, ioredis, zod |
| `@trade/orchestrator` | エージェント管理・システム起動 | - |
| `@trade/dashboard` | HTTPダッシュボード | node:http (フレームワークなし) |
| `@trade/agent-*` (8個) | 取引エージェント | BaseAgent拡張 |
| `@trade/mcp-*` (12個) | 外部APIラッパー | @modelcontextprotocol/sdk |

## 主要パターン

### Agent パターン

全エージェントは2層に分離:
- **`strategy.ts`**: 外部依存なしの純粋関数クラス。ユニットテスト可能。
- **`agent.ts`**: `BaseAgent`を継承し、`tick()`(定期実行)と`onSignal()`(シグナル受信)を実装。

### MCP Server パターン

全MCPサーバーは2層に分離:
- **`tools.ts`**: 外部APIクライアントクラス。fetchをモックしてテスト。
- **`index.ts`**: `McpServer` + `StdioServerTransport` + zodスキーマ検証でツール登録。

## 起動フロー

```
1. orchestrator/src/index.ts 起動
2. Database (SQLite) 初期化
3. SignalBus (Redis) 接続
4. SimulationEngine 生成
5. MCPConnectionPool 生成 (ライブモード時)
   → 6 MCPサーバーを子プロセスで起動
6. WalletManager 生成 (WALLET_ADDRESS設定時)
7. 8エージェントをインスタンス化 → setInfrastructure() で依存注入
8. AgentManager.startAll() → 各エージェントの start()
   → setInterval で tick() ループ開始
   → getSubscribedSignalTypes() のシグナルを Redis で購読
```

## データフロー

```
外部API ─(HTTP)─→ MCP Server ─(stdio)─→ Agent.tick()
                                            │
                                    ┌───────┼───────┐
                                    ▼       ▼       ▼
                              SignalBus   Database  Trade Log
                              (Redis)    (SQLite)   (DB)
                                    │
                              他Agent.onSignal()
```

## 実行モード

| モード | 条件 | 動作 |
|-------|------|------|
| Simulation | `SIMULATION=true` | MCPサーバー不使用。SimulationEngineがダミーデータ生成。 |
| Live | `SIMULATION=false` | MCPサーバー経由でリアルAPI呼び出し。WalletManagerでチェーン操作。 |

## テスト

- フレームワーク: vitest
- 総テスト数: ~82
- テスト対象: Strategy(8) + MCP tools(12) + Core(8) + Orchestrator(1)
- ワークスペースエイリアス: `@trade/core` → `packages/core/src/index.ts`

## 既知の制限

1. **SignalBusが未接続**: 設計上はRedis Pub/Subでエージェント間通信するが、実行時にはまだ配線されていない
2. **Executor不在**: 取引シグナルを発火してもオンチェーン実行するエージェントが存在しない
3. **SQLite単一ファイル**: orchestratorとdashboardが同じファイルを共有（ボリュームマウント）
4. **SOLのみ対応**: リアルデータパスは全てSolana固有（Jupiter/Helius/SOLミントアドレス）
5. **設定値の一部未使用**: `copy_delay_ms`, `max_positions`, `max_open_positions` 等が定義だけでロジックに反映されていない
