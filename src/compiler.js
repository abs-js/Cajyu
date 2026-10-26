import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ERRORS = {
  ERR001: 'Syntax error',            ERR002: 'Unexpected token',
  ERR003: 'Missing closing brace',   ERR004: 'Type mismatch',
  ERR005: 'Undefined variable',      ERR006: 'Invalid function call',
  ERR007: 'Missing parentheses',     ERR008: 'Invalid import',
  ERR009: 'Unexpected end of file',  ERR010: 'Invalid operator',
  ERR011: 'Missing semicolon or block', ERR012: 'Invalid type annotation',
  ERR013: 'Keyword used as identifier', ERR014: 'Unterminated string',
  ERR015: 'Invalid number',          ERR016: 'Duplicate declaration',
  ERR017: 'Missing return value',    ERR018: 'Invalid class member',
  ERR019: 'Async error',             ERR020: 'Library not found',
  ERR021: 'Invalid alias',           ERR022: 'Invalid try/catch',
  ERR023: 'Invalid export',          ERR024: 'Invalid const assignment',
  ERR025: 'Invalid increment',       ERR026: 'Invalid decrement',
};

class CajyuError extends Error {
  constructor(code, line, column, lineContent) {
    const errName = ERRORS[code] || 'Unknown error';
    const pointer = ' '.repeat(Math.max(0, column)) + '^';
    super(`There is an ${errName.toLowerCase()} in line ${line}: ${code}.\n    ${(lineContent || '').trim()}\n   ${pointer}`);
    this.code = code;
  }
}

// ─── Built-in libraries ───────────────────────────────────────────────────────
const BUILTIN_LIBS = new Set(['Bfs', 'Bexec']);

