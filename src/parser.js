// ─── Cajyu Parser ─────────────────────────────────────────────────────────────
// Constrói uma AST a partir dos tokens do Lexer.
// A AST é depois percorrida pelo codegen para emitir JS.

import { TT, KEYWORDS } from './lexer.js';

export class ParseError extends Error {
  constructor(msg, token) {
    const loc = token ? `${token.line}:${token.col}` : '?';
    super(`Parse error at ${loc} — ${msg} (got ${token ? token.type + ' ' + JSON.stringify(token.value) : 'EOF'})`);
    this.token = token;
  }
}

// ─── AST node helpers ────────────────────────────────────────────────────────
const n = (type, props) => ({ type, ...props });

export class Parser {
  constructor(tokens) {
    // Remove comentários e newlines excessivos
    this.tokens  = tokens.filter(t => t.type !== TT.COMMENT);
    this.pos     = 0;
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  peek(offset = 0)  { return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]; }
  advance()         { const t = this.tokens[this.pos]; if (t.type !== TT.EOF) this.pos++; return t; }
  isEOF()           { return this.peek().type === TT.EOF; }

  check(type, value = null) {
    const t = this.peek();
    return t.type === type && (value === null || t.value === value);
  }

  match(type, value = null) {
    if (this.check(type, value)) { return this.advance(); }
    return null;
  }

  expect(type, value = null) {
    const t = this.match(type, value);
    if (!t) {
      const got = this.peek();
      throw new ParseError(
        `Expected ${type}${value ? ' ' + JSON.stringify(value) : ''}`,
        got
      );
    }
    return t;
  }

  skipNewlines() { while (this.check(TT.NEWLINE)) this.advance(); }

  // ── Entry point ────────────────────────────────────────────────────────────
  parse() {
    const body = [];
    while (!this.isEOF()) {
      this.skipNewlines();
      if (this.isEOF()) break;
      body.push(this.parseStatement());
    }
    return n('Program', { body });
  }

  // ── Statements ─────────────────────────────────────────────────────────────
  parseStatement() {
    const t = this.peek();

    if (t.type === TT.KEYWORD) {
      switch (t.value) {
        case 'import':  return this.parseImport();
        case 'export':  return this.parseExport();
        case 'var':
        case 'const':   return this.parseVarDecl();
        case 'fn':      return this.parseFn();
        case 'sync':    return this.parseSyncFn();
        case 'return':  return this.parseReturn();
        case 'if':      return this.parseIf();
        case 'for':     return this.parseFor();
        case 'while':   return this.parseWhile();
        case 'class':   return this.parseClass();
        case 'try':     return this.parseTryExpr();  // try como statement
        case 'catch':   return this.parseCatch();
      }
    }

    // Expressão como statement (chamada de função, atribuição, etc.)
    const expr = this.parseExpr();
    this.match(TT.SEMICOLON);
    this.match(TT.NEWLINE);
    return n('ExprStatement', { expr });
  }

  // ── import ─────────────────────────────────────────────────────────────────
  parseImport() {
    this.expect(TT.KEYWORD, 'import');
    const names = [];
    const first = this.expect(TT.IDENT).value;
    names.push({ imported: first, alias: first });
    while (this.match(TT.COMMA)) {
      const imported = this.expect(TT.IDENT).value;
      let alias = imported;
      if (this.check(TT.KEYWORD, 'as')) { this.advance(); alias = this.expect(TT.IDENT).value; }
      names.push({ imported, alias });
    }
    let alias = null;
    if (names.length === 1 && this.check(TT.KEYWORD, 'as')) {
      this.advance();
      alias = this.expect(TT.IDENT).value;
      names[0].alias = alias;
    }
    const what = names.length === 1 ? names[0].imported : '*';
    this.expect(TT.KEYWORD, 'from');
    // lib pode ser bareword ou string
    const from = this.peek().type === TT.STRING
      ? this.advance().value
      : this.parseLibPath();
    this.match(TT.SEMICOLON); this.match(TT.NEWLINE);
    return n('Import', { what, alias, names: names.length > 1 ? names : null, from });
  }

  parseLibPath() {
    // CajyuLibs.http ou Bfs ou identificador simples
    let path = this.expect(TT.IDENT).value;
    while (this.check(TT.DOT)) {
      this.advance();
      path += '.' + this.expect(TT.IDENT).value;
    }
    return path;
  }

  // ── export ─────────────────────────────────────────────────────────────────

