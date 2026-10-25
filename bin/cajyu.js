#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { compileAndRun } from '../src/compiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CAJYULIBS_REPO = 'https://github.com/abs-js/CajyuLibs.git';
const VERSION = '1.2.0';

const args = process.argv.slice(2);
const command = args[0];
const flags = args.filter(a => a.startsWith('-'));

function hasFlag(...names) {
  return names.some(n => flags.includes(n) || flags.includes(`-${n}`) || flags.includes(`--${n}`));
}

async function main() {
  if (hasFlag('v', 'version', '--version')) {
    console.log(`Cajyu ${VERSION}`);
    return;
  }

  if (hasFlag('h', 'help', '--help') || !command) {
    showHelp();
    return;
  }

  if (command === 'init') {
    initProject();
  } else if (command === 'inst' || command === 'install') {
    const libName = args[1];
    if (!libName || libName.startsWith('-')) {
      console.error('Usage: cajyu inst <library>');
      process.exit(1);
    }
    await installLib(libName);
  } else if (command === 'run') {
    const file = args.find(a => a.endsWith('.cjy') || (a !== 'run' && !a.startsWith('-')));
    if (!file) {
      console.error('Usage: cajyu run <file.cjy>');
      process.exit(1);
    }
    await compileAndRun(file);
  } else if (command === 'list') {
    listInstalled();
  } else if (command === 'update') {
    console.log('Updating is not yet implemented. Re-run `cajyu inst <lib>` after deleting the folder.');
  } else {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Cajyu ${VERSION} — a custom programming language that transpiles to JavaScript

Usage:
  cajyu [flags]
  cajyu <command> [options]

Commands:
  init              Create a new Cajyu project
  inst <lib>        Install a library from CajyuLibs
  run <file.cjy>    Compile and execute a Cajyu file
  list              List installed libraries
  update            Update installed libraries (coming soon)

Flags:
  -h, --help        Show this help
  -v, --version     Show version

Examples:
  cajyu init
  cajyu inst http
  cajyu inst websocket
  cajyu run examples/fatorial.cjy
  cajyu list
`);
}

function initProject() {
  const pkg = {
    name: "cajyu-project",
    version: "1.0.0",
    description: "Cajyu project",
    main: "index.cjy",
    type: "module"
  };
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  if (!fs.existsSync('CajyuLibs')) fs.mkdirSync('CajyuLibs');
  console.log('Cajyu project initialized.');
}

async function installLib(libName) {
  console.log(`Installing "${libName}" from CajyuLibs...`);

  const targetDir = path.join(process.cwd(), 'CajyuLibs', libName);
  if (fs.existsSync(targetDir)) {
    console.log(`Library "${libName}" already installed.`);
    return;
  }

  const tmpDir = path.join('/tmp', `cajyulibs-${Date.now()}`);
  try {
    console.log('Cloning CajyuLibs repository...');
    execSync(`git clone --depth 1 ${CAJYULIBS_REPO} ${tmpDir}`, { stdio: 'inherit' });

    const sourceLib = path.join(tmpDir, libName);
    if (!fs.existsSync(sourceLib)) {
      console.error(`Library "${libName}" not found in CajyuLibs.`);
      process.exit(1);
    }

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

function listInstalled() {
  const libsDir = path.join(process.cwd(), 'CajyuLibs');
  if (!fs.existsSync(libsDir)) {
    console.log('No libraries installed yet.');
    return;
  }
  const libs = fs.readdirSync(libsDir).filter(d => fs.statSync(path.join(libsDir, d)).isDirectory());
  if (libs.length === 0) {
    console.log('No libraries installed.');
  } else {
    console.log('Installed libraries:');
    libs.forEach(l => console.log(`  - ${l}`));
  }
}

main().catch(console.error);