function builtinLibCode(name) {
  switch (name) {
    case 'Bfs': return `
import _fs from 'fs';
const Bfs = {
  read(path)         { return _fs.readFileSync(path, 'utf-8'); },
  write(path, data)  { _fs.writeFileSync(path, String(data), 'utf-8'); },
  append(path, data) { _fs.appendFileSync(path, String(data), 'utf-8'); },
  exists(path)       { return _fs.existsSync(path); },
  remove(path)       { _fs.unlinkSync(path); },
};`;
    case 'Bexec': return `
import { execSync as _execSync } from 'child_process';
const Bexec = {
  run(cmd)  { return _execSync(cmd, { encoding: 'utf-8' }); },
  try(cmd)  { try { return _execSync(cmd, { encoding: 'utf-8' }); } catch(e) { return null; } },
};`;
    default: return '';
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function compileAndRun(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const source = fs.readFileSync(filePath, 'utf-8');
  try {
    const jsCode = transpile(source, path.dirname(filePath));
    const tempFile = path.join('/tmp', `cajyu_${Date.now()}.mjs`);
    fs.writeFileSync(tempFile, jsCode);
    try {
      await import(pathToFileURL(tempFile).href);
      console.log('--- Cajyu execution ---');
    } finally {
      try { fs.unlinkSync(tempFile); } catch {}
    }
  } catch (err) {
    if (err instanceof CajyuError) console.error(err.message);
    else console.error('Runtime error:', err.message);
    process.exit(1);
  }
}

// ─── Transpiler ───────────────────────────────────────────────────────────────
// FIX: arquivos .cjy temporários de libs são limpos ao sair
const _tmpLibFiles = [];
process.on('exit', () => {
  for (const f of _tmpLibFiles) try { fs.unlinkSync(f); } catch {}
});

function transpile(source, baseDir) {
  const lines    = source.split('\n');
  const imports  = [];
  const exports_ = [];
  const codeLines = [];

  // ── Pass 1: separar imports, exports e código ────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // import X as alias from LIB
    const mImp = line.match(
      /^\s*import\s+(\*|\w+)(?:\s+as\s+(\w+))?\s+from\s+['"]?([^;\s'"]+)['"]?\s*;?\s*$/
    );
    if (mImp) {
      imports.push({ what: mImp[1], alias: mImp[2] || null, from: mImp[3], line: i + 1 });
      continue;
    }

    // FIX #1: export X
    const mExp = line.match(/^\s*export\s+(.+?)\s*;?\s*$/);
    if (mExp) {
      exports_.push({ what: mExp[1], line: i + 1 });
      continue;
    }

    codeLines.push(line);
  }

  let code = codeLines.join('\n');
  code = preprocess(code);
  code = handleIncrementDecrement(code);
  // FIX: try/catch com suporte a `as`
  code = transpileTryCatch(code);
  // FIX: funções com suporte a `as` nos parâmetros
  code = transpileFunctions(code);
  code = transpileControlFlow(code);
  // FIX: inferir async em funções anônimas que usam await
  code = inferAsync(code);

  // ── Build import block ───────────────────────────────────────────────────
  let importCode = '';
  let libCounter = 0; // evita colisão de nomes em import *

  for (const imp of imports) {
    const bindName = imp.alias || imp.what;

    // FIX #4: built-ins Bfs e Bexec
    if (BUILTIN_LIBS.has(imp.from)) {
      importCode += builtinLibCode(imp.from) + '\n';
      continue;
    }

    const libPath = resolveLib(imp.from, baseDir);
    if (libPath && fs.existsSync(libPath)) {
      const url = pathToFileURL(libPath).href;
      if (imp.what === '*') {
        const uid = `_lib_star_${libCounter++}`;
        importCode += `const ${uid} = await import('${url}'); Object.assign(globalThis, ${uid}.CajyuLib || ${uid});\n`;
      } else {
        importCode += `const { CajyuLib: _lib_${bindName} } = await import('${url}'); const ${bindName} = _lib_${bindName}?.${imp.what} ?? _lib_${bindName};\n`;
      }
    } else {
      throw new CajyuError('ERR020', imp.line, 0, lines[imp.line - 1] || '');
    }
  }

  // FIX #1: export emitido FORA do async IIFE, no nível do módulo ES
  const exportNames = exports_.map(e => e.what);
  const exportDecls = exportNames.length > 0
    ? exportNames.map(n => `let ${n};`).join('\n') + '\n'
    : '';
  const exportStmt = exportNames.length > 0
    ? `export { ${exportNames.join(', ')} };\n`
    : '';

  // ── Builtins do núcleo (apenas try/catch) ────────────────────────────────
  const builtins = `
class _CajyuTryError {
  constructor(e) { this.message = e.message; this.raw = e; this.code = 'E000'; }
  toString() { return this.code + ': ' + this.message; }
}
function _isTryError(v) { return v instanceof _CajyuTryError; }
`;

  return `
${importCode}
${builtins}
${exportDecls}
(async () => {
${code}
})().catch(e => { console.error(e.message); process.exit(1); });
${exportStmt}`;
}

// ─── Preprocess ───────────────────────────────────────────────────────────────
function preprocess(code) {
  const lines  = code.split('\n');
  const result = [];

  for (const line of lines) {
    let newLine  = '';
    let inString = false;
    let quote    = '';

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      // detecta comentário de linha — copia o resto literalmente
      if (!inString && ch === '/' && line[i + 1] === '/') {
        newLine += line.slice(i);
        break;
      }

      if (!inString && (ch === '"' || ch === "'")) {
        inString = true; quote = ch; newLine += ch; continue;
      }
      if (inString && ch === quote && line[i - 1] !== '\\') {
        inString = false; newLine += ch; continue;
      }
      if (inString) { newLine += ch; continue; }

      if (line.substr(i, 3) === 'and' && isBoundary(line, i, 3)) { newLine += '&&'; i += 2; continue; }
      if (line.substr(i, 2) === 'or'  && isBoundary(line, i, 2)) { newLine += '||'; i += 1; continue; }
      if (line.substr(i, 3) === 'not' && isBoundary(line, i, 3)) { newLine += '!';  i += 2; continue; }
      newLine += ch;
    }

    newLine = newLine
      .replace(/sync\s+fn\s+(\w+)/g, '__CAJYU_ASYNC__ $1')
      .replace(/\bwait\s+/g, 'await ')
      .replace(/\belif\b/g, 'else if')
      .replace(/\bSelf\./g, 'this.')
      .replace(/var\s+(\w+):(\w+)\s*=\s*(.+)/g, 'let $1 = $3 /* :$2 */')
      .replace(/\bvar\s+(\w+)\s*=/g, 'let $1 =')
      .replace(/\bconst\s+(\w+)\s*=/g, 'const $1 =');

    result.push(newLine);
  }
  return result.join('\n');
}