  parseExport() {
    this.expect(TT.KEYWORD, 'export');

    if (this.check(TT.KEYWORD, 'const') || this.check(TT.KEYWORD, 'var')) {
      const declaration = this.parseVarDecl();
      return n('Export', {
        name: declaration.name,
        declaration
      });
    }

    const name = this.expect(TT.IDENT).value;
    this.match(TT.SEMICOLON);
    this.match(TT.NEWLINE);
    return n('Export', { name });
  }

  // ── var / const ────────────────────────────────────────────────────────────
  parseVarDecl() {
    const kw  = this.advance().value; // var | const
    const name = this.expect(TT.IDENT).value;
    let typeAnnotation = null;
    if (this.check(TT.COLON)) { this.advance(); typeAnnotation = this.expect(TT.IDENT).value; }
    this.expect(TT.ASSIGN);
    const value = this.parseExpr();
    this.match(TT.SEMICOLON); this.match(TT.NEWLINE);
    return n('VarDecl', { kind: kw, name, typeAnnotation, value });
  }

  // ── fn ─────────────────────────────────────────────────────────────────────
  parseFn() {
    this.expect(TT.KEYWORD, 'fn');
    const name   = this.check(TT.IDENT) ? this.advance().value : null;
    const params = this.parseParams();
    const body   = this.parseBlock();
    return n('FnDecl', { name, params, body, async: false });
  }

  parseSyncFn() {
    this.expect(TT.KEYWORD, 'sync');
    this.expect(TT.KEYWORD, 'fn');
    const name   = this.check(TT.IDENT) ? this.advance().value : null;
    const params = this.parseParams();
    const body   = this.parseBlock();
    return n('FnDecl', { name, params, body, async: true });
  }

  // params: a, b:Type, c as x, d:Type as y
  parseParams() {
    const params = [];
    // Params terminam quando encontramos { — sem parênteses em Cajyu
    while (!this.check(TT.LBRACE) && !this.isEOF()) {
      if (this.check(TT.NEWLINE)) break;
      const name = this.expect(TT.IDENT).value;
      let typeAnn = null;
      let alias   = null;
      if (this.check(TT.COLON)) { this.advance(); typeAnn = this.expect(TT.IDENT).value; }
      if (this.check(TT.KEYWORD, 'as')) { this.advance(); alias = this.expect(TT.IDENT).value; }
      params.push({ name, typeAnn, alias });
      this.match(TT.COMMA);
    }
    return params;
  }

  // ── block { ... } ──────────────────────────────────────────────────────────
  parseBlock() {
    this.expect(TT.LBRACE);
    const body = [];
    while (!this.check(TT.RBRACE) && !this.isEOF()) {
      this.skipNewlines();
      if (this.check(TT.RBRACE)) break;
      body.push(this.parseStatement());
    }
    this.expect(TT.RBRACE);
    this.match(TT.NEWLINE);
    return n('Block', { body });
  }

  // ── return ─────────────────────────────────────────────────────────────────
  parseReturn() {
    const tok = this.expect(TT.KEYWORD, 'return');
    let value = null;
    if (!this.check(TT.NEWLINE) && !this.check(TT.SEMICOLON) && !this.check(TT.RBRACE) && !this.isEOF())
      value = this.parseExpr();
    this.match(TT.SEMICOLON); this.match(TT.NEWLINE);
    return n('Return', { value, line: tok.line });
  }

  // ── if / elif / else ───────────────────────────────────────────────────────
  parseIf() {
    this.expect(TT.KEYWORD, 'if');
    const test       = this.parseExpr();
    const consequent = this.parseBlock();
    let alternate    = null;
    this.skipNewlines();
    if (this.check(TT.KEYWORD, 'elif')) {
      this.advance();
      const elifTest = this.parseExpr();
      const elifBody = this.parseBlock();
      alternate = n('If', { test: elifTest, consequent: elifBody, alternate: null });
    } else if (this.check(TT.KEYWORD, 'else')) {
      this.advance();
      alternate = this.parseBlock();
    }
    return n('If', { test, consequent, alternate });
  }

  // ── for ────────────────────────────────────────────────────────────────────
  parseFor() {
    this.expect(TT.KEYWORD, 'for');
    const iter   = this.expect(TT.IDENT).value;
    this.expect(TT.KEYWORD, 'in');
    const target = this.parseExpr();
    const body   = this.parseBlock();
    return n('ForIn', { iter, target, body });
  }

  // ── while ──────────────────────────────────────────────────────────────────
  parseWhile() {
    this.expect(TT.KEYWORD, 'while');
    const test = this.parseExpr();
    const body = this.parseBlock();
    return n('While', { test, body });
  }

