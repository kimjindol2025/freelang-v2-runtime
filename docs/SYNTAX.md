# FreeLang Syntax Reference

Complete syntax documentation for FreeLang v2.2.0.

---

## Table of Contents

1. [Comments](#comments)
2. [Types](#types)
3. [Variables](#variables)
4. [Functions](#functions)
5. [Control Flow](#control-flow)
6. [Operators](#operators)
7. [Data Structures](#data-structures)
8. [Built-in Functions](#built-in-functions)

---

## Comments

```freelang
// Single-line comment

/*
  Multi-line comment
  (not yet supported in v2.2.0)
*/
```

---

## Types

### Primitive Types

```freelang
var num: i32 = 42           // 32-bit integer
var decimal: f64 = 3.14     // 64-bit float
var text: string = "hello"  // String
var flag: bool = true       // Boolean
```

### Generic Types

```freelang
var numbers: [i32] = [1, 2, 3]
var strings: [string] = ["a", "b"]
var nested: [[i32]] = [[1, 2], [3, 4]]
```

### Any Type

```freelang
var x: any = 42
var y: any = "hello"
var z: any = { name: "Alice" }
```

### Custom Types (Structs)

```freelang
struct Point {
  x: i32
  y: i32
}

var p: Point = { x: 10, y: 20 }
```

---

## Variables

### Declaration

```freelang
// Mutable variable
var name: string = "Alice"

// Immutable binding
let age: i32 = 30

// Constant (not yet supported)
const PI: f64 = 3.14159
```

### Initialization

```freelang
var x: i32 = 0            // Explicit type
var result = 42           // Type inference (not yet supported)
let name: string          // Without initialization (not yet supported)
```

### Scope

```freelang
fn demo(): void {
  var x: i32 = 10

  if x > 5 {
    var y: i32 = 20  // Scoped to if block
    println(str(y))   // OK
  }
  // println(str(y))  // Error: y not in scope
}
```

---

## Functions

### Basic Function

```freelang
fn greet(name: string): void {
  println("Hello, " + name)
}
```

### Function with Return

```freelang
fn add(a: i32, b: i32) -> i32 {
  return a + b
}
```

### Multiple Parameters

```freelang
fn calculate(x: i32, y: i32, op: string) -> i32 {
  if op == "add" {
    return x + y
  }
  if op == "mul" {
    return x * y
  }
  return 0
}
```

### Recursive Function

```freelang
fn factorial(n: i32) -> i32 {
  if n <= 1 {
    return 1
  }
  return n * factorial(n - 1)
}
```

### Main Function (Entry Point)

```freelang
fn main(): void {
  println("Program starts here")
  // ... your code ...
}
```

---

## Control Flow

### If/Else

```freelang
if condition {
  // true branch
}

if condition {
  // true branch
} else {
  // false branch
}

if condition1 {
  // branch 1
} else if condition2 {
  // branch 2
} else {
  // default branch
}
```

### While Loop

```freelang
var i: i32 = 0
while i < 10 {
  println(str(i))
  i = i + 1
}
```

### Break Statement

```freelang
var count: i32 = 0
while true {
  if count == 10 {
    break  // Exit loop
  }
  count = count + 1
}
```

### Continue Statement

```freelang
var i: i32 = 0
while i < 10 {
  i = i + 1
  if i == 5 {
    continue  // Skip to next iteration
  }
  println(str(i))
}
```

### Nested Loops

```freelang
var i: i32 = 0
while i < 3 {
  var j: i32 = 0
  while j < 3 {
    println(str(i) + "," + str(j))
    j = j + 1
  }
  i = i + 1
}
```

---

## Operators

### Arithmetic

```freelang
10 + 5   // Addition: 15
10 - 5   // Subtraction: 5
10 * 5   // Multiplication: 50
10 / 5   // Division: 2
10 % 3   // Modulo: 1
```

### Comparison

```freelang
10 == 10  // Equals: true
10 != 20  // Not equals: true
10 > 5    // Greater than: true
10 < 20   // Less than: true
10 >= 10  // Greater or equal: true
10 <= 20  // Less or equal: true
```

### Logical

```freelang
true && false   // AND: false
true || false   // OR: true
!true          // NOT: false
```

### String

```freelang
"Hello" + " " + "World"  // Concatenation: "Hello World"
```

### Assignment

```freelang
x = 10         // Simple assignment
x = y + 5      // Expression assignment
```

---

## Data Structures

### Arrays

```freelang
// Array literal
var arr: [i32] = [1, 2, 3, 4, 5]

// Empty array (not yet supported)
var empty: [i32] = []

// Array access
var first: i32 = arr[0]

// Array assignment
arr[0] = 10

// String arrays
var words: [string] = ["Hello", "World"]
```

### Structs

```freelang
// Definition
struct Person {
  name: string
  age: i32
  city: string
}

// Instantiation
var person: Person = {
  name: "Alice",
  age: 30,
  city: "New York"
}

// Field access
var age: i32 = person.age
var name: string = person.name

// Field mutation (v2.2.0)
person.age = 31
person.city = "San Francisco"
```

### Nested Structs

```freelang
struct Address {
  street: string
  city: string
}

struct Employee {
  name: string
  address: Address
}

var emp: Employee = {
  name: "Bob",
  address: { street: "Main St", city: "NYC" }
}

var city: string = emp.address.city
```

---

## Built-in Functions

### I/O Functions

```freelang
println(msg: any) -> void   // Print with newline
print(msg: any) -> void     // Print without newline
```

### Type Conversion

```freelang
str(x: any) -> string       // Convert to string
i32(x: string) -> i32       // Convert string to integer
f64(x: string) -> f64       // Convert string to float
```

### String Functions

```freelang
length(s: string) -> i32
char_at(s: string, idx: i32) -> string
contains(s: string, sub: string) -> bool
split(s: string, sep: string) -> [string]
to_upper(s: string) -> string
to_lower(s: string) -> string
starts_with(s: string, prefix: string) -> bool
ends_with(s: string, suffix: string) -> bool
replace(s: string, old: string, new: string) -> string
```

### Array Functions

```freelang
length(arr: [T]) -> i32
push(arr: [T], val: T) -> void
pop(arr: [T]) -> T
slice(arr: [T], start: i32, end: i32) -> [T]
```

---

## Examples

### Complete Program

```freelang
struct Person {
  name: string
  age: i32
}

fn greet(p: Person): void {
  println("Hello, " + p.name + "!")
  println("Age: " + str(p.age))
}

fn main(): void {
  var person: Person = { name: "Alice", age: 30 }
  greet(person)

  var i: i32 = 0
  while i < 3 {
    println("Count: " + str(i))
    i = i + 1
  }
}
```

### Complex Recursion

```freelang
fn fibonacci(n: i32) -> i32 {
  if n <= 1 {
    return n
  }
  return fibonacci(n - 1) + fibonacci(n - 2)
}

fn main(): void {
  var i: i32 = 0
  while i < 10 {
    println("fib(" + str(i) + ") = " + str(fibonacci(i)))
    i = i + 1
  }
}
```

---

## Reserved Keywords

```
fn      if      else    while   break   continue
var     let     const   return  struct  true    false
```

---

## Limitations in v2.2.0

- ❌ No generic types (e.g., `fn id<T>(x: T) -> T`)
- ❌ No module system (import/export)
- ❌ No pattern matching
- ❌ No closures
- ❌ No async/await
- ❌ No error handling (try/catch)

These are planned for future releases.

---

## See Also

- [Language Guide](../README.md#-language-guide)
- [API Reference](./API.md)
- [Examples](../examples/)