function isBoundary(line, i, len) {
  const before = i === 0 || !/\w/.test(line[i - 1]);
  const after  = i + len >= line.length || !/\w/.test(line[i + len]);
  return before && after;
}

// ─── ++ / -- ─────────────────────────────────────────────────────────────────
function handleIncrementDecrement(code) {
  return code
    .replace(/(\w+)\s*\+\+/g, '$1 = $1 + 1')
    .replace(/(\w+)\s*--/g,   '$1 = $1 - 1');
}

// ─── try/catch ────────────────────────────────────────────────────────────────
// FIX #5: suporte a `catch varName as alias {`
function transpileTryCatch(code) {
  // const x = try expr;
  code = code.replace(
    /const\s+(\w+)\s*=\s*try\s+(.+?)\s*;/g,
    (_, name, expr) =>
      `let ${name}; try { ${name} = (${expr}); } catch(__e_${name}__) { ${name} = new _CajyuTryError(__e_${name}__); }`
  );

  // catch varName as alias {
  code = code.replace(
    /catch\s+(\w+)\s+as\s+(\w+)\s*\{/g,
    (_, varName, alias) => `if (_isTryError(${varName})) { const ${alias} = ${varName};`
  );

  // catch varName {
  code = code.replace(
    /catch\s+(\w+)\s*\{/g,
    (_, varName) => `if (_isTryError(${varName})) {`
  );

  return code;
}

// ─── Funções ──────────────────────────────────────────────────────────────────
// FIX #2: parâmetros com `as` e métodos async dentro de classe
const CLASS_KEYWORDS = new Set([
  'if','else','while','for','return','class','fn','function',
  'constructor','catch','try','switch','do','get','set',
  'async','await','let','const','var','new','throw',
  'typeof','instanceof','delete','void','yield',
]);

function transpileFunctions(code) {
  // marcar async nomeado antes de processar
  code = code.replace(/\b__CAJYU_ASYNC__\s+(\w+)/g, '__CAJYU_ASYNC__$1');

  // fn nome params { } — com suporte a `as`
  code = code.replace(
    /^fn\s+(\w+)\s+([^{]+)\{/gm,
    (_, name, rawParams) => {
      const { jsParams, aliasLines } = parseParams(rawParams);
      return `function ${name}(${jsParams}) {${aliasLines ? '\n  ' + aliasLines : ''}`;
    }
  );

  // fn nome { }
  code = code.replace(/^fn\s+(\w+)\s*\{/gm, 'function $1() {');

  // fn anônimo inline: qualquer `fn params {` que não esteja no início de linha
  code = code.replace(
    /(?<=\S[^\n]*?)fn\s+([^{(][^{]*)\{/g,
    (_, rawParams) => {
      const { jsParams, aliasLines } = parseParams(rawParams);
      return `function(${jsParams}) {${aliasLines ? '\n  ' + aliasLines : ''}`;
    }
  );

  // fn anônimo sem params inline
  code = code.replace(/(?<=\S[^\n]*?)fn\s*\{/g, 'function() {');

  // Constructors
  code = code.replace(/Main\s+([^{]*)\{/g, (_, p) => {
    const { jsParams, aliasLines } = parseParams(p);
    return `constructor(${jsParams}) {${aliasLines ? '\n  ' + aliasLines : ''}`;
  });
  code = code.replace(/\bMain\s*\{/g, 'constructor() {');

  // métodos de classe: `palavra {` — exclui keywords
  code = code.replace(/^\s*(\w+)\s*\{/gm, (m, name) => {
    if (CLASS_KEYWORDS.has(name)) return m;
    return `  ${name}() {`;
  });

  // restaura async em métodos
  code = code.replace(/__CAJYU_ASYNC__(\w+)\s*\(\)\s*\{/g, '  async $1() {');
  code = code.replace(/__CAJYU_ASYNC__(\w+)\s*\{/g,        '  async $1() {');

  return code;
}

// FIX #2: parseParams com suporte a `a as x`
function parseParams(rawParams) {
  const parts = (rawParams || '').trim().split(',').map(s => s.trim()).filter(Boolean);
  const jsParamList = [];
  const aliasList   = [];

  for (const part of parts) {
    const m = part.match(/^(\w+)(?::\w+)?(?:\s+as\s+(\w+))?$/);
    if (m) {
      jsParamList.push(m[1]);
      if (m[2]) aliasList.push(`const ${m[2]} = ${m[1]};`);
    } else {
      jsParamList.push(part.split(':')[0].trim());
    }
  }

  return {
    jsParams:   jsParamList.join(', '),
    aliasLines: aliasList.join(' '),
  };
}

// ─── async inference: function(...) { com await → async function(...) { ────────
// Percorre o código e para cada `function(` verifica se o bloco correspondente
// contém `await` — se sim, adiciona `async` na frente.
function inferAsync(code) {
  // Estratégia: encontra todas as ocorrências de `function(` ou `function nome(`
  // que NÃO sejam precedidas de `async`, e verifica se o bloco tem `await`.
  const result = [];
  let i = 0;

  while (i < code.length) {
    // Procura `function` não precedido de `async `
    const idx = code.indexOf('function', i);
    if (idx === -1) { result.push(code.slice(i)); break; }

    // Verifica se já tem `async` antes
    const before = code.slice(Math.max(0, idx - 6), idx);
    if (before.endsWith('async ')) {
      result.push(code.slice(i, idx + 8));
      i = idx + 8;
      continue;
    }

    // Avança até o `{` de abertura do bloco desta função
    let braceStart = code.indexOf('{', idx);
    if (braceStart === -1) { result.push(code.slice(i)); break; }

    // Encontra o bloco inteiro (balanceia chaves)
    let depth = 0;
    let braceEnd = braceStart;
    for (let j = braceStart; j < code.length; j++) {
      if (code[j] === '{') depth++;
      else if (code[j] === '}') { depth--; if (depth === 0) { braceEnd = j; break; } }
    }

    const body = code.slice(braceStart, braceEnd + 1);

    // Se o corpo contém `await `, esta função precisa de `async`
    if (/await\s/.test(body)) {
      result.push(code.slice(i, idx));
      result.push('async function');
      i = idx + 8; // pula 'function'
    } else {
      result.push(code.slice(i, idx + 8));
      i = idx + 8;
    }
  }

  return result.join('');
}

// ─── Control flow ─────────────────────────────────────────────────────────────
function transpileControlFlow(code) {
  return code
    .replace(/\bif\s+(?!\()([^{]+?)\s*\{/g,       'if ($1) {')
    .replace(/else\s+if\s+(?!\()([^{]+?)\s*\{/g,  'else if ($1) {')
    .replace(/\bwhile\s+(?!\()([^{]+?)\s*\{/g,     'while ($1) {')
    .replace(/for\s+(\w+)\s+in\s+([^ {\n]+)(\s*\{)/g, 'for (let $1 of $2) $3');
}

// ─── resolveLib ───────────────────────────────────────────────────────────────
// FIX #3: suporte a main.cjy como entry point de biblioteca
function resolveLib(from, baseDir) {
  if (from.startsWith('CajyuLibs')) {
    const name = from.split('.')[1] || '';
    const cands = [
      path.resolve(baseDir,         'CajyuLibs', name, 'main.cjy'),
      path.resolve(baseDir,         'CajyuLibs', name, 'main.js'),
      path.resolve(process.cwd(),   'CajyuLibs', name, 'main.cjy'),
      path.resolve(process.cwd(),   'CajyuLibs', name, 'main.js'),
    ];
    const found = cands.find(p => fs.existsSync(p));
    if (found && found.endsWith('.cjy')) {
      return compileCjyLib(found);
    }
    return found;
  }
  // import relativo — também suporta .cjy
  const resolved = path.resolve(baseDir, from);
  if (fs.existsSync(resolved + '.cjy')) {
    return compileCjyLib(resolved + '.cjy');
  }
  return resolved;
}

function compileCjyLib(cjyPath) {
  const src  = fs.readFileSync(cjyPath, 'utf-8');
  const js   = transpile(src, path.dirname(cjyPath));
  const tmp  = path.join('/tmp', `cajyu_lib_${Date.now()}.mjs`);
  fs.writeFileSync(tmp, js);
  _tmpLibFiles.push(tmp);
  return tmp;
}
