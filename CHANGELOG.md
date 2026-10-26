# Changelog

## 1.4.1 — Bugfix release
- Corrigido o tratamento de escapes e quebras de linha em strings.
- Corrigida a resolução de caminhos explícitos `.cjy` para compilação de bibliotecas.
- Atualizada a versão do CLI e do pacote para 1.4.1.

## 1.4.0 — Major release
- **Parser rewrite**: substituição completa do transpilador regex-based por pipeline Lexer → AST → Codegen
  - `src/lexer.js`: tokenizador completo com suporte a strings, template strings, comentários de bloco, todos os operadores
  - `src/parser.js`: Pratt parser com suporte a todas as construções da linguagem (fn, class, if/elif/else, for/while, try/catch, import/export, destroy, as, private, new, await)
  - `src/codegen.js`: emissor de JS a partir da AST; inferência automática de `async` via `containsAwait`
- **VS Code extension** em `vscode-extension/`:
  - Syntax highlighting via TextMate grammar (keywords, strings, números, operadores, classes, Self, builtins)
  - Snippets: `fn`, `sfn`, `var`, `const`, `if`, `ife`, `for`, `while`, `class`, `imp`, `impb`, `try`, `print`
  - File icon `.cjy`
  - Auto-closing de `{}`, `[]`, `()`, `""`, `''`
- **Better error catching**: erros de Lexer, Parse e Codegen mostrados com caixa formatada, linha/coluna e hint; runtime errors mostram stack relevante
- Mensagem de erro de lib não encontrada agora inclui dica de instalação
- README atualizado com todas as tasks marcadas como concluídas


## 1.3.2
- **FIX** Funções anônimas com `wait` agora são automaticamente marcadas como `async` — resolve "Unexpected reserved word" em handlers do Orgapp e qualquer `fn` inline que use `wait`
- Novo passo `inferAsync` no pipeline de transpile: percorre todos os blocos `function(...) {}` gerados e adiciona `async` quando o corpo contém `await`

## 1.3.1 — Bugfix release
- **FIX #1** `export`: suporte restaurado — variáveis exportadas declaradas fora do async IIFE, `export { X }` emitido no nível do módulo ES
- **FIX #2** `as` em parâmetros de função restaurado: `fn foo a as x, b as y { }` funciona novamente; `parseParams` atualizado
- **FIX #3** `resolveLib` restaurado: suporte a `main.cjy` como entry point de biblioteca, com compilação on-the-fly e cleanup de temp files
- **FIX #4** Built-ins `Bfs` e `Bexec` reintegrados ao compilador — `import Bfs from Bfs` e `import Bexec from Bexec` funcionam sem instalar
- **FIX #5** `catch varName as alias { }` restaurado no `transpileTryCatch`
- **FIX #6** Help do CLI corrigido: built-ins agora mostram `Bfs, Bexec` (não mais `http, fs, Json, exec`)
- **FIX #7** Comentários `//` não são mais processados por substituições de `and`/`or`/`not`
- **FIX #8** `cajyu init` não instala mais `serial` automaticamente (evita falha sem git); mostra dica para instalar manualmente
- `examples/builtin.cjy` atualizado para demonstrar `Bfs` e `Bexec`


## 1.3.0
- Moved all builtins (range, len, destroy, etc.) to the new `utils` library
- Only `try`/`catch` remain built into the language
- Added `++` and `--` increment/decrement operators
- Cleaner compiler with reduced built-in surface
- Version reset to 1.3.0 as a cleaner baseline

## 1.2.x
- Previous features (const, try/catch, as, destroy, CLI improvements, etc.)
