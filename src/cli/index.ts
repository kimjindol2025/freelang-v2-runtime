#!/usr/bin/env node

/**
 * Phase 9.1: CLI Entry Point
 *
 * 명령행 인터페이스 메인 진입점
 * - Interactive 모드: 대화형 입력
 * - Batch 모드: 파일 기반 입력
 */

import * as fs from 'fs';
import * as path from 'path';
import { interactiveMode } from './interactive';
import { batchMode } from './batch';
import { ProgramRunner } from './runner';
import { ScriptRunner } from '../script-runner';

/**
 * 도움말 표시
 */
function showUsage(): void {
  console.log(`
📚 FreeLang v2 - CLI Tool

Usage:
  freelang                    # 대화형 모드 (기본값)
  freelang run <file.fl>      # 스크립트 실행 (v4 Lexer/Parser/VM)
  freelang --interactive      # 명시적 대화형 모드
  freelang --batch <file>     # 배치 모드 (파일 입력)
  freelang --help             # 도움말
  freelang --version          # 버전 정보

Options:
  run <file.fl>              # FreeLang 스크립트 실행
  --no-check                 # 타입 체크 건너뛰기
  --dump-bc                  # 바이트코드 덤프
  -i, --interactive          # 대화형 모드 시작
  -b, --batch <file>         # 배치 파일 입력 (입력값 한 줄씩)
  -o, --output <file>        # 출력 파일 (배치 모드)
  -f, --format <json|csv>    # 출력 형식 (기본: json)
  -h, --help                 # 도움말
  -v, --version              # 버전

Examples:
  # 스크립트 실행
  $ freelang run hello.fl
  $ freelang run vm-db-test.fl --no-check

  # 대화형 모드
  $ freelang

  # 배치 처리
  $ freelang --batch inputs.txt --output results.json --format json
  $ freelang --batch inputs.txt --output results.csv --format csv

  # 파이프 입력
  $ echo "배열 합산" | freelang --interactive
  `);
}

/**
 * 버전 정보 표시
 */
function showVersion(): void {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
  );
  console.log(`FreeLang v${packageJson.version}`);
}

/**
 * 대화형 모드 시작
 */
async function startInteractiveMode(): Promise<void> {
  console.log('📝 FreeLang v2 Interactive Mode');
  console.log('Type "help" for commands or "quit" to exit\n');

  // 초기 프롬프트
  if (process.stdin.isTTY) {
    // 터미널에서 실행 중
    process.stdout.write(interactiveMode.showPrompt());
  }

  // 표준 입력 처리
  let buffer = '';

  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;

    // 개행 문자로 구분된 각 라인 처리
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 명령 파싱
      const command = interactiveMode.parseCommand(trimmed);

      // 명령 처리
      switch (command.action) {
        case 'quit':
          console.log('\n👋 Goodbye!');
          process.exit(0);

        case 'help':
          console.log(interactiveMode.showHelp());
          break;

        case 'history':
          console.log(interactiveMode.showHistory());
          break;

        case 'stats':
          console.log(interactiveMode.showStats());
          break;

        case 'approve':
        case 'reject':
        case 'modify':
          if (command.input) {
            const success = interactiveMode.recordFeedback(
              command.input,
              'user-input',
              command.action,
              command.modification
            );
            if (success) {
              console.log(`✅ ${command.action.toUpperCase()} recorded`);
            } else {
              console.log(`❌ Failed to record ${command.action}`);
            }
            interactiveMode.recordHistory(trimmed);
          }
          break;
      }

      // 프롬프트 표시
      if (process.stdin.isTTY) {
        process.stdout.write(interactiveMode.showPrompt());
      }
    }
  });

  // 입력 종료 처리
  process.stdin.on('end', () => {
    console.log('\n👋 Input closed');
    process.exit(0);
  });

  // 에러 처리
  process.stdin.on('error', (error) => {
    console.error('❌ Input error:', error.message);
    process.exit(1);
  });
}

/**
 * 배치 모드 시작
 */
