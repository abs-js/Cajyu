// ─── Cajyu Code Generator ────────────────────────────────────────────────────
// Percorre a AST e emite JavaScript moderno.

export class CodegenError extends Error {
  constructor(msg, node) {
    super(`Codegen error — ${msg} (node: ${node?.type ?? '?'})`);
    this.node = node;
  }
}

export function generate(ast) {
  const imports  = [];
  const exports_ = [];
  const stmts    = [];

  for (const node of ast.body) {
    if (node.type === 'Import') { imports.push(node); continue; }
    if (node.type === 'Export') { exports_.push(node); continue; }
    stmts.push(node);
  }

  return { imports, exports: exports_, stmts };
}

// Emite código JS a partir de um nó da AST
export function emit(node, indent = 0) {
  if (!node) return '';
  const I = '  '.repeat(indent);

  switch (node.type) {

    case 'Program': return node.body.map(s => emit(s, indent)).join('\n');

    // ── Declarações ────────────────────────────────────────────────────────
    case 'VarDecl': {
      const kw  = node.kind === 'const' ? 'const' : 'let';
      const val = emit(node.value, indent);
      if (node.typeAnnotation) {
        return `${I}${kw} ${node.name} = _typeCheck(${val}, "${node.typeAnnotation}");`;
      }
      return `${I}${kw} ${node.name} = ${val};`;
    }

    case 'FnDecl': {
      const asyncKw = node.async ? 'async ' : '';
      const params  = emitParams(node.params);
      const aliases = emitAliases(node.params, indent + 1);
      const body    = emitBlock(node.body, indent, aliases);
      if (node.name) return `${I}${asyncKw}function ${node.name}(${params}) ${body}`;
      return `${I}${asyncKw}function(${params}) ${body}`;
    }

    case 'FnExpr': {
      // Verifica se o corpo contém Await → async
      const hasAwait = containsAwait(node.body);
      const asyncKw  = (node.async || hasAwait) ? 'async ' : '';
      const params   = emitParams(node.params);
      const aliases  = emitAliases(node.params, indent + 1);
      const body     = emitBlock(node.body, indent, aliases);
      return `${asyncKw}function(${params}) ${body}`;
    }

    case 'Return': {
      if (!node.value) return `${I}return;`;
      return `${I}return ${emit(node.value, indent)};`;
    }

    case 'ExprStatement': return `${I}${emit(node.expr, indent)};`;

    // ── Controle de fluxo ─────────────────────────────────────────────────
    case 'If': {
      const test = emit(node.test, indent);
      const cons = emitBlock(node.consequent, indent);
      let alt = '';
      if (node.alternate) {
        if (node.alternate.type === 'If') alt = ` else ${emit(node.alternate, indent).trimStart()}`;
        else alt = ` else ${emitBlock(node.alternate, indent)}`;
      }
      return `${I}if (${test}) ${cons}${alt}`;
    }

    case 'ForIn': {
      const target = emit(node.target, indent);
      const body   = emitBlock(node.body, indent);
      return `${I}for (let ${node.iter} of ${target}) ${body}`;
    }

    case 'While': {
      const test = emit(node.test, indent);
      const body = emitBlock(node.body, indent);
      return `${I}while (${test}) ${body}`;
    }

    // ── Classes ───────────────────────────────────────────────────────────
    case 'Class': {
      const members = node.members.map(m => emit(m, indent + 1)).join('\n');
      return `${I}class ${node.name} {\n${members}\n${I}}`;
    }

    case 'Constructor': {
      const params  = emitParams(node.params);
      const aliases = emitAliases(node.params, indent + 1);
      const body    = emitBlock(node.body, indent, aliases);
      return `${I}constructor(${params}) ${body}`;
    }

    case 'Method': {
      const asyncKw = node.async ? 'async ' : '';
      const priv    = node.private ? '#' : '';
      const params  = emitParams(node.params);
      const aliases = emitAliases(node.params, indent + 1);
      const body    = emitBlock(node.body, indent, aliases);
      return `${I}${asyncKw}${priv}${node.name}(${params}) ${body}`;
    }

    // ── try/catch ─────────────────────────────────────────────────────────
    case 'TryExpr': {
      if (node.varName) {
        // const x = try expr  → let x; try { x = expr } catch { x = new _CajyuTryError(e) }
        return `let ${node.varName}; try { ${node.varName} = (${emit(node.expr, indent)}); } catch (__e_${node.varName}__) { ${node.varName} = new _CajyuTryError(__e_${node.varName}__); }`;
      }
      return `try { ${emit(node.expr, indent)}; } catch (__e__) {}`;
    }

    case 'Catch': {
      const alias = node.alias ? `const ${node.alias} = ${node.varName};` : '';
      const body  = emitBlock(node.body, indent);
      return `${I}if (_isTryError(${node.varName})) { ${alias}\n${emitBlockInner(node.body, indent)}\n${I}}`;
    }

    // ── Import / Export ───────────────────────────────────────────────────
    case 'Import': return `// import ${node.what}${node.alias ? ' as ' + node.alias : ''} from ${node.from}`;
    case 'Export': return `// export ${node.name}`;

    // ── Expressões ────────────────────────────────────────────────────────
    case 'Literal': {
      if (node.value === null)   return 'null';
      if (node.raw)              return JSON.stringify(node.value);
      if (typeof node.value === 'string') return JSON.stringify(node.value);
      return String(node.value);
    }

    case 'Ident':  return node.name;
    case 'Self':   return 'this';

    case 'BinaryOp': {
      const l = emit(node.left,  indent);
      const r = emit(node.right, indent);
      return `${l} ${node.op} ${r}`;
    }

    case 'UnaryOp':  return `${node.op}${emit(node.operand, indent)}`;
    case 'Await':    return `await ${emit(node.expr, indent)}`;
    case 'Destroy':  return `..._destroy(${emit(node.expr, indent)})`;
    case 'Spread':   return `...${emit(node.expr, indent)}`;

    case 'Assign': {
      return `${emit(node.left, indent)} ${node.op} ${emit(node.right, indent)}`;
    }

    case 'Update': {
      // ++ / -- → x = x + 1
      const op  = node.op === '++' ? ' + 1' : ' - 1';
      const operand = emit(node.operand, indent);
      return `${operand} = ${operand}${op}`;
    }

    case 'MemberAccess': return `${emit(node.object, indent)}.${node.prop}`;

    case 'Index': return `${emit(node.object, indent)}[${emit(node.index, indent)}]`;

    case 'Call': {
      const callee = emit(node.callee, indent);
      const args   = node.args.map(a => emit(a, indent)).join(', ');
      return `${callee}(${args})`;
    }

    case 'New': {
      const args = node.args.map(a => emit(a, indent)).join(', ');
      return `new ${node.callee}(${args})`;
    }

    case 'ArrayLiteral': {
      const els = node.elements.map(e => emit(e, indent)).join(', ');
      return `[${els}]`;
    }

    case 'ObjectLiteral': {
      const props = node.props.map(p => {
        if (p.type === 'Spread') return `...${emit(p.expr, indent)}`;
        const val = emit(p.value, indent);
        // shorthand se valor é o mesmo ident
        if (p.value.type === 'Ident' && p.value.name === p.key) return p.key;
        return `${p.key}: ${val}`;
      });
      return `{ ${props.join(', ')} }`;
    }

    case 'Block': return emitBlock(node, indent);

    default:
      throw new CodegenError(`Unknown node type "${node.type}"`, node);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function emitParams(params) {
  return (params || []).map(p => p.name).join(', ');
}

function emitAliases(params, indent) {
  return (params || [])
    .filter(p => p.alias)
    .map(p => `${'  '.repeat(indent)}const ${p.alias} = ${p.name};`)
    .join('\n');
}

function emitBlock(block, indent, extraLines = '') {
  const I  = '  '.repeat(indent);
  const I2 = '  '.repeat(indent + 1);
  if (!block || !block.body) return '{}';
  const inner = block.body.map(s => emit(s, indent + 1)).filter(Boolean).join('\n');
  const extra = extraLines ? extraLines + '\n' : '';
  if (!inner && !extra) return '{}';
  return `{\n${extra}${inner}\n${I}}`;
}

function emitBlockInner(block, indent) {
  const I2 = '  '.repeat(indent + 1);
  return (block.body || []).map(s => emit(s, indent + 1)).filter(Boolean).join('\n');
}

function containsAwait(node) {
  if (!node) return false;
  if (node.type === 'Await') return true;
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (typeof v === 'object' && v !== null) {
      if (Array.isArray(v)) { if (v.some(containsAwait)) return true; }
      else if (containsAwait(v)) return true;
    }
  }
  return false;
}
