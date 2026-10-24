# Comparison: JavaScript vs TypeScript vs Cajyu

Three identical features implemented in three languages.

## 1. Simple HTML Server

| Language   | File                              | Lines (approx) | Notes |
|------------|-----------------------------------|----------------|-------|
| JavaScript | `js/simple-server.js`            | 18             | Direct `http` module |
| TypeScript | `ts/simple-server.ts`            | 18             | Same + types |
| Cajyu      | `cajyu/simple-server.cjy`        | 10             | Uses `CajyuLibs.http` |

**Cajyu is the shortest.** The HTTP library abstracts the boilerplate.

## 2. Click Counter

| Language   | File                              | Lines (approx) | Notes |
|------------|-----------------------------------|----------------|-------|
| JavaScript | `js/click-counter.js`            | 35             | Manual route + inline HTML/JS |
| TypeScript | `ts/click-counter.ts`            | 35             | Same + types |
| Cajyu      | `cajyu/click-counter.cjy`        | 16             | `server.post` + `server.file` |

Again, Cajyu is more concise because of the built-in server abstraction.

## 3. Live Chat (WebSocket)

| Language   | File                              | Lines (approx) | Notes |
|------------|-----------------------------------|----------------|-------|
| JavaScript | `js/live-chat.js`                | 45             | Uses `ws` package + full HTML |
| TypeScript | `ts/live-chat.ts`                | 45             | Same + types |
| Cajyu      | `cajyu/live-chat.cjy`            | 12             | Uses `CajyuLibs.websocket` (broadcast only) |

Cajyu version is shorter but currently only shows the WebSocket server side.

## Summary

| Aspect              | JavaScript      | TypeScript       | Cajyu                  |
|---------------------|-----------------|------------------|------------------------|
| Boilerplate         | Medium          | Medium           | Low                    |
| Type safety         | None            | Strong           | Optional runtime       |
| Learning curve      | Low             | Medium           | Low (if you know JS)   |
| Ecosystem           | Huge            | Huge             | Small (growing)        |
| Abstraction level   | Low-medium      | Low-medium       | Higher                 |
| Best for            | Production      | Large projects   | Prototyping / learning |

**Conclusion:**
- **JavaScript** is the baseline.
- **TypeScript** adds safety with almost no extra cost.
- **Cajyu** reduces boilerplate the most, especially for servers, but is still a prototype language.

All examples are in `examples/comparison/`.
