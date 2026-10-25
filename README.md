# Cajyu

<p align="center">
  <img src="https://raw.githubusercontent.com/abs-js/Cajyu/main/logos/logo-128.png" alt="Cajyu Logo" width="128">
</p>

**A clean, practical programming language that transpiles to JavaScript.**

Cajyu gives you a simpler, more expressive syntax while staying fully compatible with the JavaScript ecosystem.

[![npm](https://img.shields.io/badge/npm-cajyu-blue)](https://www.npmjs.com/package/cajyu)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.3-brightgreen)](package.json)

---

## Features

- Clean syntax for variables, functions, classes, loops and conditionals
- Transpiles to modern JavaScript
- Real HTTP server with POST handlers, sleep/wake
- WebSocket that automatically sends and receives JSON
- Libraries can have a `.cjy` main entry point
- Optional runtime typing
- One-liners and stacking
- CLI with flags and multiple commands

---

## Quick Start

```bash
npm install -g cajyu

cajyu init
cajyu run index.cjy
```

```bash
# Or from source
node bin/cajyu.js --help
```

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

### Variables

```cajyu
var name = "Cajyu"
var age:Number = 17

// const → immutable binding; object contents can still be added to
const PI = 3.14159
const config = { debug: false }
config.debug = true   // OK — object mutation is allowed
// PI = 3            // ← runtime error
```

### Functions

```cajyu
fn add a, b {
  return a + b
}

// as: rename a parameter inside the function body
fn greet name as n, lang as l {
  if l == "pt" return "Olá, " + n
  return "Hello, " + n
}
```

### Imports & exports

```cajyu
// Simple import
import fs from CajyuLibs.fs

// Alias: use `l` instead of `log` in this file
import log as l from utils

// Export
export myFunction
```

### Built-in libraries (no `cajyu inst` needed, but has less things)

```cajyu
import fs   from fs
import exec from exec
```

### try / catch

```cajyu
// const result = try <expr> — result is E*** on error, value on success
const result = try divide(10, 0);

catch result {
  // executed only if result is an error sentinel
  print("Division failed: " + result)
}

// catch with alias
const data = try Json.parse(raw);
catch data as e {
  print("Parse error: " + e)
}

// works in if too
if result {
  print("got: " + result)
}
```

Error sentinels can be compared but are **not** strings — they carry an `E***` code and a message.

### as — aliasing

`as` works in three places:

| Context               | Example                                     |
|-----------------------|---------------------------------------------|
| Import alias          | `import log as l from utils`                |
| Catch variable alias  | `catch err as e { ... }`                    |
| Function param alias  | `fn foo a as x, b as y { uses x and y }`   |

### destroy — spread object as arguments

```cajyu
var obj = { a: 2, b: 4 }
fn add a, b { return a + b }

var result = add(destroy(obj))   // → 6
// destroy also works with arrays
```

`destroy(x)` spreads `x`'s values as positional arguments. If `x` is an array it spreads it directly.

### Control flow & loops

```cajyu
if x > 10 {
  print("big")
} elif x > 5 {
  print("medium")
} else {
  print("small")
}

for i in range(10) {   // range(n) → 0 to n-1
  print(i)
}

for i in range(1, 5) { print(i) }        // 1 to 5
for i in range(0, 10, 2) { print(i) }   // 0, 2, 4 …
```

### Classes

```cajyu
class Person {
  Main name, age {
    Self.name = name
    Self.age  = age
  }
  greet {
    return "Hello, " + Self.name
  }
}
```

### Async

```cajyu
sync fn fetchData url {
  var res = wait fetch(url)
  return res
}
```

### HTTP

```cajyu
import Server from CajyuLibs.http

var server = new Server(3000)

server.post(fn b {
  if !b.a and !b.b {
    return { code: 400 }
  }
  return { code: 200, result: b.a + b.b }
})
```

### Exec & Fetch

```cajyu
import exec from exec
var files = exec.exec("ls -a")

import fetch from CajyuLibs.fetch
fetch.fetch("https://api.github.com", {}, null, fn result, ms {
  print(result)
})
```

---

## Libraries

### Built-in (always available, no install)

| Name   | Description                     |
|--------|---------------------------------|
| `fs`   | Node.js filesystem (`fs`), but there is more things in installed lib  |
| `exec` | Shell command execution         |

### External (install with `cajyu inst`)

```bash
cajyu inst serial
cajyu inst math
cajyu inst websocket
cajyu inst string
cajyu inst fetch
```

Official libraries: https://github.com/abs-js/CajyuLibs

Libraries may ship a `main.cjy` entry point — Cajyu will transpile it automatically when imported.

---

## Contributing

Pull requests are welcome. Priority areas:

- A proper parser (current one is regex-based)
- More language features
- Additional libraries
- Better error messages

---

## License

MIT
