// FreeLang v2 Script Runner
// Lexer → Parser → TypeChecker → Compiler → VM 통합 파이프라인

import * as fs from "fs";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { TypeChecker } from "./checker";
import { Compiler } from "./compiler";
import { VM } from "./vm";

/**
 * 스크립트 실행 결과
 */
export interface ScriptResult {
  output: string[];
  error?: string;
  exitCode: number;
}

/**
 * 스크립트 실행 옵션
 */
export interface RunOptions {
  noCheck?: boolean;     // 타입 체크 건너뛰기
  dumpBc?: boolean;      // 바이트코드 덤프
  filePath?: string;     // 에러 메시지에 사용할 파일명
}

/**
 * ScriptRunner - FreeLang 스크립트 실행 엔진
 */
export class ScriptRunner {
  /**
   * FreeLang 스크립트 파일 실행
   */
  static runFile(filePath: string, options?: RunOptions): ScriptResult {
    try {
      let source = fs.readFileSync(filePath, "utf-8");

      // use 모듈 인라인 처리
      const useRegex = /use\s+(\w+)\s+as\s+(\w+);?/g;
      const moduleDir = require("path").dirname(filePath);
      let match;
      const moduleSources: string[] = [];

      while ((match = useRegex.exec(source)) !== null) {
        const moduleName = match[1];
        const moduleFile = require("path").join(moduleDir, `${moduleName}.fl`);
        try {
          const moduleSource = fs.readFileSync(moduleFile, "utf-8");
          moduleSources.push(moduleSource);
        } catch (e) {
          // 모듈 파일을 찾지 못해도 계속 진행 (모듈 없이도 컴파일 가능)
        }
      }

      // use 선언 제거 및 모듈 소스 앞에 추가
      source = moduleSources.join("\n") + "\n" + source.replace(useRegex, "");

      return this.runSource(source, {
        ...options,
        filePath: filePath
      });
    } catch (err: any) {
      return {
        output: [],
        error: `error: cannot read file '${filePath}'`,
        exitCode: 1
      };
    }
  }

  /**
   * FreeLang 소스코드 문자열 실행
   */
  static runSource(source: string, options?: RunOptions): ScriptResult {
    const fileName = options?.filePath || "<source>";
    const noCheck = options?.noCheck ?? false;
    const dumpBc = options?.dumpBc ?? false;

    try {
      // 1. Lexer: 소스코드 → 토큰
      const { tokens, errors: lexErrors } = new Lexer(source).tokenize();
      if (lexErrors.length > 0) {
        const errorMsg = lexErrors
          .map((e: any) => `${fileName}:${e.line}: lex error: ${e.message}`)
          .join("\n");
        return {
          output: [],
          error: errorMsg,
          exitCode: 1
        };
      }

      // 2. Parser: 토큰 → AST
      const { program, errors: parseErrors } = new Parser(tokens).parse();
      if (parseErrors.length > 0) {
        const errorMsg = parseErrors
          .map((e: any) => `${fileName}:${e.line}: parse error: ${e.message}`)
          .join("\n");
        return {
          output: [],
          error: errorMsg,
          exitCode: 1
        };
      }

      // 3. TypeChecker: 타입 검증 (선택사항)
      if (!noCheck) {
        const checkErrors = new TypeChecker().check(program);
        if (checkErrors.length > 0) {
          const errorMsg = checkErrors
            .map((e: any) => `${fileName}:${e.line}: type error: ${e.message}`)
            .join("\n");
          return {
            output: [],
            error: errorMsg,
            exitCode: 1
          };
        }
      }

      // 4. Compiler: AST → Bytecode
      const chunk = new Compiler().compile(program);

      // 바이트코드 덤프 옵션
      if (dumpBc) {
        const output = [
          `--- bytecode (${chunk.code.length} bytes, ${chunk.functions.length} functions) ---`,
          `constants: ${JSON.stringify(chunk.constants)}`,
          ...chunk.functions.map(
            (fn: any) => `fn ${fn.name}(arity=${fn.arity}) @ offset ${fn.offset}`
          )
        ];
        return {
          output,
          exitCode: 0
        };
      }

      // 5. VM: Bytecode 실행
      const vmResult = new VM().run(chunk);

      return {
        output: vmResult.output,
        error: vmResult.error,
        exitCode: vmResult.error ? 1 : 0
      };
    } catch (err: any) {
      return {
        output: [],
        error: `fatal error: ${err.message}`,
        exitCode: 2
      };
    }
  }
}
