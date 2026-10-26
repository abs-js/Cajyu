import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { tokenize, LexerError } from './lexer.js';
import { Parser, ParseError } from './parser.js';
import { emit, generate, CodegenError } from './codegen.js';

// ─── Error codes ─────────────────────────────────────────────────────────────
const ERRORS = {
  ERR001: 'Syntax error',            ERR002: 'Unexpected token',
  ERR003: 'Missing closing brace',   ERR004: 'Type mismatch',
  ERR005: 'Undefined variable',      ERR006: 'Invalid function call',
  ERR007: 'Missing parentheses',     ERR008: 'Invalid import',
  ERR009: 'Unexpected end of file',  ERR010: 'Invalid operator',
  ERR011: 'Missing semicolon',       ERR012: 'Invalid type annotation',
  ERR013: 'Keyword as identifier',   ERR014: 'Unterminated string',
  ERR015: 'Invalid number',          ERR016: 'Duplicate declaration',
  ERR017: 'Missing return value',    ERR018: 'Invalid class member',
  ERR019: 'Async error',             ERR020: 'Library not found',
  ERR021: 'Invalid alias',           ERR022: 'Invalid try/catch',
  ERR023: 'Invalid export',          ERR024: 'Invalid const assignment',
  ERR025: 'Invalid increment',       ERR026: 'Invalid decrement',
  ERR027: 'Library entry error',     ERR028: 'Invalid module export',
  ERR029: 'Invalid as target',       ERR030: 'Unexpected keyword',
};

// ─── Built-in libraries ───────────────────────────────────────────────────────
const BUILTIN_LIBS = new Set(['Bfs', 'Bexec']);

function builtinLibCode(name) {
  switch (name) {
    case 'Bfs': return `
import _fs from 'fs';
const Bfs = {
  read(p)         { return _fs.readFileSync(p, 'utf-8'); },
  write(p, data)  { _fs.writeFileSync(p, String(data), 'utf-8'); },
  append(p, data) { _fs.appendFileSync(p, String(data), 'utf-8'); },
  exists(p)       { return _fs.existsSync(p); },
  remove(p)       { _fs.unlinkSync(p); },
};`;
    case 'Bexec': return `
import { execSync as _execSync } from 'child_process';
const Bexec = {
  run(cmd) { return _execSync(cmd, { encoding: 'utf-8' }); },
  try(cmd) { try { return _execSync(cmd, { encoding: 'utf-8' }); } catch(e) { return null; } },
};`;
    default: return '';
  }
}

// ─── Builtins do núcleo ───────────────────────────────────────────────────────
const CORE_BUILTINS = `
// ── Cajyu core builtins ──────────────────────────────────────────────────────
function _typeCheck(val, type) {
  const t = String(type).toLowerCase();
  if (t === 'string'  && typeof val !== 'string')  throw new Error('ERR004: expected String, got ' + typeof val);
  if ((t === 'number' || t === 'int' || t === 'float') && typeof val !== 'number') throw new Error('ERR004: expected Number');
  if (t === 'boolean' && typeof val !== 'boolean') throw new Error('ERR004: expected Boolean');
  if (t === 'array'   && !Array.isArray(val))      throw new Error('ERR004: expected Array');
  if (t === 'object'  && (typeof val !== 'object' || val === null)) throw new Error('ERR004: expected Object');
  return val;
}
class _CajyuTryError {
  constructor(e) { this.message = e?.message ?? String(e); this.raw = e; this.code = 'E000'; }
  toString() { return 'TryError: ' + this.message; }
}
function _isTryError(v) { return v instanceof _CajyuTryError; }
function _destroy(obj) {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === 'object') return Object.values(obj);
  return [obj];
}
`;

