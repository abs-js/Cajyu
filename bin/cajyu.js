#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { compileAndRun } from '../src/compiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CAJYULIBS_REPO = 'https://github.com/abs-js/CajyuLibs.git';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (command === 'init') {
    initProject();
  } else if (command === 'inst' || command === 'install') {
    const libName = args[1];
    if (!libName) {
      console.error('Usage: cajyu inst <library>');
      process.exit(1);
    }
    await installLib(libName);
  } else if (command === 'run') {
    const file = args[1];
    if (!file) {
      console.error('Usage: cajyu run <file.cjy>');
      process.exit(1);
    }
    await compileAndRun(file);
  } else {
    console.log(`
Cajyu — a custom programming language

Usage:
  cajyu init          Create a new project
  cajyu inst <lib>    Install a library from CajyuLibs
  cajyu run file.cjy  Compile and run a .cjy file
    `);
  }
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
    console.log(`Library "${libName}" already installed. Skipping.`);
    return;
  }

  const tmpDir = path.join('/tmp', `cajyulibs-${Date.now()}`);
  try {
    console.log('Cloning CajyuLibs repository...');
    execSync(`git clone --depth 1 ${CAJYULIBS_REPO} ${tmpDir}`, { stdio: 'inherit' });

    const sourceLib = path.join(tmpDir, libName);
    if (!fs.existsSync(sourceLib)) {
      console.error(`Library "${libName}" not found in CajyuLibs repository.`);
      process.exit(1);
    }

    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.cpSync(sourceLib, targetDir, { recursive: true });
    console.log(`Library "${libName}" installed to CajyuLibs/${libName}/`);
  } catch (err) {
    console.error('Failed to install library:', err.message);
    process.exit(1);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch(console.error);
