# Changelog

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