// ─── Temp file cleanup ───────────────────────────────────────────────────────
const _tmpFiles = [];
process.on('exit', () => { for (const f of _tmpFiles) try { fs.unlinkSync(f); } catch {} });

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function compileAndRun(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`); process.exit(1);
  }
  const source = fs.readFileSync(filePath, 'utf-8');
  try {
    const js = transpile(source, path.dirname(filePath), filePath);
    const tmp = path.join('/tmp', `cajyu_${Date.now()}.mjs`);
    fs.writeFileSync(tmp, js);
    _tmpFiles.push(tmp);
    try { await import(pathToFileURL(tmp).href); }
    finally { try { fs.unlinkSync(tmp); } catch {} }
  } catch (err) {
    // ── Better error catching (task #3) ────────────────────────────────────
    if (err instanceof LexerError || err instanceof ParseError || err instanceof CodegenError) {
      console.error('\n╔═ Cajyu Error ══════════════════════════════════════╗');
      console.error('║ ' + err.message.split('\n').join('\n║ '));
      console.error('╚════════════════════════════════════════════════════╝\n');
    } else {
      console.error('\n╔═ Runtime Error ═════════════════════════════════════╗');
      console.error('║ ' + (err.message || String(err)));
      if (err.stack) {
        const relevantStack = err.stack.split('\n').slice(1, 4).join('\n║ ');
        console.error('║ ' + relevantStack);
      }
      console.error('╚════════════════════════════════════════════════════╝\n');
    }
    process.exit(1);
  }
}

// ─── Transpiler ───────────────────────────────────────────────────────────────
export function transpile(source, baseDir, filePath = '<unknown>') {
  // ── 1. Lex ────────────────────────────────────────────────────────────────
  const tokens = tokenize(source);

  // ── 2. Parse ──────────────────────────────────────────────────────────────
  const parser = new Parser(tokens);
  const ast    = parser.parse();

  // ── 3. Separate imports/exports from body ─────────────────────────────────
  const { imports, exports: exports_, stmts } = generate(ast);

  // ── 4. Build import block ─────────────────────────────────────────────────
  let importCode = '';
  let libCounter = 0;

  for (const imp of imports) {
    const bindName = imp.alias || imp.what;

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
      // Better error catching: mostra qual lib não foi encontrada
      throw new Error(`ERR020: Library not found: "${imp.from}"\n  Tip: run \`cajyu inst ${imp.from.replace('CajyuLibs.','')}\` to install it.`);
    }
  }

  // ── 5. Build export block ─────────────────────────────────────────────────
  const exportNames = exports_.map(e => e.name);
  const exportDecls = exportNames.map(n => `let ${n};`).join('\n');
  const exportStmt  = exportNames.length > 0
    ? `export { ${exportNames.join(', ')} };`
    : '';

  // ── 6. Emit body ──────────────────────────────────────────────────────────
  const bodyLines = stmts
    .map(s => emitWithTryVarDecl(s))
    .filter(Boolean)
    .join('\n');

  return `
${importCode}
${CORE_BUILTINS}
${exportDecls}
(async () => {
${bodyLines}
})().catch(e => {
  console.error('\\n╔═ Runtime Error ════════════════════════════════════╗');
  console.error('║ ' + (e?.message ?? e));
  console.error('╚════════════════════════════════════════════════════╝\\n');
  process.exit(1);
});
${exportStmt}
`;
}

// ─── Emit com tratamento especial de VarDecl + TryExpr ───────────────────────
// `const x = try expr` é reconhecido pelo parser como VarDecl cujo value é TryExpr
function emitWithTryVarDecl(node) {
  if (node.type === 'VarDecl' && node.value && node.value.type === 'TryExpr') {
    const expr = emit(node.value.expr);
    return `let ${node.name}; try { ${node.name} = (${expr}); } catch (__e_${node.name}__) { ${node.name} = new _CajyuTryError(__e_${node.name}__); }`;
  }
  return emit(node);
}

// ─── resolveLib ───────────────────────────────────────────────────────────────
function resolveLib(from, baseDir) {
  if (from.startsWith('CajyuLibs')) {
    const name = from.split('.')[1] || '';
    const cands = [
      path.resolve(baseDir,       'CajyuLibs', name, 'main.cjy'),
      path.resolve(baseDir,       'CajyuLibs', name, 'main.js'),
      path.resolve(process.cwd(), 'CajyuLibs', name, 'main.cjy'),
      path.resolve(process.cwd(), 'CajyuLibs', name, 'main.js'),
    ];
    const found = cands.find(p => fs.existsSync(p));
    if (found?.endsWith('.cjy')) return compileCjyLib(found);
    return found;
  }
  const resolved = path.resolve(baseDir, from);
  if (fs.existsSync(resolved + '.cjy')) return compileCjyLib(resolved + '.cjy');
  return resolved;
}

function compileCjyLib(cjyPath) {
  const src = fs.readFileSync(cjyPath, 'utf-8');
  const js  = transpile(src, path.dirname(cjyPath), cjyPath);
  const tmp = path.join('/tmp', `cajyu_lib_${Date.now()}.mjs`);
  fs.writeFileSync(tmp, js);
  _tmpFiles.push(tmp);
  return tmp;
}
