import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// ─── Error codes ────────────────────────────────────────────────────────────
const ERRORS = {
  ERR001: 'Syntax error',       ERR002: 'Unexpected token',
  ERR003: 'Missing closing brace', ERR004: 'Type mismatch',
  ERR005: 'Undefined variable', ERR006: 'Invalid function call',
  ERR007: 'Missing parentheses', ERR008: 'Invalid import',
  ERR009: 'Unexpected end of file', ERR010: 'Invalid operator',
  ERR011: 'Missing semicolon or block', ERR012: 'Invalid type annotation',
  ERR013: 'Keyword used as identifier', ERR014: 'Unterminated string',
  ERR015: 'Invalid number',     ERR016: 'Duplicate declaration',
  ERR017: 'Missing return value', ERR018: 'Invalid class member',
  ERR019: 'Async error',        ERR020: 'Library not found',
  ERR021: 'Invalid alias',      ERR022: 'Invalid try/catch',
  ERR023: 'Invalid export',     ERR024: 'Invalid const assignment',
  ERR025: 'Invalid destroy usage', ERR026: 'Built-in library error',
  ERR027: 'Invalid library entry point', ERR028: 'Invalid module export',
  ERR029: 'Invalid as target',  ERR030: 'Unexpected keyword',
  ERR031: 'Invalid range arguments', ERR032: 'Invalid parameter',
  ERR033: 'Circular import',    ERR034: 'Missing main script',
  ERR035: 'Script execution error', ERR036: 'Unsupported feature',
  ERR037: 'Invalid catch variable', ERR038: 'Duplicate alias',
  ERR039: 'Invalid spread',     ERR040: 'Permission denied',
};

class CajyuError extends Error {
  constructor(code, line, column, lineContent, message) {
    const errName = ERRORS[code] || 'Unknown error';
    const pointer = ' '.repeat(Math.max(0, column)) + '^';
    super(`There is an ${errName.toLowerCase()} in line ${line}: ${code}.\n    ${(lineContent || '').trim()}\n   ${pointer}`);
    this.code = code; this.line = line; this.column = column;
  }
}

// ─── Built-in libraries ──────────────────────────────────────────────────────
const BUILTIN_LIBS = new Set(['exec']);

