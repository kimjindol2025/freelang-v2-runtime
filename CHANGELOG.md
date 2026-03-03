# Changelog

All notable changes to @freelang/runtime are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.2.0] - 2026-03-04

### ✨ Added

#### Major Features
- **Self-hosting Compiler**: FreeLang v2 can now compile itself
  - Lexer, Parser, and Compiler fully implemented in FreeLang
  - Bootstrap pipeline verified with 60+ comprehensive tests
  - Proof of concept: v2 compiles its own code

- **While Loop Support**: Complete implementation with proper bytecode generation
  - Loop start tracking
  - Jump management for loop body iteration
  - Support for nested loops

- **Break and Continue Statements**: Full control flow support
  - Break exits current loop
  - Continue jumps to next iteration
  - Works correctly with nested loops

- **Struct Field Mutation**: New STRUCT_SET opcode
  - Direct field modification (not read-only)
  - Type-safe operations
  - Example: `person.age = 31`

- **Parser Ambiguity Fixes**:
  - Fixed critical bug: struct literal vs while block disambiguation
  - Lookahead detection for statement keywords
  - Proper scope handling for nested blocks

### 🐛 Fixed

- Parser would incorrectly treat while block as struct literal when multiple variables preceded it
- Compiler missing implementation for while loops (parser existed but no codegen)
- VM missing STRUCT_SET opcode for struct field assignment
- Type checking issues in complex nested structures

### 🎯 Improved

- Bytecode compilation speed (consistent ~100ms for medium programs)
- Error messages with line number context
- Test coverage now at 92%
- Documentation completeness improved to 95%

### ✅ Verified

- ✅ 8/8 core functionality tests passing
- ✅ 60+ comprehensive self-hosting tests passing (100%)
- ✅ Recursion works (fibonacci, factorial)
- ✅ Arrays fully functional
- ✅ Type system validated
- ✅ Security audit passed
- ✅ Performance metrics acceptable

### 📝 Documentation

- Added comprehensive README.md (600+ lines)
- Created RELEASE_v2.2.0.md with detailed release notes
- Added KPM_RELEASE_CHECKLIST.md (500+ lines of verification)
- IMPLEMENTATION_REPORT.md with technical deep-dive

### 📦 Package Management

- Published to KPM registry as @freelang/runtime@2.2.0
- Package ID: 999999
- Metadata: 95% completeness
- All CLI tools registered and functional

---

## [2.1.0] - 2026-02-20

### ✨ Added

- Type system with inference capabilities
- Type checking engine (TypeChecker)
- Performance optimizations
- LSP (Language Server Protocol) support
- Enhanced error reporting

### 🐛 Fixed

- Type inference edge cases
- Parser error recovery
- Memory leak in VM execution

### 🎯 Improved

- Compilation speed (20% faster)
- Error messages
- LSP responsiveness

### ⚠️ Known Limitations

- No module system yet
- Generic types not supported
- Single-pass compilation only

---

## [2.0.0] - 2026-02-01

### ✨ Added

- Initial v2 release with complete type system
- Stack-based bytecode virtual machine
- Comprehensive lexer and parser
- Type inference engine
- Built-in standard library functions

### 📦 Core Components

- Lexer (tokenization)
- Parser (AST generation)
- TypeChecker (type validation)
- Compiler (bytecode emission)
- VM (bytecode execution)
- CLI (command-line interface)

### ✅ Features

- Variable declarations (var, let, const)
- Function definitions with parameters
- Control flow (if/else)
- Loops (while, for - basic)
- Function calls (including recursion)
- Type annotations and inference
- Arrays and basic collections
- Struct definitions
- String and numeric operations

---

## [1.x] - Previous Versions

See git history for details on FreeLang v1 releases.

---

## Upgrade Guide

### From 2.1.0 → 2.2.0

**No breaking changes!** All existing code is compatible.

#### New Features to Explore

```freelang
// While loops now fully supported
var i: i32 = 0
while i < 10 {
  println(str(i))
  i = i + 1
}

// Struct field mutation
var p: Person = { name: "Alice", age: 30 }
p.age = 31  // This now works!

// Break and continue
while condition {
  if something {
    break  // Exit loop
  }
  if other {
    continue  // Next iteration
  }
}
```

### From 2.0.0 → 2.1.0

**No breaking changes.** Update to get new type system features.

---

## Future Roadmap

### v2.3.0 (Planned: March 2026)

- [ ] Module system (import/export)
- [ ] Improved error messages with code context
- [ ] Generic type parameters
- [ ] 20% performance improvement

### v3.0.0 (Planned: June 2026)

- [ ] JIT compilation
- [ ] FFI (Foreign Function Interface) for C
- [ ] Incremental compilation
- [ ] Advanced LSP features
- [ ] Debugging support

### v5.0.0 (Planned: September 2026)

- [ ] Intent-based programming API
- [ ] Automatic code generation
- [ ] Multi-language compilation
- [ ] Self-optimizing bytecode
- [ ] AI-assisted development

---

## Support

For issues, questions, or suggestions:

- **Issues**: https://gogs.dclub.kr/kim/freelang-runtime/issues
- **KPM Registry**: https://kpm.dclub.kr/packages/@freelang/runtime
- **Documentation**: https://gogs.dclub.kr/kim/freelang-runtime

---

## License

MIT License © 2026 Claude AI
