/**
 * Phase 16: Zig Type System
 * Maps FreeLang types to Zig equivalents
 */

/**
 * Zig AST Node Types
 */
export type ZigNodeType =
  | 'program'
  | 'function'
  | 'variable'
  | 'type'
  | 'block'
  | 'if'
  | 'while'
  | 'for'
  | 'return'
  | 'assignment'
  | 'binary_op'
  | 'unary_op'
  | 'call'
  | 'array_access'
  | 'literal'
  | 'identifier';

export interface ZigASTNode {
  type: ZigNodeType;
  name?: string;
  value?: any;
  operator?: string;
  left?: ZigASTNode;
  right?: ZigASTNode;
  body?: ZigASTNode[];
  condition?: ZigASTNode;
  children?: ZigASTNode[];
  returnType?: string;
  params?: ZigParam[];
  isPublic?: boolean;
}

export interface ZigParam {
  name: string;
  type: string;
}

export interface ZigTypeMap {
  freelang: string;
  zig: string;
  zigType: 'scalar' | 'array' | 'pointer' | 'struct' | 'optional';
}

/**
 * Type Mapping: FreeLang → Zig
 */
export const TYPE_MAPPING: ZigTypeMap[] = [
  // Scalars
  { freelang: 'number', zig: 'f64', zigType: 'scalar' },
  { freelang: 'int', zig: 'i64', zigType: 'scalar' },
  { freelang: 'bool', zig: 'bool', zigType: 'scalar' },
  { freelang: 'string', zig: '[]const u8', zigType: 'array' },

  // Arrays
  { freelang: 'array<number>', zig: '[]f64', zigType: 'array' },
  { freelang: 'array<int>', zig: '[]i64', zigType: 'array' },
  { freelang: 'array<bool>', zig: '[]bool', zigType: 'array' },
  { freelang: 'array<string>', zig: '[][]const u8', zigType: 'array' },

  // Optionals
  { freelang: 'optional<number>', zig: '?f64', zigType: 'optional' },
  { freelang: 'optional<int>', zig: '?i64', zigType: 'optional' },
];

/**
 * Opcode to Zig Operation Mapping
 */
export interface OpZigMap {
  freeLangOp: string;
  zigOp: string;
  template?: string;
  requiresOverflowCheck?: boolean;
}

export const OP_MAPPING: OpZigMap[] = [
  // Arithmetic
  { freeLangOp: 'ADD', zigOp: '+', requiresOverflowCheck: true },
  { freeLangOp: 'SUB', zigOp: '-', requiresOverflowCheck: true },
  { freeLangOp: 'MUL', zigOp: '*', requiresOverflowCheck: true },
  { freeLangOp: 'DIV', zigOp: '/', requiresOverflowCheck: true },
  { freeLangOp: 'MOD', zigOp: '%' },
  { freeLangOp: 'NEG', zigOp: '-', template: '(-%s)' },

  // Comparison
  { freeLangOp: 'EQ', zigOp: '==' },
  { freeLangOp: 'NEQ', zigOp: '!=' },
  { freeLangOp: 'LT', zigOp: '<' },
  { freeLangOp: 'LTE', zigOp: '<=' },
  { freeLangOp: 'GT', zigOp: '>' },
  { freeLangOp: 'GTE', zigOp: '>=' },

  // Bitwise
  { freeLangOp: 'AND', zigOp: '&' },
  { freeLangOp: 'OR', zigOp: '|' },
  { freeLangOp: 'XOR', zigOp: '^' },
  { freeLangOp: 'NOT', zigOp: '~', template: '(~%s)' },
  { freeLangOp: 'SHL', zigOp: '<<' },
  { freeLangOp: 'SHR', zigOp: '>>' },

  // Logical
  { freeLangOp: 'LAND', zigOp: 'and' },
  { freeLangOp: 'LOR', zigOp: 'or' },
  { freeLangOp: 'LNOT', zigOp: '!', template: '(!%s)' },
];

/**
 * Memory Layout in Zig
 */
export interface ZigMemoryLayout {
  // For stack simulation
  stackType: 'ArrayList<Value>';
  valueType: 'union(enum) { i64(i64), f64(f64), bool(bool), ptr(*anyopaque) }';
}

/**
 * Code Generation Template
 */
export const ZIG_TEMPLATE = `const std = @import("std");
const ArrayList = std.ArrayList;

pub fn main() !void {
  var gpa = std.heap.GeneralPurposeAllocator(.{}){};
  defer _ = gpa.deinit();
  const allocator = gpa.allocator();

  // Generated code here
}

%s // Generated functions

// Helper runtime functions
fn allocate(allocator: std.mem.Allocator, size: usize) !*anyopaque {
  return try allocator.alloc(u8, size);
}

fn deallocate(allocator: std.mem.Allocator, ptr: *anyopaque) void {
  allocator.free(ptr);
}
`;

/**
 * Zig Compilation Options
 */
export interface ZigCompileOptions {
  outputFile?: string;
  targetTriple?: string;
  optimizationLevel?: 'Debug' | 'ReleaseSafe' | 'ReleaseFast' | 'ReleaseSmall';
  enableSafetyChecks?: boolean;
  includeDebugSymbols?: boolean;
}

export const DEFAULT_ZIG_OPTIONS: ZigCompileOptions = {
  outputFile: 'a.out',
  optimizationLevel: 'ReleaseFast',
  enableSafetyChecks: true,
  includeDebugSymbols: false,
};

/**
 * Utility: Get Zig type from FreeLang type
 */
export function getZigType(freelangType: string): string {
  const mapping = TYPE_MAPPING.find(m => m.freelang === freelangType);
  return mapping ? mapping.zig : 'anyopaque'; // fallback
}

/**
 * Utility: Get Zig operator from FreeLang opcode
 */
export function getZigOp(freelangOp: string): OpZigMap | undefined {
  return OP_MAPPING.find(m => m.freeLangOp === freelangOp);
}

/**
 * Value Union for Runtime Stack
 */
export type ZigValue =
  | { type: 'i64', value: number }
  | { type: 'f64', value: number }
  | { type: 'bool', value: boolean }
  | { type: 'ptr', value: any }
  | { type: 'array', value: any[] };
