# Cajyu

**A clean, practical programming language that transpiles to JavaScript.**

Cajyu gives you a simpler, more expressive syntax while staying fully compatible with the JavaScript ecosystem.

[![npm](https://img.shields.io/badge/npm-cajyu-blue)](https://www.npmjs.com/package/cajyu)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-brightgreen)](package.json)

---

## Features

- Clean syntax for variables, functions, classes, loops and conditionals
- Transpiles to modern JavaScript
- Real HTTP server with POST handlers, sleep/wake
- WebSocket that automatically sends and receives JSON
- Official libraries: `serial`, `fs`, `math`, `http`, `websocket`, `string`, `json`, `exec`, `fetch`
- Optional runtime typing
- Async with `sync fn` and `wait`
- One-liners and stacking
- CLI with flags and multiple commands

---

## Quick Start

```bash
# After publishing
npm install -g cajyu

# Or from source
node bin/cajyu.js --help
```

```bash
cajyu init
cajyu inst serial
cajyu inst http
cajyu run examples/fatorial.cjy
```

---

## CLI

```
cajyu [flags]
cajyu <command> [options]
```

| Command          | Description                          |
|------------------|--------------------------------------|
| `init`           | Create a new project                 |
| `inst <lib>`     | Install a library from CajyuLibs     |
| `run <file.cjy>` | Compile and run a file               |
| `list`           | List installed libraries             |
| `update`         | Update libraries (planned)           |

| Flag             | Description          |
|------------------|----------------------|
| `-h, --help`     | Show help            |
| `-v, --version`  | Show version         |

---

## Syntax

### Variables
```cajyu
var name = "Cajyu"
var age:Number = 17
```

### Functions
```cajyu
fn add a, b {
  return a + b
}
```

### Control flow & loops
```cajyu
if x > 10 {
  print("big")
} elif x > 5 {
  print("medium")
} else {
  print("small")
}

for i in range(10) {
  print(i)
}
```

### Classes
```cajyu
class Person {
  Main name, age {
    Self.name = name
    Self.age = age
  }
  greet {
    return "Hello, " + Self.name
  }
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

### WebSocket (JSON)
```cajyu
import WS from CajyuLibs.websocket

var wss = new WS.Server(8080)
wss.on("message", fn msg, client {
  wss.broadcast({ echo: msg })
})
```

### Exec & Fetch
```cajyu
import exec from CajyuLibs.exec
var files = exec.exec("ls -a")

import fetch from CajyuLibs.fetch
fetch.fetch("https://api.github.com", {}, null, fn result, ms {
  print(result)
})
```

---

## Libraries

Official libraries: https://github.com/abs-js/CajyuLibs

```bash
cajyu inst serial
cajyu inst fs
cajyu inst math
cajyu inst http
cajyu inst websocket
cajyu inst string
cajyu inst json
cajyu inst exec
cajyu inst fetch
```

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
