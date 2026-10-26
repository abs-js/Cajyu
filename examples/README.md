# Examples

Only one example. It uses **installed libraries** (no built-ins).

## Math API

File: `math-api.cjy`

Creates a small HTTP API that receives two numbers and returns sum, subtraction, multiplication and division.

### Setup

```bash
cajyu inst http
cajyu inst serial
cajyu inst math
```

### Run

```bash
cajyu run examples/math-api.cjy
```

### Test

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"a": 10, "b": 2}'
```
