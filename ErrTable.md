# Cajyu Error Table

Complete list of all error codes in Cajyu (ERR001 – ERR040).

| Code   | Name                          | Description |
|--------|-------------------------------|-------------|
| ERR001 | Syntax error                  | General syntax error in the source code |
| ERR002 | Unexpected token              | The parser encountered a token it did not expect |
| ERR003 | Missing closing brace         | A `{` was opened but never closed with `}` |
| ERR004 | Type mismatch                 | A value does not match the declared type |
| ERR005 | Undefined variable            | A variable was used before being declared |
| ERR006 | Invalid function call         | Attempted to call something that is not a function |
| ERR007 | Missing parentheses           | Expected `(` or `)` but it was missing |
| ERR008 | Invalid import                | The import statement is malformed |
| ERR009 | Unexpected end of file        | The file ended while the parser still expected more code |
| ERR010 | Invalid operator              | An operator was used in an invalid context |
| ERR011 | Missing semicolon or block    | Expected `;` or a `{ ... }` block |
| ERR012 | Invalid type annotation       | The type after `:` is not recognized |
| ERR013 | Keyword used as identifier    | A reserved keyword was used as a variable or function name |
| ERR014 | Unterminated string           | A string was opened with `"` or `'` but never closed |
| ERR015 | Invalid number                | A numeric literal is malformed |
| ERR016 | Duplicate declaration         | A variable or function was declared more than once in the same scope |
| ERR017 | Missing return value          | A function declared to return a value did not return anything |
| ERR018 | Invalid class member          | A class contains an invalid member |
| ERR019 | Async error                   | Error related to `sync` / `wait` |
| ERR020 | Library not found             | The requested library does not exist in CajyuLibs |
| ERR021 | Division by zero              | Attempted to divide by zero |
| ERR022 | Index out of range            | Array or string index is outside valid bounds |
| ERR023 | Invalid argument count        | A function was called with the wrong number of arguments |
| ERR024 | Cannot call non-function      | Tried to call a value that is not callable |
| ERR025 | Missing property              | Tried to access a property that does not exist |
| ERR026 | Circular import               | An import cycle was detected |
| ERR027 | Invalid range                 | `range()` received invalid arguments |
| ERR028 | File not found                | A file operation targeted a non-existent file |
| ERR029 | Permission denied             | The process does not have permission to access a resource |
| ERR030 | Network error                 | A network request failed |
| ERR031 | JSON parse error              | Failed to parse a JSON string |
| ERR032 | Timeout                       | An operation took too long and timed out |
| ERR033 | Invalid assignment            | Tried to assign to something that cannot be assigned |
| ERR034 | Break outside loop            | `break` was used outside of a loop |
| ERR035 | Continue outside loop         | `continue` was used outside of a loop |
| ERR036 | Invalid class inheritance     | Class inheritance is malformed |
| ERR037 | Abstract method not implemented | An abstract method was not implemented |
| ERR038 | Stack overflow                | The call stack exceeded its limit |
| ERR039 | Memory limit exceeded         | The program used too much memory |
| ERR040 | Unknown builtin               | Called a builtin function that does not exist |

All errors follow the format:

```
There is an <error name> in line <n>: ERR0xx.
    <line content>
   ^
```

## Added in 1.2.2

| Code   | Name                    | Description                                      |
|--------|-------------------------|--------------------------------------------------|
| ERR021 | Invalid alias           | `as` used in an invalid context                  |
| ERR022 | Invalid try/catch       | Malformed `try`/`catch` block                    |
| ERR023 | Invalid export          | `export` used incorrectly                        |
| ERR024 | Invalid const assignment| Attempt to reassign an immutable `const`         |
| ERR025 | Invalid destroy usage   | `destroy()` called on a non-object/non-array     |
| ERR026 | Built-in library error  | Error inside a built-in library (`http`, `fs`…)  |
| ERR027 | Invalid library entry   | Library's `main.cjy` could not be transpiled     |
| ERR028 | Invalid module export   | Module does not export the expected symbol       |
| ERR029 | Invalid as target       | Alias target conflicts with an existing name     |
| ERR030 | Unexpected keyword      | Reserved keyword used where not allowed          |
| ERR031 | Invalid range arguments | Wrong argument count or type for `range()`       |
| ERR032 | Invalid parameter       | Function parameter syntax is malformed           |
| ERR033 | Circular import         | Two modules import each other                    |
| ERR034 | Missing main script     | `cajyu.json` `mainScript` file not found         |
| ERR035 | Script execution error  | Runtime error in the transpiled script           |
| ERR036 | Unsupported feature     | Feature not yet implemented                      |
| ERR037 | Invalid catch variable  | `catch` variable was not declared with `try`     |
| ERR038 | Duplicate alias         | Same `as` alias used more than once in scope     |
| ERR039 | Invalid spread          | `destroy()` argument cannot be spread            |
| ERR040 | Permission denied       | File/system operation not permitted              |
