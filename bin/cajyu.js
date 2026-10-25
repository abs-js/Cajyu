#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { compileAndRun } from '../src/compiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const CAJYULIBS_REPO = 'https://github.com/abs-js/CajyuLibs.git';
const VERSION = '1.2.5';

const args    = process.argv.slice(2);
const command = args[0];
const flags   = args.filter(a => a.startsWith('-'));

function hasFlag(...names) {
  return names.some(n => flags.includes(n) || flags.includes(`-${n}`) || flags.includes(`--${n}`));
}

async function main() {
  if (hasFlag('v', 'version', '--version')) { console.log(`Cajyu ${VERSION}`); return; }
  if (hasFlag('h', 'help', '--help') || !command) { showHelp(); return; }

  switch (command) {
    case 'init':    await initProject(); break;
    case 'inst':
    case 'install': await installLib(args[1]); break;
    case 'remove':  removeLib(args[1]); break;
    case 'run':     await runFile(); break;
    case 'exec':    await execInline(args.slice(1).join(' ')); break;
    case 'start':   await startProject(); break;
    case 'list':    listInstalled(); break;
    case 'update':  await updateLib(args[1]); break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

function showHelp() {
  console.log(`
Cajyu ${VERSION} — a programming language that transpiles to JavaScript

Usage:
  cajyu [flags]
  cajyu <command> [options]

Commands:
  init              Create a new Cajyu project
  inst <lib>        Install a library from CajyuLibs
  remove <lib>      Remove an installed library
  run <file.cjy>    Compile and execute a Cajyu file
  exec "<code>"     Run a one-liner Cajyu expression
  start             Run the mainScript from cajyu.json
  list              List installed libraries
  update [lib]      Update one or all libraries

Flags:
  -h, --help        Show this help
  -v, --version     Show version

Built-in libraries (no install needed):
  http, fs, Json, exec

Examples:
  cajyu init
  cajyu inst http
  cajyu run examples/fatorial.cjy
  cajyu start
  cajyu exec "print(1 + 1)"
  cajyu list
`);
}

// ── init ─────────────────────────────────────────────────────────────────────
async function initProject() {
  const pkg = {
    name: 'cajyu-project',
    version: '1.0.0',
    description: 'A Cajyu project',
    mainScript: 'index.cjy',
    links: {},
    dependences: {},
    scripts: { start: 'cajyu run index.cjy' },
    type: 'module',
  };
  if (!fs.existsSync('cajyu.json')) {
    fs.writeFileSync('cajyu.json', JSON.stringify(pkg, null, 2));
    console.log('Created cajyu.json');
  } else {
    console.log('cajyu.json already exists — skipped.');
  }
  if (!fs.existsSync('CajyuLibs')) fs.mkdirSync('CajyuLibs');
  if (!fs.existsSync('index.cjy')) {
    fs.writeFileSync('index.cjy', 'import print from CajyuLibs.serial;\nprint("Hello from Cajyu!")\n');
    console.log('Created index.cjy');
  }
  await installLib('serial');
  console.log('Cajyu project initialized.');
}

// ── start ─────────────────────────────────────────────────────────────────────
async function startProject() {
  const cfgPath = path.resolve(process.cwd(), 'cajyu.json');
  if (!fs.existsSync(cfgPath)) {
    console.error('No cajyu.json found. Run `cajyu init` first.');
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  const entry = cfg.mainScript || 'index.cjy';
  if (!fs.existsSync(entry)) {
    console.error(`mainScript "${entry}" not found.`);
    process.exit(1);
  }
  await compileAndRun(entry);
}

// ── exec (one-liner) ───────────────────────────────────────────────────────
async function execInline(snippet) {
  if (!snippet) { console.error('Usage: cajyu exec "<code>"'); process.exit(1); }
  const tmpFile = path.join('/tmp', `cajyu_exec_${Date.now()}.cjy`);
  fs.writeFileSync(tmpFile, snippet + '\n');
  try { await compileAndRun(tmpFile); }
  finally { try { fs.unlinkSync(tmpFile); } catch {} }
}

// ── run ────────────────────────────────────────────────────────────────────
const KNOWN_COMMANDS = new Set(['init','inst','install','remove','run','exec','start','list','update']);
async function runFile() {
  const file = args.find(a => a !== 'run' && !a.startsWith('-') && (a.endsWith('.cjy') || !KNOWN_COMMANDS.has(a)));
  if (!file) { console.error('Usage: cajyu run <file.cjy>'); process.exit(1); }
  await compileAndRun(file);
}

// ── inst ───────────────────────────────────────────────────────────────────
async function installLib(libName) {
  if (!libName || libName.startsWith('-')) { console.error('Usage: cajyu inst <library>'); process.exit(1); }
  console.log(`Installing "${libName}" from CajyuLibs...`);
  const targetDir = path.join(process.cwd(), 'CajyuLibs', libName);
  if (fs.existsSync(targetDir)) { console.log(`Library "${libName}" already installed.`); return; }

  const tmpDir = path.join('/tmp', `cajyulibs-${Date.now()}`);
  try {
    execSync(`git clone --depth 1 ${CAJYULIBS_REPO} ${tmpDir}`, { stdio: 'inherit' });
    const sourceLib = path.join(tmpDir, libName);
    if (!fs.existsSync(sourceLib)) { console.error(`Library "${libName}" not found in CajyuLibs.`); process.exit(1); }
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.cpSync(sourceLib, targetDir, { recursive: true });

    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
        console.log('Installing library dependencies...');
        execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
      }
    }
    console.log(`✓ Library "${libName}" installed to CajyuLibs/${libName}/`);
  } catch (err) {
    console.error('Failed to install library:', err.message);
    process.exit(1);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ── remove ─────────────────────────────────────────────────────────────────
function removeLib(libName) {
  if (!libName) { console.error('Usage: cajyu remove <library>'); process.exit(1); }
  const targetDir = path.join(process.cwd(), 'CajyuLibs', libName);
  if (!fs.existsSync(targetDir)) { console.error(`Library "${libName}" is not installed.`); process.exit(1); }
  fs.rmSync(targetDir, { recursive: true, force: true });
  console.log(`✓ Library "${libName}" removed.`);
}

// ── update ─────────────────────────────────────────────────────────────────
async function updateLib(libName) {
  if (libName) {
    const targetDir = path.join(process.cwd(), 'CajyuLibs', libName);
    if (!fs.existsSync(targetDir)) { console.error(`Library "${libName}" not installed.`); process.exit(1); }
    fs.rmSync(targetDir, { recursive: true, force: true });
    await installLib(libName);
  } else {
    const libsDir = path.join(process.cwd(), 'CajyuLibs');
    if (!fs.existsSync(libsDir)) { console.log('No libraries installed.'); return; }
    const libs = fs.readdirSync(libsDir).filter(d => fs.statSync(path.join(libsDir, d)).isDirectory());
    for (const lib of libs) await updateLib(lib);
  }
}

// ── list ───────────────────────────────────────────────────────────────────
function listInstalled() {
  const libsDir = path.join(process.cwd(), 'CajyuLibs');
  console.log('Built-in (always available): http, fs, Json, exec');
  if (!fs.existsSync(libsDir)) { console.log('No external libraries installed.'); return; }
  const libs = fs.readdirSync(libsDir).filter(d => fs.statSync(path.join(libsDir, d)).isDirectory());
  if (libs.length === 0) { console.log('No external libraries installed.'); return; }
  console.log('Installed:');
  for (const l of libs) {
    const hasCjy = fs.existsSync(path.join(libsDir, l, 'main.cjy'));
    console.log(`  - ${l}${hasCjy ? ' (.cjy entry)' : ''}`);
  }
}

main().catch(console.error);
