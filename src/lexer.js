// ─── Cajyu Lexer ─────────────────────────────────────────────────────────────
// Tokeniza o source .cjy em uma lista plana de tokens com linha/coluna.

export const TT = {
  // Literais
  NUMBER: 'NUMBER', STRING: 'STRING', BOOL: 'BOOL', NULL: 'NULL',
  // Identificadores e palavras-chave
  IDENT: 'IDENT', KEYWORD: 'KEYWORD',
  // Operadores
  PLUS: 'PLUS', MINUS: 'MINUS', STAR: 'STAR', SLASH: 'SLASH', PERCENT: 'PERCENT',
  EQ: 'EQ', NEQ: 'NEQ', LT: 'LT', GT: 'GT', LTE: 'LTE', GTE: 'GTE',
  AND: 'AND', OR: 'OR', NOT: 'NOT',
  ASSIGN: 'ASSIGN', PLUS_ASSIGN: 'PLUS_ASSIGN', MINUS_ASSIGN: 'MINUS_ASSIGN',
  INC: 'INC', DEC: 'DEC',
  DOT: 'DOT', SPREAD: 'SPREAD',
  ARROW: 'ARROW',
  // Delimitadores
  LPAREN: 'LPAREN', RPAREN: 'RPAREN',
  LBRACE: 'LBRACE', RBRACE: 'RBRACE',
  LBRACKET: 'LBRACKET', RBRACKET: 'RBRACKET',
  COMMA: 'COMMA', COLON: 'COLON', SEMICOLON: 'SEMICOLON',
  // Especiais
  NEWLINE: 'NEWLINE', EOF: 'EOF', COMMENT: 'COMMENT',
};

export const KEYWORDS = new Set([
  'var','const','fn','sync','return','if','elif','else',
  'for','while','in','class','Main','Self','wait','import',
  'export','from','as','try','catch','destroy','new','not',
  'and','or','private','true','false','null',
]);

export class Token {
  constructor(type, value, line, col) {
    this.type = type; this.value = value;
    this.line = line; this.col  = col;
  }
  toString() { return `Token(${this.type}, ${JSON.stringify(this.value)}, ${this.line}:${this.col})`; }
}

export class LexerError extends Error {
  constructor(msg, line, col, src) {
    const pointer = ' '.repeat(Math.max(0, col)) + '^';
    super(`Lexer error at ${line}:${col} — ${msg}\n    ${(src || '').trim()}\n   ${pointer}`);
    this.line = line; this.col = col;
  }
}

