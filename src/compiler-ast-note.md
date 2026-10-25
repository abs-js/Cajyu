# AST Migration in progress

The compiler now has a real Tokenizer + recursive descent Parser that builds an AST.

Current status:
- Tokenizer handles strings, numbers, identifiers, keywords correctly
- Parser builds AST for var, fn, if/elif/else, while, for, class, return, expressions
- Code generator emits JavaScript from the AST

Still being completed:
- Full import resolution
- Builtins (range, typeCheck)
- Async (sync/wait)
- One-liners and more edge cases

This is the foundation for a robust parser.
