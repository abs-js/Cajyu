import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// Error codes
const ERRORS = {
  ERR001: 'Syntax error',
  ERR002: 'Unexpected token',
  ERR003: 'Missing closing brace',
  ERR004: 'Type mismatch',
  ERR005: 'Undefined variable',
  ERR006: 'Invalid function call',
  ERR007: 'Missing parentheses',
  ERR008: 'Invalid import',
  ERR009: 'Unexpected end of file',
  ERR010: 'Invalid operator',
  ERR011: 'Missing semicolon or block',
  ERR012: 'Invalid type annotation',
  ERR013: 'Keyword used as identifier',
  ERR014: 'Unterminated string',
  ERR015: 'Invalid number',
  ERR016: 'Duplicate declaration',
  ERR017: 'Missing return value',
  ERR018: 'Invalid class member',
  ERR019: 'Async error',
  ERR020: 'Library not found'
};

class CajyuError extends Error {
  constructor(code, line, column, lineContent, message) {
    const errName = ERRORS[code] || 'Unknown error';
    const pointer = ' '.repeat(Math.max(0, column)) + '^';
    super(`There is an ${errName.toLowerCase()} in line ${line}: ${code}.\n    ${lineContent.trim()}\n   ${pointer}`);
    this.code = code;
    this.line = line;
    this.column = column;
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
    if (err instanceof CajyuError) {
      console.error(err.message);
    } else {
      console.error('Runtime error:', err.message);
    }
    process.exit(1);
  }
}

function transpile(source, baseDir) {
  const lines = source.split('\n');
  const imports = [];
  const codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*import\s+(\*|\w+)\s+from\s+['"]?([^\s'"]+)['"]?\s*;?\s*$/);
    if (m) {
      imports.push({ what: m[1], from: m[2], line: i + 1 });
    } else {
      codeLines.push(line);
    }
  }

  let code = codeLines.join('\n');

  code = preprocessWithErrors(code, lines);

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
    } else {
      throw new CajyuError('ERR020', imp.line, 0, lines[imp.line - 1] || '', `Library not found: ${imp.from}`);
    }
  }

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
  if (t === 'string' && typeof val !== 'string') throw new Error('ERR004: expected String');
  if ((t === 'number' || t === 'int' || t === 'float') && typeof val !== 'number') throw new Error('ERR004: expected Number');
  if (t === 'boolean' && typeof val !== 'boolean') throw new Error('ERR004: expected Boolean');
  if (t === 'array' && !Array.isArray(val)) throw new Error('ERR004: expected Array');
  if (t === 'object' && (typeof val !== 'object' || val === null)) throw new Error('ERR004: expected Object');
  return val;
}
`;

  return `
${importCode}
${builtins}
(async () => {
${code}
})().catch(e => { console.error(e.message); process.exit(1); });
`;
}

function preprocessWithErrors(code, originalLines) {
  const result = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let newLine = '';
    let inString = false;
    let stringChar = '';

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];

      if (!inString && (ch === '"' || ch === "'")) {
        inString = true;
        stringChar = ch;
        newLine += ch;
        continue;
      }
      if (inString && ch === stringChar && line[j - 1] !== '\\') {
        inString = false;
        newLine += ch;
        continue;
      }
      if (inString) {
        newLine += ch;
        continue;
      }

      if (line.substr(j, 3) === 'and' && isWordBoundary(line, j, 3)) {
        newLine += '&&';
        j += 2;
        continue;
      }
      if (line.substr(j, 2) === 'or' && isWordBoundary(line, j, 2)) {
        newLine += '||';
        j += 1;
        continue;
      }
      if (line.substr(j, 3) === 'not' && isWordBoundary(line, j, 3)) {
        newLine += '!';
        j += 2;
        continue;
      }

      newLine += ch;
    }

    if (inString) {
      throw new CajyuError('ERR014', i + 1, line.length, line, 'Unterminated string');
    }

    newLine = newLine
      .replace(/sync\s+fn\s+(\w+)/g, 'async function $1')
      .replace(/\bwait\s+/g, 'await ')
      .replace(/\belif\b/g, 'else if')
      .replace(/\bSelf\./g, 'this.')
      .replace(/\brange\(/g, '_range(')
      .replace(/var\s+(\w+):(\w+)\s*=\s*(.+)/g, 'let $1 = _typeCheck($3, "$2")')
      .replace(/var\s+(\w+)\s*=/g, 'let $1 =');

    result.push(newLine);
  }

  return result.join('\n');
}

function isWordBoundary(line, index, len) {
  const before = index === 0 || !/\w/.test(line[index - 1]);
  const after = index + len >= line.length || !/\w/.test(line[index + len]);
  return before && after;
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
    .replace(/if\s+([^:{;\n]+)\s+return\s+([^;\n{]+)/g, 'if ($1) return $2;')
    .replace(/while\s+([^:{;\n]+)\s+([^;\n{]+);?/g, 'while ($1) { $2; }')
    .replace(/for\s+(\w+)\s+in\s+([^ {\n;]+)\s+([^;\n{]+);?/g, 'for (let $1 of $2) { $3; }');
}
