# Cajyu

<p align="center">
  <img src="https://raw.githubusercontent.com/abs-js/Cajyu/main/logos/logo-128.png" alt="Cajyu Logo" width="128">
</p>

**A clean, practical programming language that transpiles to JavaScript.**

Cajyu gives you a simpler, more expressive syntax while staying fully compatible with the JavaScript ecosystem.

[![npm](https://img.shields.io/badge/npm-cajyu-blue)](https://www.npmjs.com/package/cajyu)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.4.0-brightgreen)](package.json)

---

## Features

- Big ecosystem — official libraries for HTTP, WebSocket, SQL, auth, cache and more
- Clean syntax — less code to do the same thing
- Real parser — Lexer → AST → Codegen pipeline (no more regex-based transpilation)
- Better error messages — formatted, pointed, with hints
- VS Code extension with syntax highlighting and snippets

---

## Quick Start

```bash
npm install -g cajyu
cajyu init
cajyu run index.cjy
```

## VS Code Extension

Install from the `vscode-extension/` folder:

```bash
cd vscode-extension
npx vsce package   # generates cajyu-language-1.0.0.vsix
code --install-extension cajyu-language-1.0.0.vsix
```

Features: syntax highlighting, snippets (`fn`, `class`, `try`, `imp`…), `.cjy` file icon.

---

## CLI

```
cajyu [flags]
cajyu <command> [options]
```

| Command              | Description                                |
|----------------------|--------------------------------------------|
| `init`               | Create a new Cajyu project (`cajyu.json`)  |
| `inst <lib>`         | Install a library from CajyuLibs           |
| `remove <lib>`       | Remove an installed library                |
| `run <file.cjy>`     | Compile and run a file                     |
| `exec "<code>"`      | Run a one-liner Cajyu expression           |
| `start`              | Run `mainScript` from `cajyu.json`         |
| `list`               | List built-in and installed libraries      |
| `update [lib]`       | Update one or all installed libraries      |

| Flag             | Description          |
|------------------|----------------------|
| `-h, --help`     | Show help            |
| `-v, --version`  | Show version         |

---

## Syntax

See roadline: https://github.com/abs-js/Cajyu-Roadline/
Official libraries: https://github.com/abs-js/CajyuLibs/

---

## Built-in libraries (no install needed)

| Name    | Description                       |
|---------|-----------------------------------|
| `Bfs`   | Read, write, append, exists, remove files |
| `Bexec` | Shell command execution           |

---

## Contributing

Pull requests are welcome. Priority areas:

- More language features
- Additional libraries
- Playground / online editor

### Roadmap

- [x] Better parser (Lexer → AST → Codegen)
- [x] VS Code extension
- [x] Better error catching
- [x] Bigger ecosystem
- [ ] Online playground
- [ ] Language server (LSP)

---

## License

Check LICENSE file.
