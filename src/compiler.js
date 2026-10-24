import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export async function compileAndRun(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }
  const source = fs.readFileSync(filePath, 'utf-8');
  const jsCode = transpile(source, path.dirname(filePath));
  const tempFile = path.join('/tmp', `cajyu_${Date.now()}.mjs`);
  fs.writeFileSync(tempFile, jsCode);
  try {
    await import(pathToFileURL(tempFile).href);
    console.log('--- Execução Cajyu ---');
  } catch (err) {
    console.error('Erro na execução:', err.message);
    console.error(err.stack);
  } finally {
    try { fs.unlinkSync(tempFile); } catch {}
  }
}

function transpile(source, baseDir) {
  const lines = source.split('\n');
  const imports = [];
  const codeLines = [];
  for (const line of lines) {
    const m = line.match(/^\s*import\s+(\*|\w+)\s+from\s+['"]?([^\s'"]+)['"]?\s*;?\s*$/);
    if (m) imports.push({ what: m[1], from: m[2] });
    else codeLines.push(line);
  }
  let code = codeLines.join('\n');

  let importCode = '';
  for (const imp of imports) {
    const libPath = resolveLib(imp.from, baseDir);
    if (libPath && fs.existsSync(libPath)) {
      const url = pathToFileURL(libPath).href;
      if (imp.what === '*') {
        importCode += `const _lib = await import('${url}'); Object.assign(globalThis, _lib.CayjuLib || _lib);\n`;
      } else {
        importCode += `const { CayjuLib: _lib${imp.what} } = await import('${url}'); const ${imp.what} = _lib${imp.what}.${imp.what} || _lib${imp.what};\n`;
      }
    }
  }

  code = preprocessKeywords(code);
  code = transpileFunctions(code);
  code = transpileAnonymousFunctions(code);
  code = transpileControlFlow(code);
  code = transpileOneLiners(code);

  const builtins = `
function _range(a, b, c) {
  const r = [];
  if (b == null) for (let i = 1; i <= a; i++) r.push(i);
  else if (c == null) for (let i = a; i <= b; i++) r.push(i);
  else for (let i = a; i <= b; i += c) r.push(i);
  return r;
}
function _typeCheck(val, type) {
  if (!type) return val;
  const t = String(type).toLowerCase();
  if (t === 'string' && typeof val !== 'string') throw new Error('esperado String');
  if ((t === 'number' || t === 'int' || t === 'float') && typeof val !== 'number') throw new Error('esperado Number');
  if (t === 'boolean' && typeof val !== 'boolean') throw new Error('esperado Boolean');
  if (t === 'array' && !Array.isArray(val)) throw new Error('esperado Array');
  return val;
}
`;

  const final = `
${importCode}
${builtins}
(async () => {
${code}
})().catch(console.error);
`;

  fs.writeFileSync('/tmp/cajyu_debug.mjs', final);
  return final;
}

function resolveLib(from, baseDir) {
  if (from.startsWith('CajyuLibs')) {
    const name = from.split('.')[1] || 'serial';
    const cands = [
      path.resolve(baseDir, 'CajyuLibs', name, 'main.js'),
      path.resolve(baseDir, '..', 'CajyuLibs', name, 'main.js'),
      path.resolve(process.cwd(), 'CajyuLibs', name, 'main.js'),
    ];
    return cands.find(p => fs.existsSync(p));
  }
  return path.resolve(baseDir, from);
}

function cleanParams(s) {
  return (s || '').trim().split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean).join(', ');
}

function preprocessKeywords(code) {
  return code
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b/g, '!')
    .replace(/sync\s+fn\s+(\w+)/g, 'async function $1')
    .replace(/\bwait\s+/g, 'await ')
    .replace(/\belif\b/g, 'else if')
    .replace(/\bSelf\./g, 'this.')
    .replace(/\brange\(/g, '_range(')
    .replace(/\/\/\s*private\s+(\w+)/g, '/* private $1 */')
    .replace(/var\s+(\w+):(\w+)\s*=\s*(.+)/g, 'let $1 = _typeCheck($3, "$2")')
    .replace(/var\s+(\w+)\s*=/g, 'let $1 =');
}

function transpileFunctions(code) {
  return code
    .replace(/^fn\s+(\w+)\s+([^{]*)\{/gm, (_, n, p) => `function ${n}(${cleanParams(p)}) {`)
    .replace(/^fn\s+(\w+)\s*\{/gm, 'function $1() {')
    .replace(/Main\s+([^{]*)\{/g, (_, p) => `constructor(${cleanParams(p)}) {`)
    .replace(/^\s*(\w+)\s*\{/gm, (m, name) => {
      const keywords = ['if','else','while','for','return','class','fn','function','constructor'];
      if (keywords.includes(name)) return m;
      return `  ${name}() {`;
    });
}

function transpileAnonymousFunctions(code) {
  return code.replace(/(?<!^|\n)fn\s+([^{]*)\{/g, (_, params) => {
    const p = cleanParams(params);
    return `function(${p}) {`;
  });
}

function transpileControlFlow(code) {
  return code
    .replace(/if\s+([^{]+?)\s*\{/g, 'if ($1) {')
    .replace(/else\s+if\s+([^{]+?)\s*\{/g, 'else if ($1) {')
    .replace(/while\s+([^{]+?)\s*\{/g, 'while ($1) {')
    .replace(/for\s+(\w+)\s+in\s+([^ {\n]+)(\s*\{)/g, 'for (let $1 of $2) $3');
}

function transpileOneLiners(code) {
  return code
    .replace(/return\s+(\{[^}]*\}|.+?)\s+if\s+([^;]+);/g, 'if ($2) return $1;')
    .replace(/if\s+([^:{;\n]+)\s+return\s+([^;\n{]+)/g, 'if ($1) return $2;');
}
