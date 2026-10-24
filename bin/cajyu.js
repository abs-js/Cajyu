#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileAndRun } from '../src/compiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    installLib(libName);
  } else if (command === 'run') {
    const file = args[1];
    if (!file) {
      console.error('Usage: cajyu run <file.cjy>');
      process.exit(1);
    }
    await compileAndRun(file);
  } else {
    console.log(`
Cajyu - A custom programming language

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
  console.log('Cajyu project initialized.');
}

function installLib(libName) {
  console.log(`Installing library "${libName}" from CajyuLibs...`);
  console.log('(In a full release this would clone from https://github.com/abs-js/CajyuLibs)');
}

main().catch(console.error);
