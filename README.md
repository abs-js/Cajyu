# Cajyu

<p align="center">
  <img src="https://raw.githubusercontent.com/abs-js/Cajyu/main/logos/logo-128.png" alt="Cajyu Logo" width="128">
</p>

**A clean, practical programming language that transpiles to JavaScript.**

Cajyu gives you a simpler, more expressive syntax while staying fully compatible with the JavaScript ecosystem.

[![npm](https://img.shields.io/badge/npm-cajyu-blue)](https://www.npmjs.com/package/cajyu)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.3.2-brightgreen)](package.json)

---

## Features

- Big ecosystem
- Clean syntax
- Less code to do same thing

---

## Quick Start

```bash
npm install -g cajyu
cajyu init

cajyu run index.cjy
```

```bash
# Or using npx
npx cajyu -v
```

NOTE: maybe index.cjy has an bug, so fix it if:
1. Install serial with ´npx cajyu inst serial´.
2. import it with ´import print from CajyuLibs.serial´ in top of file.


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

## Project file: `cajyu.json`

`cajyu init` generates a `cajyu.json` (instead of `package.json`) that Cajyu projects use:

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "description": "",
  "mainScript": "index.cjy",
  "links": {},
  "dependences": {},
  "scripts": {
    "start": "cajyu run index.cjy"
  },
  "type": "module"
}
```

Run the project entry point with `cajyu start`.

---

## Syntax

See roadline: https://github.com/abs-js/Cajyu-Roadline/
Official libraries: https://github.com/abs-js/CajyuLibs/

---

## Contributing

Pull requests are welcome. Priority areas:

- A proper parser (current one is regex-based)
- More language features
- Additional libraries

### Next features

- [ ] Bigger ecosystem
- [x] Better parser
- [ ] VS code extension
- [ ] Better error catching

---

## License

Check LICENSE file.