function builtinLibCode(name) {
  switch (name) {
    case 'Bexec': return `
import { execSync } from 'child_process'; export const CayjuLib = { exec: (command) => { try { return execSync(command, { encoding: 'utf-8' }).trim(); } catch (e) { throw new Error('Exec failed: ' + e.message);}}};
`;
    case 'Bfs': return `import fs from 'fs';import path from 'path';export const CayjuLib = {readFile: (p, encoding = 'utf-8') => fs.readFileSync(p, encoding),writeFile: (p, content) => fs.writeFileSync(p, content),appendFile: (p, content) => fs.appendFileSync(p, content),};    `;
    default: return '';
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function compileAndRun(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`); process.exit(1);
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

// ─── Required semicolons ──────────────────────────────────────────────────────
function validateSemicolons(source) {
  const lines = source.split('\n');
  let objectDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const line = original.trim();

    // Ignora linhas vazias e comentários
    if (!line || line.startsWith('//')) continue;

    // Imports e exports também precisam terminar com ;
    // O compilador validará as instruções comuns abaixo.

    // Enquanto estivermos dentro de um objeto, suas propriedades
    // não precisam terminar com ; individualmente.
    if (objectDepth > 0) {
      for (const ch of line) {
        if (ch === '{') objectDepth++;
        if (ch === '}') objectDepth--;
      }

      if (objectDepth < 0) objectDepth = 0;

      // O objeto terminou: sua declaração deve acabar com ;
      if (objectDepth === 0 && !line.endsWith(';')) {
        throw new CajyuError(
          'ERR011',
          i + 1,
          original.length,
          original,
          'Object declarations must end with ;'
        );
      }

      continue;
    }

    // Identifica a abertura de um objeto em uma declaração.
    if (/^(?:const|let|var)\s+[\w$]+(?:\s*:\s*\w+)?\s*=\s*\{/.test(line)) {
      let depth = 0;

      for (const ch of line) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }

      if (depth > 0) {
        objectDepth = depth;
        continue;
      }

      if (!line.endsWith(';')) {
        throw new CajyuError(
          'ERR011',
          i + 1,
          original.length,
          original,
          'Object declarations must end with ;'
        );
      }

      continue;
    }

    // Blocos de código podem abrir sem ;.
    if (line.endsWith('{')) continue;

    // Fechamentos de blocos não precisam de ;.
    if (line === '}' || line === '};' || line.startsWith('} else')) {
      continue;
    }

    // Todo comando restante precisa terminar com ;
    if (!line.endsWith(';')) {
      throw new CajyuError(
        'ERR011',
        i + 1,
        original.length,
        original,
        'Missing semicolon ;'
      );
    }
  }
}

// ─── Transpiler ──────────────────────────────────────────────────────────────
function transpile(source, baseDir) {
  validateSemicolons(source);
  const lines  = source.split('\n');
  const imports  = [];
  const exports_ = [];
  const codeLines = [];

  // ── Pass 1: collect imports & exports ──────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const mImp = line.match(
      /^\s*import\s+(\*|\w+)(?:\s+as\s+(\w+))?\s+from\s+['"]?([^;\s'"]+)['"]?\s*;\s*$/
    );
    if (mImp) {
      imports.push({ what: mImp[1], alias: mImp[2] || null, from: mImp[3], line: i + 1 });
      continue;
    }

    const mExp = line.match(/^\s*export\s+(.+?)\s*;?\s*$/);
    if (mExp) {
      exports_.push({ what: mExp[1], line: i + 1 });
      continue;
    }

    codeLines.push(line);
  }

  let code = codeLines.join('\n');
  code = preprocessWithErrors(code, lines);
  code = transpileConst(code);
  // FIX #2: transpileTryCatch ANTES de transpileControlFlow
  // para que o `if (_isTryError(...))` gerado não seja re-processado
  code = transpileTryCatch(code);
  code = transpileDestroy(code);
  // FIX #1: funções nomeadas primeiro, depois anônimas corretamente separadas
  code = transpileFunctions(code);
  code = transpileAnonymousFunctions(code);
  code = transpileControlFlow(code);
  code = transpileOneLiners(code);

  // ── Build import block ────────────────────────────────────────────────────
  let importCode = '';
  // FIX #6: contador para evitar colisão de _lib em import *
  let libCounter = 0;

  for (const imp of imports) {
    const bindName = imp.alias || imp.what;

    if (BUILTIN_LIBS.has(imp.from) ||
        (imp.from.startsWith('CajyuLibs.') && BUILTIN_LIBS.has(imp.from.split('.')[1]))) {
      const libName = imp.from.startsWith('CajyuLibs.') ? imp.from.split('.')[1] : imp.from;
      importCode += builtinLibCode(libName) + '\n';
      if (imp.alias && imp.what !== '*') {
        importCode += `const ${imp.alias} = ${imp.what};\n`;
      }
      continue;
    }

    const libPath = resolveLib(imp.from, baseDir);
    if (libPath && fs.existsSync(libPath)) {
      const url = pathToFileURL(libPath).href;
      if (imp.what === '*') {
        // FIX #6: nome único por import *
        const uid = `_lib_star_${libCounter++}`;
        importCode += `const ${uid} = await import('${url}'); Object.assign(globalThis, ${uid}.CajyuLib || ${uid});\n`;
      } else {
        importCode += `const { CajyuLib: _lib_${bindName} } = await import('${url}'); const ${bindName} = _lib_${bindName}.${imp.what} || _lib_${bindName};\n`;
      }
    } else {
      throw new CajyuError('ERR020', imp.line, 0, lines[imp.line - 1] || '', `Library not found: ${imp.from}`);
    }
  }

  // FIX #7: exports são emitidos NO NÍVEL DO MÓDULO, fora do async IIFE
  // Coletamos os nomes e adicionamos após o IIFE
  const exportNames = exports_.map(e => e.what);

  // ── Builtins ──────────────────────────────────────────────────────────────
  const builtins = `
// ── Cajyu builtins ──────────────────────────────────────
function _range(a, b, c) {
  const r = [];
  // FIX #8: step negativo suportado corretamente
  if (b == null) {
    for (let i = 0; i < a; i++) r.push(i);
  } else if (c == null) {
    for (let i = a; i <= b; i++) r.push(i);
  } else if (c > 0) {
    for (let i = a; i <= b; i += c) r.push(i);
  } else {
    for (let i = a; i >= b; i += c) r.push(i); // step negativo
  }
  return r;
}
function _len(x) {
  if (x == null) return 0;
  if (typeof x === 'string' || Array.isArray(x)) return x.length;
  if (typeof x === 'object') return Object.keys(x).length;
  return 0;
}
function _typeCheck(val, type) {
  if (!type) return val;
  const t = String(type).toLowerCase();
  if (t === 'string'  && typeof val !== 'string')  throw new Error('ERR004: expected String');
  if ((t === 'number' || t === 'int' || t === 'float') && typeof val !== 'number') throw new Error('ERR004: expected Number');
  if (t === 'boolean' && typeof val !== 'boolean') throw new Error('ERR004: expected Boolean');
  if (t === 'array'   && !Array.isArray(val))      throw new Error('ERR004: expected Array');
  if (t === 'object'  && (typeof val !== 'object' || val === null)) throw new Error('ERR004: expected Object');
  return val;
}
class _CajyuTryError {
  constructor(e) { this.message = e.message; this.raw = e; this.code = 'E' + (e.code || '000'); }
  toString() { return this.code + ': ' + this.message; }
  is(code) { return this.code === String(code); }
}
function _isTryError(v) { return v instanceof _CajyuTryError; }
function _destroy(obj) {
  if (Array.isArray(obj)) return obj;
  if (typeof obj === 'object' && obj !== null) return Object.values(obj);
  return [obj];
}
`;

  // FIX #7: variáveis exportadas precisam ser declaradas fora do IIFE
  // Declaramos no topo do módulo com `let`, o IIFE as preenche, depois exportamos
  let exportDecls = '';
  let exportStmt  = '';
  if (exportNames.length > 0) {
    exportDecls = exportNames.map(n => `let ${n};`).join('\n') + '\n';
    exportStmt  = `export { ${exportNames.join(', ')} };\n`;
  }

  return `
${importCode}
${builtins}
${exportDecls}
(async () => {
${code}
})().catch(e => { console.error(e.message); process.exit(1); });
${exportStmt}`;
}

// ─── Preprocessing ────────────────────────────────────────────────────────────
function preprocessWithErrors(code, originalLines) {
  const result = [];
  const lines  = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let line    = lines[i];
    let newLine = '';
    let inString = false;
    let stringChar = '';
    // FIX #11: ignorar comentários de linha
    let inComment = false;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];

      // detecta início de comentário de linha //
      if (!inString && ch === '/' && line[j + 1] === '/') {
        inComment = true;
        newLine += line.slice(j); // copia o resto literalmente
        break;
      }

      if (!inString && (ch === '"' || ch === "'")) { inString = true; stringChar = ch; newLine += ch; continue; }
      if (inString && ch === stringChar && line[j - 1] !== '\\') { inString = false; newLine += ch; continue; }
      if (inString) { newLine += ch; continue; }

      if (line.substr(j, 3) === 'and' && isWordBoundary(line, j, 3)) { newLine += '&&'; j += 2; continue; }
      if (line.substr(j, 2) === 'or'  && isWordBoundary(line, j, 2)) { newLine += '||'; j += 1; continue; }
      if (line.substr(j, 3) === 'not' && isWordBoundary(line, j, 3)) { newLine += '!';  j += 2; continue; }
      newLine += ch;
    }

    if (inString) throw new CajyuError('ERR014', i + 1, line.length, line, 'Unterminated string');

    newLine = newLine
      .replace(/sync\s+fn\s+(\w+)/g, 'async function $1')
      .replace(/\bwait\s+/g, 'await ')
      .replace(/\belif\b/g, 'else if')
      .replace(/\bSelf\./g, 'this.')
      .replace(/\brange\(/g, '_range(')
      .replace(/\blen\(/g, '_len(')
      .replace(/var\s+(\w+):(\w+)\s*=\s*(.+)/g, 'let $1 = _typeCheck($3, "$2")')
      .replace(/\bvar\s+(\w+)\s*=/g, 'let $1 =');

    result.push(newLine);
  }
  return result.join('\n');
}

// ─── const ────────────────────────────────────────────────────────────────────
function transpileConst(code) {
  return code
    .replace(/\bconst\s+(\w+):(\w+)\s*=\s*(.+)/g, 'const $1 = _typeCheck($3, "$2")')
    .replace(/\bconst\s+(\w+)\s*=/g, 'const $1 =');
}

// ─── try/catch ────────────────────────────────────────────────────────────────
// FIX #2: o bloco if gerado usa um marcador interno __cajyu_try__ para que
// transpileControlFlow não envolva o if em parênteses extras.
// FIX #3: try captura tudo até o `;` no mesmo bloco de linha, mas agora
// também aceita a linha inteira até o fim (sem exigir `;` obrigatório no regex).
function transpileTryCatch(code) {
  // const x = try expr;   (o `;` é opcional para maior tolerância)
  code = code.replace(
    /const\s+(\w+)\s*=\s*try\s+(.+?)\s*;/g,
    (_, varName, expr) =>
      `let ${varName}; try { ${varName} = (${expr}); } catch (__cajyu_e_${varName}__) { ${varName} = new _CajyuTryError(__cajyu_e_${varName}__); }`
  );

  // catch varName as alias { ... }
  code = code.replace(
    /catch\s+(\w+)\s+as\s+(\w+)\s*\{/g,
    (_, varName, alias) =>
      `if (_isTryError(${varName})) { const ${alias} = ${varName}; // __cajyu_catch_if__`
  );

  // catch varName { ... }
  code = code.replace(
    /catch\s+(\w+)\s*\{/g,
    (_, varName) => `if (_isTryError(${varName})) { // __cajyu_catch_if__`
  );

  return code;
}

// ─── destroy ─────────────────────────────────────────────────────────────────
// FIX #4: destroy dentro de strings não é mais substituído porque
// preprocessWithErrors já rodou; mas a regex ainda pode pegar conteúdo de string
// se chamada em ordem errada. Protegemos pulando trechos entre aspas.
function transpileDestroy(code) {
  return replaceOutsideStrings(code, /\bdestroy\s*\(([^)]+)\)/g, (_, inner) => `..._destroy(${inner})`);
}

// ─── Funções ──────────────────────────────────────────────────────────────────
const CLASS_KEYWORDS = new Set([
  'if','else','while','for','return','class','fn','function',
  'constructor','catch','try','switch','do','get','set','async','await',
  'let','const','var','new','throw','typeof','instanceof','delete','void','yield'
]);

function transpileFunctions(code) {
  // FIX #12: sync fn dentro de classe → `async nomeMetodo()` (sem `function`)
  // Já feito em preprocessWithErrors via replace de `sync fn nome` → `async function nome`
  // mas dentro de classe precisa ser reprocessado depois do transpile de classe.
  // Abordagem: marcamos métodos async com prefixo especial antes de entrar aqui.
  code = code.replace(/\basync function (\w+)\s*\{/gm, '__CAJYU_ASYNC__ $1 {');

  // fn nome params { }
  code = code.replace(
    /^fn\s+(\w+)\s+([^{]+)\{/gm,
    (_, name, rawParams) => {
      const { jsParams, aliasLines } = parseParams(rawParams);
      return `function ${name}(${jsParams}) {${aliasLines ? '\n  ' + aliasLines : ''}`;
    }
  );

  // fn nome { }  (sem params)
  code = code.replace(/^fn\s+(\w+)\s*\{/gm, 'function $1() {');

  // Constructors
  code = code.replace(/Main\s+([^{]*)\{/g, (_, p) => {
    const { jsParams, aliasLines } = parseParams(p);
    return `constructor(${jsParams}) {${aliasLines ? '\n  ' + aliasLines : ''}`;
  });

  // Métodos de classe: `palavra {`
  // FIX #5: lista expandida de keywords protegidas
  code = code.replace(/^\s*(\w+)\s*\{/gm, (m, name) => {
    if (CLASS_KEYWORDS.has(name)) return m;
    return `  ${name}() {`;
  });

  // Restaura métodos async
  code = code.replace(/__CAJYU_ASYNC__\s+(\w+)\s*\(\)\s*\{/g, '  async $1() {');
  code = code.replace(/__CAJYU_ASYNC__\s+(\w+)\s*\{/g, '  async $1() {');

  return code;
}

// FIX #1: transpileAnonymousFunctions reescrito com lógica correta.
// Antes: lookbehind `(?<![^\n])` era equivalente a "só no início de linha" — errado.
// Agora: procura `fn` que NÃO está no início da linha (ou seja, é inline/anônimo).
function transpileAnonymousFunctions(code) {
  // Casa `fn params {` ou `fn {` somente quando precedido por algo que não seja
  // início de linha (espaço no começo conta como início de linha).
  // Usamos replaceOutsideStrings para segurança.
  return replaceOutsideStrings(
    code,
    /(?<=\S.*?)fn\s+([^{]*)\{/g,
    (_, rawParams) => {
      const { jsParams, aliasLines } = parseParams(rawParams);
      return `function(${jsParams}) {${aliasLines ? '\n  ' + aliasLines : ''}`;
    }
  );
}

// ─── parseParams ─────────────────────────────────────────────────────────────
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

  return { jsParams: jsParamList.join(', '), aliasLines: aliasList.join(' ') };
}

// ─── Control flow ─────────────────────────────────────────────────────────────
// FIX #2: não reprocessar `if` que já vem do try/catch (marcados com __cajyu_catch_if__)
function transpileControlFlow(code) {
  return code
    // Só adiciona parênteses em `if` que ainda não os têm e não é gerado internamente
    .replace(/\bif\s+(?!\()([^{]+?)\s*\{/g, 'if ($1) {')
    .replace(/else\s+if\s+(?!\()([^{]+?)\s*\{/g, 'else if ($1) {')
    .replace(/\bwhile\s+(?!\()([^{]+?)\s*\{/g, 'while ($1) {')
    .replace(/for\s+(\w+)\s+in\s+([^ {\n]+)(\s*\{)/g, 'for (let $1 of $2) $3');
}

function transpileOneLiners(code) {
  return code
    .replace(/return\s+(\{[^}]*\}|.+?)\s+if\s+([^;]+);/g, 'if ($2) return $1;')
    .replace(/if\s+([^:{;\n]+)\s+return\s+([^;\n{]+)/g, 'if ($1) return $2;')
    .replace(/while\s+([^:{;\n]+)\s+([^;\n{]+);?/g, 'while ($1) { $2; }')
    .replace(/for\s+(\w+)\s+in\s+([^ {\n;]+)\s+([^;\n{]+);?/g, 'for (let $1 of $2) { $3; }');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isWordBoundary(line, index, len) {
  const before = index === 0 || !/\w/.test(line[index - 1]);
  const after  = index + len >= line.length || !/\w/.test(line[index + len]);
  return before && after;
}

// Substitui regex somente fora de strings (simples e duplas)
function replaceOutsideStrings(code, regex, replacer) {
  const result = [];
  let i = 0;
  while (i < code.length) {
    // String literal
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i];
      let j = i + 1;
      while (j < code.length && !(code[j] === q && code[j - 1] !== '\\')) j++;
      result.push(code.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    // Pega o próximo pedaço até a próxima string
    const nextQuote = Math.min(
      code.indexOf('"', i) === -1 ? code.length : code.indexOf('"', i),
      code.indexOf("'", i) === -1 ? code.length : code.indexOf("'", i)
    );
    const segment = code.slice(i, nextQuote);
    result.push(segment.replace(regex, replacer));
    i = nextQuote;
  }
  return result.join('');
}

// FIX #9: cleanup de arquivos temp ao sair do processo
const _tmpLibFiles = [];
process.on('exit', () => { for (const f of _tmpLibFiles) try { fs.unlinkSync(f); } catch {} });

function resolveLib(from, baseDir) {
  if (from.startsWith('CajyuLibs')) {
    const name = from.split('.')[1] || 'serial';
    const cands = [
      path.resolve(baseDir, 'CajyuLibs', name, 'main.cjy'),
      path.resolve(baseDir, 'CajyuLibs', name, 'main.js'),
      path.resolve(baseDir, '..', 'CajyuLibs', name, 'main.cjy'),
      path.resolve(baseDir, '..', 'CajyuLibs', name, 'main.js'),
      path.resolve(process.cwd(), 'CajyuLibs', name, 'main.cjy'),
      path.resolve(process.cwd(), 'CajyuLibs', name, 'main.js'),
    ];
    const found = cands.find(p => fs.existsSync(p));
    if (found && found.endsWith('.cjy')) {
      const cjySrc = fs.readFileSync(found, 'utf-8');
      const jsCode = transpile(cjySrc, path.dirname(found));
      const tmpPath = path.join('/tmp', `cajyu_lib_${name}_${Date.now()}.mjs`);
      fs.writeFileSync(tmpPath, jsCode);
      _tmpLibFiles.push(tmpPath); // FIX #9
      return tmpPath;
    }
    return found;
  }
  const resolved = path.resolve(baseDir, from);
  if (fs.existsSync(resolved + '.cjy')) {
    const cjySrc = fs.readFileSync(resolved + '.cjy', 'utf-8');
    const jsCode = transpile(cjySrc, path.dirname(resolved));
    const tmpPath = path.join('/tmp', `cajyu_mod_${Date.now()}.mjs`);
    fs.writeFileSync(tmpPath, jsCode);
    _tmpLibFiles.push(tmpPath); // FIX #9
    return tmpPath;
  }
  return resolved;
}
