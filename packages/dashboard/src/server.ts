import { createServer } from 'node:http';
import { Database } from '@trade/core';

const PORT = Number(process.env.DASHBOARD_PORT) || 3000;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trade Orchestrator Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace; background: #0a0a0a; color: #e0e0e0; padding: 20px; }
    h1 { color: #00ff88; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .card { background: #111; border: 1px solid #222; border-radius: 8px; padding: 16px; }
    .card h2 { font-size: 14px; color: #888; margin-bottom: 8px; }
    .card .value { font-size: 24px; font-weight: bold; }
    .positive { color: #00ff88; }
    .negative { color: #ff4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #222; font-size: 13px; }
    th { color: #888; }
    .agent-running { color: #00ff88; }
    .agent-idle { color: #888; }
    .agent-stopped { color: #ff4444; }
    .agent-error { color: #ff0; }
    .auto-refresh { color: #555; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>Trade Orchestrator</h1>
  <div class="grid">
    <div class="card"><h2>Total P&L</h2><div class="value" id="total-pnl">--</div></div>
    <div class="card"><h2>Win Rate</h2><div class="value" id="win-rate">--</div></div>
    <div class="card"><h2>Total Trades</h2><div class="value" id="total-trades">--</div></div>
    <div class="card"><h2>Active Agents</h2><div class="value" id="active-agents">--</div></div>
  </div>
  <h2 style="margin-bottom:10px">Recent Trades</h2>
  <table>
    <thead><tr><th>Time</th><th>Agent</th><th>Pair</th><th>Side</th><th>P&L</th><th>Sim</th></tr></thead>
    <tbody id="trades-body"></tbody>
  </table>
  <p class="auto-refresh">Auto-refresh every 5s</p>
  <script>
    async function refresh() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const pnl = data.total_pnl;
        document.getElementById('total-pnl').textContent = '$' + pnl.toFixed(2);
        document.getElementById('total-pnl').className = 'value ' + (pnl >= 0 ? 'positive' : 'negative');
        document.getElementById('win-rate').textContent = data.win_rate.toFixed(1) + '%';
        document.getElementById('total-trades').textContent = data.total_trades;
        document.getElementById('active-agents').textContent = data.active_agents + '/' + data.total_agents;
        const tbody = document.getElementById('trades-body');
        tbody.innerHTML = data.trades.map(t =>
          \`<tr><td>\${t.timestamp}</td><td>\${t.agent}</td><td>\${t.pair}</td><td>\${t.side}</td><td class="\${t.pnl >= 0 ? 'positive' : 'negative'}">$\${t.pnl?.toFixed(2) || '--'}</td><td>\${t.simulated ? 'Yes' : 'No'}</td></tr>\`
        ).join('');
      } catch (e) { console.error('Failed to refresh', e); }
    }
    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`;

export function startDashboard(db: Database | null): void {
  const server = createServer((req, res) => {
    const url = req.url ?? '/';

    if (url.startsWith('/api/')) {
      if (!db) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not initialized' }));
        return;
      }

      try {
        const trades = db.getTradesByAgent('arb-scanner')
          .concat(db.getTradesByAgent('pump-sniper'))
          .concat(db.getTradesByAgent('spread-farmer'))
          .concat(db.getTradesByAgent('copy-trader'))
          .concat(db.getTradesByAgent('liquidity-hunter'))
          .concat(db.getTradesByAgent('news-edge'))
          .concat(db.getTradesByAgent('whale-tracker'))
          .concat(db.getTradesByAgent('portfolio-guard'))
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .slice(0, 50);

        const wonTrades = trades.filter(t => t.pnl !== null && t.pnl > 0);
        const closedTrades = trades.filter(t => t.pnl !== null);
        const totalPnl = closedTrades.reduce((s, t) => s + t.pnl!, 0);

        res.writeHead(200, { 'Content-Type': 'application/json' });

        if (url === '/api/status') {
          res.end(JSON.stringify({
            total_pnl: totalPnl,
            win_rate: closedTrades.length > 0 ? (wonTrades.length / closedTrades.length) * 100 : 0,
            total_trades: trades.length,
            active_agents: 8,
            total_agents: 8,
            trades: trades,
          }));
        } else if (url === '/api/pnl') {
          res.end(JSON.stringify({
            total_pnl: totalPnl,
            win_rate: closedTrades.length > 0 ? (wonTrades.length / closedTrades.length) * 100 : 0,
            total_trades: trades.length,
            winning_trades: wonTrades.length,
            losing_trades: closedTrades.length - wonTrades.length,
          }));
        } else if (url === '/api/agents') {
          const agentNames = ['arb-scanner', 'pump-sniper', 'spread-farmer', 'copy-trader', 'liquidity-hunter', 'news-edge', 'whale-tracker', 'portfolio-guard'];
          const agents = agentNames.map(name => ({
            name,
            status: 'running',
            trade_count: db.getTradesByAgent(name).length,
            pnl: db.getAgentPnl(name),
          }));
          res.end(JSON.stringify({ agents, total_agents: agents.length, active_agents: agents.length }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (err) {
        console.error('DB query failed:', err);
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database query failed' }));
      }
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(HTML);
    }
  });

  server.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
  });
}
