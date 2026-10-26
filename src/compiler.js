import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ERRORS = {
  ERR001: 'Syntax error', ERR002: 'Unexpected token', ERR003: 'Missing closing brace',
  ERR004: 'Type mismatch', ERR005: 'Undefined variable', ERR006: 'Invalid function call',
  ERR007: 'Missing parentheses', ERR008: 'Invalid import', ERR009: 'Unexpected end of file',
  ERR010: 'Invalid operator', ERR011: 'Missing semicolon or block', ERR012: 'Invalid type annotation',
  ERR013: 'Keyword used as identifier', ERR014: 'Unterminated string', ERR015: 'Invalid number',
  ERR016: 'Duplicate declaration', ERR017: 'Missing return value', ERR018: 'Invalid class member',
  ERR019: 'Async error', ERR020: 'Library not found', ERR021: 'Invalid alias',
  ERR022: 'Invalid try/catch', ERR023: 'Invalid export', ERR024: 'Invalid const assignment',
  ERR025: 'Invalid increment', ERR026: 'Invalid decrement'
};

class CajyuError extends Error {
  constructor(code, line, column, lineContent) {
    const errName = ERRORS[code] || 'Unknown error';
    const pointer = ' '.repeat(Math.max(0, column)) + '^';
    super(`There is an ${errName.toLowerCase()} in line ${line}: ${code}.\n    ${(lineContent || '').trim()}\n   ${pointer}`);
    this.code = code;
  }
}

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

function transpile(source, baseDir) {
  const lines = source.split('\n');
  const imports = [];
  const codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*import\s+(\*|\w+)(?:\s+as\s+(\w+))?\s+from\s+['"]?([^;\s'"]+)['"]?\s*;?\s*$/);
    if (m) {
      imports.push({ what: m[1], alias: m[2] || null, from: m[3], line: i + 1 });
    } else {
      codeLines.push(line);
    }
  }

  let code = codeLines.join('\n');
  code = preprocess(code);
  code = handleIncrementDecrement(code);
  code = transpileTryCatch(code);
  code = transpileFunctions(code);
  code = transpileControlFlow(code);

  let importCode = '';
  for (const imp of imports) {
    const bindName = imp.alias || imp.what;
    const libPath = resolveLib(imp.from, baseDir);
    if (libPath && fs.existsSync(libPath)) {
      const url = pathToFileURL(libPath).href;
      importCode += `const { CajyuLib: _lib_${bindName} } = await import('${url}'); const ${bindName} = _lib_${bindName}.${imp.what} || _lib_${bindName};\n`;
    } else {
      throw new CajyuError('ERR020', imp.line, 0, lines[imp.line - 1] || '');
    }
  }

  const builtins = `
class _CajyuTryError {
  constructor(e) { this.message = e.message; this.code = 'E000'; }
  toString() { return this.code + ': ' + this.message; }
}
function _isTryError(v) { return v instanceof _CajyuTryError; }
`;

  return `
${importCode}
${builtins}
(async () => {
${code}
})().catch(e => { console.error(e.message); process.exit(1); });
`;
}

function preprocess(code) {
  const lines = code.split('\n');
  const result = [];
  for (const line of lines) {
    let newLine = '';
    let inString = false;
    let quote = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (!inString && (ch === '"' || ch === "'")) {
        inString = true; quote = ch; newLine += ch; continue;
      }
      if (inString && ch === quote && line[i-1] !== '\\') {
        inString = false; newLine += ch; continue;
      }
      if (inString) { newLine += ch; continue; }
      if (line.substr(i, 3) === 'and' && isBoundary(line, i, 3)) { newLine += '&&'; i += 2; continue; }
      if (line.substr(i, 2) === 'or' && isBoundary(line, i, 2)) { newLine += '||'; i += 1; continue; }
      if (line.substr(i, 3) === 'not' && isBoundary(line, i, 3)) { newLine += '!'; i += 2; continue; }
      newLine += ch;
    }
    newLine = newLine
      .replace(/sync\s+fn\s+(\w+)/g, 'async function $1')
      .replace(/\bwait\s+/g, 'await ')
      .replace(/\belif\b/g, 'else if')
      .replace(/\bSelf\./g, 'this.')
      .replace(/var\s+(\w+):(\w+)\s*=\s*(.+)/g, 'let $1 = _typeCheck($3, "$2")')
      .replace(/\bvar\s+(\w+)\s*=/g, 'let $1 =')
      .replace(/\bconst\s+(\w+)\s*=/g, 'const $1 =');
    result.push(newLine);
  }
  return result.join('\n');
}

function isBoundary(line, i, len) {
  const before = i === 0 || !/\w/.test(line[i-1]);
  const after = i + len >= line.length || !/\w/.test(line[i+len]);
  return before && after;
}

function handleIncrementDecrement(code) {
  return code
    .replace(/(\w+)\s*\+\+/g, '$1 = $1 + 1')
    .replace(/(\w+)\s*--/g, '$1 = $1 - 1');
}

function transpileTryCatch(code) {
  code = code.replace(
    /const\s+(\w+)\s*=\s*try\s+(.+?)\s*;/g,
    (_, name, expr) => `let ${name}; try { ${name} = (${expr}); } catch(e) { ${name} = new _CajyuTryError(e); }`
  );
  code = code.replace(/catch\s+(\w+)\s*\{/g, (_, name) => `if (_isTryError(${name})) {`);
  return code;
}

function transpileFunctions(code) {
  return code
    .replace(/^fn\s+(\w+)\s+([^{]*)\{/gm, (_, n, p) => `function ${n}(${cleanParams(p)}) {`)
    .replace(/^fn\s+(\w+)\s*\{/gm, 'function $1() {')
    .replace(/Main\s+([^{]*)\{/g, (_, p) => `constructor(${cleanParams(p)}) {`);
}

function transpileControlFlow(code) {
  return code
    .replace(/if\s+([^{]+?)\s*\{/g, 'if ($1) {')
    .replace(/else\s+if\s+([^{]+?)\s*\{/g, 'else if ($1) {')
    .replace(/while\s+([^{]+?)\s*\{/g, 'while ($1) {')
    .replace(/for\s+(\w+)\s+in\s+([^ {\n]+)(\s*\{)/g, 'for (let $1 of $2) $3');
}

function cleanParams(s) {
  return (s || '').trim().split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean).join(', ');
}

function resolveLib(from, baseDir) {
  if (from.startsWith('CajyuLibs')) {
    const name = from.split('.')[1] || 'serial';
    const cands = [
      path.resolve(baseDir, 'CajyuLibs', name, 'main.js'),
      path.resolve(process.cwd(), 'CajyuLibs', name, 'main.js'),
    ];
    return cands.find(p => fs.existsSync(p));
  }
  return path.resolve(baseDir, from);
}
