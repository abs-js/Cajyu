# Changelog

## 1.2.3 — Bugfix release
- **FIX #1** `transpileAnonymousFunctions`: lookbehind incorreto corrigido; funções anônimas inline (`server.post(fn b { })`) agora transpiram corretamente
- **FIX #2** `transpileControlFlow`: não mais re-envolve em parênteses duplos o `if` gerado pelo try/catch
- **FIX #3** `try` com ponto-e-vírgula agora tolerante; expressão capturada com `(expr)` para melhor compatibilidade
- **FIX #4** `destroy` dentro de strings literais não é mais substituído (proteção via `replaceOutsideStrings`)
- **FIX #5** Lista de keywords protegidas de métodos de classe expandida (`switch`, `do`, `get`, `set`, `async`, etc.)
- **FIX #6** Múltiplos `import *` não mais causam colisão de `const _lib` — nome único por import
- **FIX #7** `export` agora emitido fora do `async IIFE`, no nível do módulo ES — antes sempre lançava `SyntaxError`
- **FIX #8** `_range` com step negativo não entra mais em loop infinito
- **FIX #9** Arquivos `.mjs` temporários de libs `.cjy` são limpos ao sair do processo
- **FIX #10** `cajyu run` não aceita mais nomes de comandos conhecidos como arquivo
- **FIX #11** Comentários `//` não são mais processados por substituições de operadores (`and`, `or`, `not`)
- **FIX #12** `sync fn` dentro de classe gera `async nomeMetodo()` em vez de `async function nomeMetodo()`
- **FIX #13** `cajyu init` não sobrescreve `cajyu.json` existente; aviso claro se já existir


## 1.2.2
- `const` for immutable bindings (object contents remain mutable)
- `try`/`catch` with special error sentinels (`E***`): `const x = try expr; catch x { ... }`
- `as` aliasing in imports (`import log as l from …`), catch (`catch err as e {}`), and function params (`fn foo a as x, b as y {}`)
- `destroy(obj)` to spread object values as positional arguments
- Built-in libraries (no `cajyu inst` needed): `http`, `fs`, `Json`, `exec`
- Libraries may now have a `.cjy` main entry point (transpiled automatically on import)
- Improved import: supports `as` alias, resolves `.cjy` files
- Improved export: `export X` emits a proper ES module export
- New CLI commands: `remove`, `start`, `exec`, `update`
- New project file: `cajyu.json` with `mainScript`, `links`, `dependences`, `scripts`
- `range(n)` now goes from `0` to `n-1` (Python-style)
- `len()` built-in for strings, arrays and objects
- Error codes expanded to ERR001–ERR040
- Better terminal help output

## 1.2.1
- `range`, `len`, more errors, CLI improvements

## 1.1.0
- AST-based parser foundation, logos, error table
