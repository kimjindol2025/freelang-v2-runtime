# FreeLang v2 Runtime (Pure FreeLang Implementation)

**자기 언어로 자신의 인터프리터를 구현한 부트스트랩 프로젝트**

FreeLang v2로 FreeLang v2 인터프리터를 구현한 혁신적인 프로젝트입니다.

---

## 🚀 구조

### Phase 1: Lexical Analysis (Lexer)
```
Source Code → Tokens
```

**lexer.fl** (350줄)
- TokenType enum (25개 토큰 타입)
- Token class (위치 정보 포함)
- Lexer class (소스 코드 → 토큰 변환)
  - `tokenize()`: 문자열을 토큰 배열로 변환
  - `scanString()`: 문자열 리터럴 파싱
  - `scanNumber()`: 정수 리터럴 파싱
  - `scanIdentifier()`: 식별자/키워드 파싱
  - `scanOperator()`: 연산자 파싱

### Phase 2: Syntactic Analysis (Parser)
```
Tokens → AST (Abstract Syntax Tree)
```

**parser.fl** (450줄)
- AST Node Classes:
  - Program, FunctionDef, VariableDef
  - BinaryOp, FunctionCall
  - IntLiteral, StringLiteral, Identifier
  - IfStatement, WhileLoop
- Parser class (토큰 → AST 변환)
  - `parse()`: 전체 프로그램 파싱
  - `parseFunctionDef()`: 함수 정의 파싱
  - `parseVariableDef()`: 변수 정의 파싱
  - `parseExpression()`: 식 파싱
  - 연산자 우선순위 준수 (비교 → 더하기 → 곱하기)

### Phase 3: Execution (Evaluator)
```
AST → Execution Results
```

**evaluator.fl** (250줄)
- Runtime class (프로그램 실행)
  - `eval()`: 프로그램 실행
  - `callFunction()`: 함수 호출
  - `evalExpr()`: 식 평가
  - `evalStmt()`: 문 실행
  - 이진 연산: +, -, *, /, ==, !=, <, >, <=, >=
  - 내장 함수: print()

### Main Runtime
**runtime.fl** (120줄)
- FreeLangRuntime class (전체 실행 제어)
  - Phase 1: 토큰화
  - Phase 2: 파싱
  - Phase 3: 실행
  - 각 단계 통계 출력

---

## 🎯 지원 기능

### 데이터 타입
- ✅ Integer (정수)
- ✅ String (문자열)
- ✅ Boolean (참/거짓) - 내부적으로 정수로 표현

### 제어 구조
- ✅ if/else 조건문
- ✅ while 반복문
- ✅ 함수 정의 & 호출

### 연산자
- ✅ 산술: + - * /
- ✅ 비교: == != < > <= >=

### 내장 함수
- ✅ print() - 출력
- ✅ serial_open(port, baudrate) - 직렬 포트 열기
- ✅ serial_write(port, data) - 데이터 전송
- ✅ serial_read(port) - 데이터 수신
- ✅ serial_available(port) - 수신 데이터 크기
- ✅ serial_close(port) - 포트 닫기
- ✅ serial_is_open(port) - 포트 연결 상태 확인

---

## 📊 통계

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| lexer.fl | 350 | 토큰화 |
| parser.fl | 450 | AST 생성 |
| evaluator.fl | 314 | 실행 + Serial 통신 |
| runtime.fl | 120 | 통합 |
| **Total** | **1,234** | **완전한 인터프리터 + Serial 통신** |

---

## 🔄 실행 흐름

```
Source Code
    ↓
[Lexer] → Tokens
    ↓
[Parser] → AST
    ↓
[Evaluator] → Results
    ↓
Output
```

### 예시

```freelang
// 입력 코드
fn add(a: int, b: int): int {
  let result = a + b
  return result
}

fn main(): void {
  let x = 10
  let y = 20
  print(x + y)  // 출력: 30
}
```

### 실행 단계