export function tokenize(source) {
  const tokens = [];
  const lines  = source.split('\n');
  let pos = 0;
  let line = 1;
  let lineStart = 0;

  function col() { return pos - lineStart; }
  function peek(offset = 0) { return source[pos + offset]; }
  function advance() { const c = source[pos++]; if (c === '\n') { line++; lineStart = pos; } return c; }
  function match(ch) { if (source[pos] === ch) { advance(); return true; } return false; }
  function add(type, value) { tokens.push(new Token(type, value, line, col())); }
  function currentLine() { return lines[line - 1] || ''; }

  while (pos < source.length) {
    const start = pos;
    const startLine = line;
    const startCol  = col();
    const ch = advance();

    // Whitespace (não newline)
    if (ch === ' ' || ch === '\t' || ch === '\r') continue;

    // Newline
    if (ch === '\n') { tokens.push(new Token(TT.NEWLINE, '\n', startLine, startCol)); continue; }

    // Comentário de linha
    if (ch === '/' && peek() === '/') {
      let comment = '';
      while (pos < source.length && peek() !== '\n') comment += advance();
      tokens.push(new Token(TT.COMMENT, comment.trim(), startLine, startCol));
      continue;
    }

    // Comentário de bloco
    if (ch === '/' && peek() === '*') {
      advance(); // consome *
      let comment = '';
      while (pos < source.length && !(peek() === '*' && peek(1) === '/')) comment += advance();
      if (pos < source.length) { advance(); advance(); } // consome */
      tokens.push(new Token(TT.COMMENT, comment.trim(), startLine, startCol));
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'") {
      let str = '';
      while (pos < source.length && peek() !== ch) {
        const c = advance();
        if (c === '\\') {
          const escaped = advance();
          const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
          str += Object.prototype.hasOwnProperty.call(escapes, escaped) ? escapes[escaped] : escaped;
          continue;
        }
        if (c === '\n') throw new LexerError('Unescaped newline in string', startLine, startCol, currentLine());
        str += c;
      }
      if (pos >= source.length) throw new LexerError('Unterminated string', startLine, startCol, currentLine());
      advance(); // fecha aspas
      tokens.push(new Token(TT.STRING, str, startLine, startCol));
      continue;
    }

    // Template strings
    if (ch === '`') {
      let str = '';
      while (pos < source.length && peek() !== '`') {
        const c = advance();
        if (c === '\\') { str += c + advance(); continue; }
        str += c;
      }
      if (pos >= source.length) throw new LexerError('Unterminated template string', startLine, startCol, currentLine());
      advance();
      tokens.push(new Token(TT.STRING, str, startLine, startCol));
      continue;
    }

    // Números
    if (ch >= '0' && ch <= '9') {
      let num = ch;
      while (peek() >= '0' && peek() <= '9') num += advance();
      if (peek() === '.' && source[pos + 1] >= '0' && source[pos + 1] <= '9') {
        num += advance();
        while (peek() >= '0' && peek() <= '9') num += advance();
      }
      tokens.push(new Token(TT.NUMBER, num, startLine, startCol));
      continue;
    }

    // Identificadores e palavras-chave
    if (ch === '_' || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      let ident = ch;
      while (peek() === '_' || (peek() >= 'a' && peek() <= 'z') || (peek() >= 'A' && peek() <= 'Z') || (peek() >= '0' && peek() <= '9'))
        ident += advance();

      if (ident === 'true' || ident === 'false')
        tokens.push(new Token(TT.BOOL, ident, startLine, startCol));
      else if (ident === 'null')
        tokens.push(new Token(TT.NULL, ident, startLine, startCol));
      else if (KEYWORDS.has(ident))
        tokens.push(new Token(TT.KEYWORD, ident, startLine, startCol));
      else
        tokens.push(new Token(TT.IDENT, ident, startLine, startCol));
      continue;
    }

    // Operadores multi-char
    switch (ch) {
      case '+':
        if (match('+'))      add(TT.INC, '++');
        else if (match('=')) add(TT.PLUS_ASSIGN, '+=');
        else                 add(TT.PLUS, '+');
        break;
      case '-':
        if (match('-'))      add(TT.DEC, '--');
        else if (match('=')) add(TT.MINUS_ASSIGN, '-=');
        else                 add(TT.MINUS, '-');
        break;
      case '*': add(TT.STAR,    '*'); break;
      case '%': add(TT.PERCENT, '%'); break;
      case '/': add(TT.SLASH,   '/'); break;
      case '=':
        if (match('='))  add(TT.EQ,     '==');
        else             add(TT.ASSIGN, '=');
        break;
      case '!':
        if (match('='))  add(TT.NEQ, '!=');
        else             add(TT.NOT, '!');
        break;
      case '<':
        if (match('='))  add(TT.LTE, '<=');
        else             add(TT.LT,  '<');
        break;
      case '>':
        if (match('='))  add(TT.GTE, '>=');
        else             add(TT.GT,  '>');
        break;
      case '&': if (match('&')) add(TT.AND, '&&'); break;
      case '|': if (match('|')) add(TT.OR,  '||'); break;
      case '.':
        if (peek() === '.' && peek(1) === '.') { advance(); advance(); add(TT.SPREAD, '...'); }
        else add(TT.DOT, '.');
        break;
      case '(': add(TT.LPAREN,   '('); break;
      case ')': add(TT.RPAREN,   ')'); break;
      case '{': add(TT.LBRACE,   '{'); break;
      case '}': add(TT.RBRACE,   '}'); break;
      case '[': add(TT.LBRACKET, '['); break;
      case ']': add(TT.RBRACKET, ']'); break;
      case ',': add(TT.COMMA,    ','); break;
      case ':': add(TT.COLON,    ':'); break;
      case ';': add(TT.SEMICOLON,';'); break;
      default:
        throw new LexerError(`Unexpected character '${ch}'`, startLine, startCol, currentLine());
    }
  }

  tokens.push(new Token(TT.EOF, null, line, col()));
  return tokens;
}
