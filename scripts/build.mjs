#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';

const root = resolve(import.meta.dirname, '..');

const packages = [
  'packages/core',
  ...readdirSync(resolve(root, 'packages/mcp-servers')).map(d => `packages/mcp-servers/${d}`),
  ...readdirSync(resolve(root, 'packages/agents')).map(d => `packages/agents/${d}`),
  'packages/dashboard',
  'packages/orchestrator',
];

for (const pkg of packages) {
  const pkgDir = resolve(root, pkg);
  const pkgJson = resolve(pkgDir, 'package.json');
  if (!existsSync(pkgJson)) continue;

  const { scripts } = JSON.parse(
    await import('node:fs').then(fs => fs.readFileSync(pkgJson, 'utf-8'))
  );
  if (!scripts?.build) continue;

  console.log(`Building ${pkg}...`);
  try {
    execSync('npx tsc', { cwd: pkgDir, stdio: 'inherit' });
  } catch {
    console.error(`Failed to build ${pkg}`);
    process.exit(1);
  }
}

console.log('All packages built successfully.');