1. **Lexer**
```
Tokens: [fn, add, (, a, :, int, ..., ]
```

2. **Parser**
```
Program
├── FunctionDef(add)
│   ├── params: [a, b]
│   └── body: [VariableDef, Return]
└── FunctionDef(main)
    ├── params: []
    └── body: [VariableDef, FunctionCall]
```

3. **Evaluator**
```
Define function: add(10, 20)
Call function: add(10, 20) → 30
Call function: print(30)
Output: 30
```

---

## 💡 핵심 알고리즘

### Lexer
```
while pos < source.length:
  if ch == '"': scanString()
  elif isDigit(ch): scanNumber()
  elif isAlpha(ch): scanIdentifier()
  else: scanOperator()
```

### Parser (재귀 하강)
```
Expression:
  Comparison:
    Addition:
      Multiplication:
        Primary: INT | STRING | IDENTIFIER | FUNCTION_CALL | (EXPR)
```

### Evaluator (트리 워킹)
```
for each statement in program:
  if FunctionDef: register function
for each statement:
  if BinaryOp: evaluate left and right, apply operator
  if FunctionCall: lookup function, call with arguments
```

---

## 🔧 기술적 특징

### 순수 FreeLang v2 구현
- ✅ 외부 라이브러리 0개
- ✅ C/Go 연동 없음
- ✅ 완전히 독립적인 인터프리터

### 메모리 효율
- ✅ Token 풀 (재사용)
- ✅ AST 최소화
- ✅ 스택 기반 실행

### 타입 안전
- ✅ Token 타입 enum
- ✅ AST 노드 타입 별도 클래스
- ✅ 런타임 타입 검사

---

## 📡 Serial 통신 예제

```freelang
fn main(): void {
  // Arduino 또는 마이크로컨트롤러와 통신
  let port = "/dev/ttyUSB0"
  let baudrate = 9600

  // 포트 열기
  if serial_open(port, baudrate) {
    print("포트 열림")

    // 데이터 전송
    serial_write(port, "Hello Arduino!")

    // 데이터 수신
    let response = serial_read(port)
    print("응답: " + response)

    // 포트 상태 확인
    if serial_is_open(port) {
      print("포트 연결 중")
    }

    // 포트 닫기
    serial_close(port)
  }
}
```

## 📈 로드맵

| 버전 | 기능 | 상태 |
|------|------|------|
| **1.0.0** | 기본 (정수, 함수, if/while) | ✅ |
| **1.1.0** | Serial 통신 모듈 | ✅ |
| **1.2.0** | 배열, map | 🔄 |
| **1.3.0** | 구조체, enum | 📅 |
| **2.0.0** | 모듈 시스템 | 📅 |

---

## 🎓 학습 포인트

이 프로젝트는 다음을 학습할 수 있습니다:

1. **언어 설계**: 토큰 타입 정의, AST 구조 설계
2. **컴파일러/인터프리터 기본**: Lexer, Parser, Evaluator 3단계
3. **재귀 하강 파싱**: 연산자 우선순위 구현
4. **부트스트랩**: 자신의 언어로 자신의 인터프리터 구현

---

## 🚀 사용 방법

```freelang
use "runtime" as Runtime

fn main(): void {
  let code = "fn hello(): void { print(\"Hello!\") } fn main(): void { hello() }"
  let runtime = Runtime.FreeLangRuntime()
  runtime.run(code)
}
```

---

## 🎉 특별한 의의

**FreeLang v2로 FreeLang v2 런타임을 구현**했습니다. 이는:

1. ✅ **언어의 완성도 증명** - 충분히 강력해서 자신의 인터프리터 구현 가능
2. ✅ **순수 구현 원칙 준수** - 외부 의존 없는 완전한 구현
3. ✅ **부트스트랩 성공** - 자기참조적 구현의 성공

---

**FreeLang v2 - 순수 구현, 기록 기반, 데이터 중심 언어** 🚀