async function startBatchMode(
  inputFile: string,
  outputFile?: string,
  format: 'json' | 'csv' = 'json'
): Promise<void> {
  try {
    console.log(`📂 Reading batch file: ${inputFile}`);

    // 입력 파일 읽기
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ File not found: ${inputFile}`);
      process.exit(1);
    }

    const content = fs.readFileSync(inputFile, 'utf-8');
    const inputs = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    console.log(`📋 Found ${inputs.length} inputs`);

    // 배치 처리
    console.log('⏳ Processing batch...');
    const results = await batchMode.processBatch(inputs);

    console.log(`✅ Processed ${results.length} items`);

    // 결과 내보내기
    let output: string;
    if (format === 'csv') {
      output = batchMode.exportAsCSV();
    } else {
      output = batchMode.exportAsJSON();
    }

    // 파일 또는 stdout에 출력
    if (outputFile) {
      fs.writeFileSync(outputFile, output);
      console.log(`📝 Results saved to: ${outputFile}`);
    } else {
      console.log('\n📊 Results:\n');
      console.log(output);
    }

    // 요약 표시
    console.log(batchMode.summarize());

    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error('❌ Unknown error');
    }
    process.exit(1);
  }
}

/**
 * 메인 함수
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 인자 없음: 대화형 모드
  if (args.length === 0) {
    await startInteractiveMode();
    return;
  }

  // run 명령어 처리 (최우선)
  if (args[0] === 'run') {
    const filePath = args[1];
    if (!filePath) {
      console.error('❌ run requires a file argument');
      showUsage();
      process.exit(1);
    }

    const noCheck = args.includes('--no-check');
    const dumpBc = args.includes('--dump-bc');

    const result = ScriptRunner.runFile(filePath, {
      noCheck,
      dumpBc,
      filePath
    });

    for (const line of result.output) {
      console.log(line);
    }

    if (result.error) {
      console.error(result.error);
      process.exit(result.exitCode);
    }
    process.exit(0);
  }

  // 인자 파싱
  let mode: 'interactive' | 'batch' = 'interactive';
  let batchInputFile: string | undefined;
  let batchOutputFile: string | undefined;
  let outputFormat: 'json' | 'csv' = 'json';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        showUsage();
        process.exit(0);

      case '-v':
      case '--version':
        showVersion();
        process.exit(0);

      case '-i':
      case '--interactive':
        mode = 'interactive';
        break;

      case '-b':
      case '--batch':
        mode = 'batch';
        batchInputFile = args[++i];
        if (!batchInputFile) {
          console.error('❌ --batch requires a file argument');
          process.exit(1);
        }
        break;

      case '-o':
      case '--output':
        batchOutputFile = args[++i];
        if (!batchOutputFile) {
          console.error('❌ --output requires a file argument');
          process.exit(1);
        }
        break;

      case '-f':
      case '--format':
        const fmt = args[++i];
        if (fmt === 'json' || fmt === 'csv') {
          outputFormat = fmt;
        } else {
          console.error('❌ --format must be json or csv');
          process.exit(1);
        }
        break;

      default:
        // .free 파일 직접 실행 지원
        if (!arg.startsWith('-') && arg.endsWith('.free')) {
          try {
            const runner = new ProgramRunner();
            const result = runner.runFile(arg);
            if (result.success) {
              if (result.output !== undefined) {
                console.log(result.output);
              }
              process.exit(0);
            } else {
              console.error(`❌ ${result.error}`);
              process.exit(result.exitCode);
            }
          } catch (error) {
            console.error(`❌ Failed to run ${arg}:`, error instanceof Error ? error.message : String(error));
            process.exit(1);
          }
        } else {
          console.error(`❌ Unknown option: ${arg}`);
          showUsage();
          process.exit(1);
        }
    }
  }

  // 모드별 실행
  if (mode === 'interactive') {
    await startInteractiveMode();
  } else if (mode === 'batch') {
    if (!batchInputFile) {
      console.error('❌ Batch mode requires input file');
      process.exit(1);
    }
    await startBatchMode(batchInputFile, batchOutputFile, outputFormat);
  }
}

// 진입점
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
