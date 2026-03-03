/**
 * FreeLang v2 Token Types (v1 base + Phase 5 extensions)
 *
 * v1에서 복사된 기본 토큰 타입들 + minimal .free 포맷용 3개 토큰 추가
 */
export enum TokenType {
  // Keywords (30개 - v1 기본 + Phase 4 추가 1개)
  FN = 'FN',
  LET = 'LET',
  CONST = 'CONST',
  IF = 'IF',
  ELSE = 'ELSE',
  MATCH = 'MATCH',
  FOR = 'FOR',
  WHILE = 'WHILE',
  LOOP = 'LOOP',
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
  RETURN = 'RETURN',
  ASYNC = 'ASYNC',
  AWAIT = 'AWAIT',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  FROM = 'FROM',  // Phase 4: Module System - from keyword for imports
  STRUCT = 'STRUCT',
  ENUM = 'ENUM',
  TRAIT = 'TRAIT',
  TYPE = 'TYPE',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  NULL = 'NULL',
  IN = 'IN',
  OF = 'OF',  // Phase 2: for...of loop support
  AS = 'AS',
  IS = 'IS',
  PUB = 'PUB',
  MUT = 'MUT',
  SELF = 'SELF',
  SUPER = 'SUPER',
  IMPL = 'IMPL',

  // Phase 5 minimal .free 포맷 토큰 (3개 추가)
  INPUT = 'INPUT',       // input: 타입 정의
  OUTPUT = 'OUTPUT',     // output: 타입 정의
  INTENT = 'INTENT',     // intent: 의도 정의

  // Identifiers & Literals
  IDENT = 'IDENT',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  CHAR = 'CHAR',

  // Operators
  PLUS = 'PLUS',           // +
  MINUS = 'MINUS',         // -
  STAR = 'STAR',           // *
  SLASH = 'SLASH',         // /
  PERCENT = 'PERCENT',     // %
  POWER = 'POWER',         // **

  EQ = 'EQ',               // ==
  NE = 'NE',               // !=
  LT = 'LT',               // <
  GT = 'GT',               // >
  LE = 'LE',               // <=
  GE = 'GE',               // >=

  AND = 'AND',             // &&
  OR = 'OR',               // ||
  NOT = 'NOT',             // !

  BIT_AND = 'BIT_AND',     // &
  BIT_OR = 'BIT_OR',       // |
  BIT_XOR = 'BIT_XOR',     // ^
  BIT_NOT = 'BIT_NOT',     // ~
  SHL = 'SHL',             // <<
  SHR = 'SHR',             // >>

  ASSIGN = 'ASSIGN',       // =
  PLUS_ASSIGN = 'PLUS_ASSIGN',     // +=
  MINUS_ASSIGN = 'MINUS_ASSIGN',   // -=
  STAR_ASSIGN = 'STAR_ASSIGN',     // *=
  SLASH_ASSIGN = 'SLASH_ASSIGN',   // /=
  PERCENT_ASSIGN = 'PERCENT_ASSIGN', // %=

  RANGE = 'RANGE',         // ..
  RANGE_INC = 'RANGE_INC', // ..=

  DOT = 'DOT',             // .
  COLON_COLON = 'COLON_COLON', // ::
  QUESTION = 'QUESTION',   // ?
  PIPE_GT = 'PIPE_GT',     // |>

  // Delimiters
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }
  COMMA = 'COMMA',         // ,
  SEMICOLON = 'SEMICOLON', // ;
  COLON = 'COLON',         // :
  ARROW = 'ARROW',         // ->
  FAT_ARROW = 'FAT_ARROW', // =>
  AT = 'AT',               // @
  HASH = 'HASH',           // #

  // Special
  EOF = 'EOF',
  NEWLINE = 'NEWLINE',
  COMMENT = 'COMMENT',
  ILLEGAL = 'ILLEGAL'
}

/**
 * Token represents a lexical token
 */
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * Keywords map (v1 기본 29개 + Phase 4 추가 1개 + Phase 5 추가 3개 = 33개)
 */
export const KEYWORDS: Record<string, TokenType> = {
  // v1 기본
  'fn': TokenType.FN,
  'let': TokenType.LET,
  'const': TokenType.CONST,
  'if': TokenType.IF,
  'else': TokenType.ELSE,
  'match': TokenType.MATCH,
  'for': TokenType.FOR,
  'while': TokenType.WHILE,
  'loop': TokenType.LOOP,
  'break': TokenType.BREAK,
  'continue': TokenType.CONTINUE,
  'return': TokenType.RETURN,
  'async': TokenType.ASYNC,
  'await': TokenType.AWAIT,
  'import': TokenType.IMPORT,
  'export': TokenType.EXPORT,
  'from': TokenType.FROM,  // Phase 4: Module System
  'struct': TokenType.STRUCT,
  'enum': TokenType.ENUM,
  'trait': TokenType.TRAIT,
  'type': TokenType.TYPE,
  'true': TokenType.TRUE,
  'false': TokenType.FALSE,
  'null': TokenType.NULL,
  'in': TokenType.IN,
  'of': TokenType.OF,  // Phase 2: for...of loop support
  'as': TokenType.AS,
  'is': TokenType.IS,
  'pub': TokenType.PUB,
  'mut': TokenType.MUT,
  'self': TokenType.SELF,
  'super': TokenType.SUPER,
  'impl': TokenType.IMPL,

  // Phase 5 minimal .free 포맷 토큰 (3개)
  'input': TokenType.INPUT,
  'output': TokenType.OUTPUT,
  'intent': TokenType.INTENT
};

/**
 * Check if a string is a keyword
 */
export function isKeyword(str: string): boolean {
  return str in KEYWORDS;
}

/**
 * Get keyword token type
 */
export function getKeyword(str: string): TokenType {
  return KEYWORDS[str] || TokenType.IDENT;
}
