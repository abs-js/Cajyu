# Cajyu

**A clean, practical programming language that transpiles to JavaScript.**

Cajyu is designed for people who want a simpler syntax without leaving the JavaScript ecosystem. Write expressive code, get real JavaScript output, and use a growing set of official libraries.

[![npm](https://img.shields.io/badge/npm-cajyu-blue)](https://www.npmjs.com/package/cajyu)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Features

- **Familiar yet cleaner syntax** — variables, functions, classes, control flow, and loops that feel natural
- **Transpiles to modern JavaScript** — runs anywhere Node.js runs
- **Real HTTP server** — built-in `Server` class with POST handlers, sleep/wake, and static files
- **Official libraries** — `serial`, `fs`, `math`, `http` (and more coming)
- **Optional typing** — runtime type checks with `var x:Number = 10`
- **Async support** — `sync fn` and `wait`
- **One-liners & stacking** — concise style when you want it
- **CLI** — `cajyu init`, `cajyu inst`, `cajyu run`

---

## Quick Start

```bash
# Install the CLI (once published)
npm install -g cajyu

# Or run directly from this repo
node bin/cajyu.js --help
```

Create a new project:

```bash
cajyu init
```

Run a file:

```bash
cajyu run examples/fatorial.cjy
```

---

## Syntax Overview

### Variables
```cajyu
var name = "Cajyu"
var age:Number = 17
var items = [1, 2, 3]
```

### Functions
```cajyu
fn add a, b {
  return a + b
}

fn double x {
  return x * 2
}
```

### Control Flow
```cajyu
if x > 10 {
  print("big")
} elif x > 5 {
  print("medium")
} else {
  print("small")
}
```

### Loops
```cajyu
for i in range(10) {
  print(i)
}

while x < 100 {
  x = x * 2
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
    return "Hello, I'm " + Self.name
  }
}

var p = new Person("Ana", 17)
print(p.greet())
```

### Async
```cajyu
sync fn fetchData {
  wait someAsyncCall()
  return result
}
```

### HTTP Server
```cajyu
import Server from CajyuLibs.http
import print from CajyuLibs.serial

var server = new Server(3000)

server.post(fn b {
  if !b.a and !b.b {
    return { code: 400 }
  }
  return {
    code: 200,
    result: b.a + b.b
  }
})
```

---

## Libraries

Official libraries live in the [CajyuLibs](https://github.com/abs-js/CajyuLibs) repository.

Install a library:

```bash
cajyu inst serial
cajyu inst http
```

Import in your code:

```cajyu
import print from CajyuLibs.serial
import Server from CajyuLibs.http
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `cajyu init` | Create a new project (`package.json` + structure) |
| `cajyu inst <name>` | Install a library from CajyuLibs |
| `cajyu run <file.cjy>` | Compile and run a Cajyu file |

---

## Project Structure

```
Cajyu/
├── bin/cajyu.js          # CLI entry point
├── src/compiler.js       # Transpiler
├── examples/             # Working examples
│   ├── fatorial.cjy
│   ├── classe.cjy
│   └── servidor-post.cjy
└── package.json
```

---

## Contributing

Cajyu is early but intentional. Pull requests are welcome — especially for:

- A proper parser (currently regex-based)
- More language features
- New official libraries
- Better error messages

---

## License

MIT

---

**Built for people who like clean code and real results.**