  // ── class ──────────────────────────────────────────────────────────────────
  parseClass() {
    this.expect(TT.KEYWORD, 'class');
    const name    = this.expect(TT.IDENT).value;
    this.expect(TT.LBRACE);
    const members = [];
    while (!this.check(TT.RBRACE) && !this.isEOF()) {
      this.skipNewlines();
      if (this.check(TT.RBRACE)) break;

      const isPrivate = this.check(TT.KEYWORD, 'private');
      if (isPrivate) this.advance();

      if (this.check(TT.KEYWORD, 'Main')) {
        this.advance();
        const params = this.parseParams();
        const body   = this.parseBlock();
        members.push(n('Constructor', { params, body }));
      } else if (this.check(TT.KEYWORD, 'sync')) {
        this.advance();
        this.expect(TT.KEYWORD, 'fn');
        const mname  = this.expect(TT.IDENT).value;
        const params = this.parseParams();
        const body   = this.parseBlock();
        members.push(n('Method', { name: mname, params, body, async: true, private: isPrivate }));
      } else if (this.check(TT.IDENT)) {
        const mname  = this.advance().value;
        const params = this.parseParams();
        const body   = this.parseBlock();
        members.push(n('Method', { name: mname, params, body, async: false, private: isPrivate }));
      } else {
        this.advance(); // segurança
      }
    }
    this.expect(TT.RBRACE);
    this.match(TT.NEWLINE);
    return n('Class', { name, members });
  }

  // ── try / catch ────────────────────────────────────────────────────────────
  parseTryExpr() {
    // usado quando `const x = try expr` não é capturado como VarDecl
    // aqui tratamos `try expr` como statement de guarda
    this.expect(TT.KEYWORD, 'try');
    const expr = this.parseExpr();
    this.match(TT.SEMICOLON); this.match(TT.NEWLINE);
    return n('TryExpr', { expr, varName: null });
  }

  parseCatch() {
    this.expect(TT.KEYWORD, 'catch');
    const varName = this.expect(TT.IDENT).value;
    let alias = null;
    if (this.check(TT.KEYWORD, 'as')) { this.advance(); alias = this.expect(TT.IDENT).value; }
    const body = this.parseBlock();
    return n('Catch', { varName, alias, body });
  }

  // ── Expressões (Pratt parser) ───────────────────────────────────────────────
  parseExpr(minBP = 0) {
    let left = this.parseUnary();

    while (true) {
      const op  = this.peek();
      const bp  = infixBP(op);
      if (bp === null || bp[0] < minBP) break;
      this.advance();

      // Atribuições: =, +=, -=
      if (op.type === TT.ASSIGN || op.type === TT.PLUS_ASSIGN || op.type === TT.MINUS_ASSIGN) {
        const right = this.parseExpr(bp[1]);
        left = n('Assign', { op: op.value, left, right });
        continue;
      }

      // Operador ternário inline: `return X if COND`
      // Já tratado no parseReturn — aqui apenas operadores binários
      const right = this.parseExpr(bp[1]);
      left = n('BinaryOp', { op: op.value, left, right });
    }

    return left;
  }

  parseUnary() {
    // not / !
    if (this.check(TT.KEYWORD, 'not') || this.check(TT.NOT)) {
      const op = this.advance().value;
      return n('UnaryOp', { op: '!', operand: this.parseUnary() });
    }
    // Prefix increment/decrement
    if (this.check(TT.INC) || this.check(TT.DEC)) {
      const op = this.advance().value;
      const operand = this.parseUnary();
      return n('Update', { op, operand, prefix: true });
    }
    // - unário
    if (this.check(TT.MINUS)) {
      this.advance();
      return n('UnaryOp', { op: '-', operand: this.parseUnary() });
    }
    // wait (await)
    if (this.check(TT.KEYWORD, 'wait')) {
      this.advance();
      return n('Await', { expr: this.parseUnary() });
    }
    // new
    if (this.check(TT.KEYWORD, 'new')) {
      this.advance();
      const callee = this.expect(TT.IDENT).value;
      const args   = this.check(TT.LPAREN) ? this.parseArgList() : [];
      return n('New', { callee, args });
    }
    // destroy
    if (this.check(TT.KEYWORD, 'destroy')) {
      this.advance();
      this.expect(TT.LPAREN);
      const expr = this.parseExpr();
      this.expect(TT.RPAREN);
      return n('Destroy', { expr });
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check(TT.DOT)) {
        this.advance();
        const prop = this.expect(TT.IDENT).value;
        expr = n('MemberAccess', { object: expr, prop });
      } else if (this.check(TT.LBRACKET)) {
        this.advance();
        const index = this.parseExpr();
        this.expect(TT.RBRACKET);
        expr = n('Index', { object: expr, index });
      } else if (this.check(TT.LPAREN)) {
        const args = this.parseArgList();
        expr = n('Call', { callee: expr, args });
      } else if (this.check(TT.INC)) {
        this.advance();
        expr = n('Update', { op: '++', operand: expr });
      } else if (this.check(TT.DEC)) {
        this.advance();
        expr = n('Update', { op: '--', operand: expr });
      } else {
        break;
      }
    }

    return expr;
  }

  parsePrimary() {
    const t = this.peek();

    // Literais
    if (t.type === TT.NUMBER)  { this.advance(); return n('Literal', { value: Number(t.value) }); }
    if (t.type === TT.STRING)  { this.advance(); return n('Literal', { value: t.value, raw: true }); }
    if (t.type === TT.BOOL)    { this.advance(); return n('Literal', { value: t.value === 'true' }); }
    if (t.type === TT.NULL)    { this.advance(); return n('Literal', { value: null }); }

    // Self
    if (t.type === TT.KEYWORD && t.value === 'Self') { this.advance(); return n('Self', {}); }

    // Identificador
    if (t.type === TT.IDENT) { this.advance(); return n('Ident', { name: t.value }); }

    // Parênteses
    if (t.type === TT.LPAREN) {
      this.advance();
      const expr = this.parseExpr();
      this.expect(TT.RPAREN);
      return expr;
    }

    // Array
    if (t.type === TT.LBRACKET) {
      this.advance();
      const elements = [];

      this.skipNewlines();

      while (!this.check(TT.RBRACKET) && !this.isEOF()) {
        if (this.check(TT.SPREAD)) {
          this.advance();
          elements.push(n('Spread', { expr: this.parseExpr() }));
        } else {
          elements.push(this.parseExpr());
        }

        this.skipNewlines();

        if (!this.match(TT.COMMA)) break;

        this.skipNewlines();
      }

      this.expect(TT.RBRACKET);
      return n('ArrayLiteral', { elements });
    }

    // Objeto
    if (t.type === TT.LBRACE) {
      this.advance();
      const props = [];
      while (!this.check(TT.RBRACE) && !this.isEOF()) {
        this.skipNewlines();
        if (this.check(TT.RBRACE)) break;
        if (this.check(TT.SPREAD)) { this.advance(); props.push(n('Spread', { expr: this.parseExpr() })); }
        else {
          const key = this.check(TT.STRING) ? this.advance().value : this.expect(TT.IDENT).value;
          if (this.check(TT.COLON)) { this.advance(); props.push({ key, value: this.parseExpr() }); }
          else props.push({ key, value: n('Ident', { name: key }) }); // shorthand
        }
        this.match(TT.COMMA); this.skipNewlines();
      }
      this.expect(TT.RBRACE);
      return n('ObjectLiteral', { props });
    }

    // fn anônimo inline
    if (t.type === TT.KEYWORD && t.value === 'fn') {
      this.advance();
      const params = this.parseParams();
      const body   = this.parseBlock();
      return n('FnExpr', { params, body, async: false });
    }

    // try inline: `const x = try expr`
    if (t.type === TT.KEYWORD && t.value === 'try') {
      this.advance();
      const expr = this.parseExpr();
      return n('TryExpr', { expr });
    }

    throw new ParseError(`Unexpected token in expression`, t);
  }

  parseArgList() {
    this.expect(TT.LPAREN);
    const args = [];

    this.skipNewlines();

    while (!this.check(TT.RPAREN) && !this.isEOF()) {
      if (this.check(TT.SPREAD)) {
        this.advance();
        args.push(n('Spread', { expr: this.parseExpr() }));
      } else {
        args.push(this.parseExpr());
      }

      this.skipNewlines();

      if (!this.match(TT.COMMA)) break;

      this.skipNewlines();
    }

    this.expect(TT.RPAREN);
    return args;
  }
}

// ─── Binding powers (Pratt) ───────────────────────────────────────────────────
function infixBP(token) {
  switch (token.type) {
    case TT.ASSIGN:
    case TT.PLUS_ASSIGN:
    case TT.MINUS_ASSIGN:   return [1, 2];   // right-assoc
    case TT.OR:             return [3, 4];
    case TT.AND:            return [5, 6];
    case TT.EQ: case TT.NEQ: return [7, 8];
    case TT.LT: case TT.GT:
    case TT.LTE: case TT.GTE: return [9, 10];
    case TT.PLUS: case TT.MINUS: return [11, 12];
    case TT.STAR: case TT.SLASH:
    case TT.PERCENT:        return [13, 14];
    default: return null;
  }
}
