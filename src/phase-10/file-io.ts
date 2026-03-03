/**
 * Phase 10: File I/O Operations
 *
 * 파일 처리:
 * - open, read, write, close
 * - readLine, readLines
 * - writeFile, appendFile
 * - listFiles
 * - delete, copy, move
 * - stat (파일 정보)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

/**
 * 파일 정보
 */
export interface FileInfo {
  path: string;
  name: string;
  size: number;
  created: Date;
  modified: Date;
  isDirectory: boolean;
  isFile: boolean;
}

/**
 * 파일 핸들
 */
export interface FileHandle {
  path: string;
  content: string;
  isDirty: boolean;
  cursor: number;
}

/**
 * 파일 I/O 유틸리티
 */
export class FileIO {
  private handles: Map<string, FileHandle> = new Map();
  private lineReaders: Map<string, readline.Interface> = new Map();

  /**
   * 파일 읽기 (전체)
   */
  readFile(filepath: string, encoding: string = 'utf-8'): string {
    try {
      return fs.readFileSync(filepath, encoding as BufferEncoding);
    } catch (error) {
      throw new Error(`Failed to read file ${filepath}: ${String(error)}`);
    }
  }

  /**
   * 파일 쓰기 (덮어쓰기)
   */
  writeFile(filepath: string, content: string): void {
    try {
      fs.writeFileSync(filepath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file ${filepath}: ${String(error)}`);
    }
  }

  /**
   * 파일 쓰기 (추가)
   */
  appendFile(filepath: string, content: string): void {
    try {
      fs.appendFileSync(filepath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to append to file ${filepath}: ${String(error)}`);
    }
  }

  /**
   * 파일 존재 확인
   */
  exists(filepath: string): boolean {
    return fs.existsSync(filepath);
  }

  /**
   * 파일 정보
   */
  stat(filepath: string): FileInfo {
    try {
      const stats = fs.statSync(filepath);
      return {
        path: filepath,
        name: path.basename(filepath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
      };
    } catch (error) {
      throw new Error(`Failed to stat ${filepath}: ${String(error)}`);
    }
  }

  /**
   * 디렉토리 목록
   */
  listFiles(dirpath: string): FileInfo[] {
    try {
      const files = fs.readdirSync(dirpath);
      return files.map((file) => {
        const filepath = path.join(dirpath, file);
        return this.stat(filepath);
      });
    } catch (error) {
      throw new Error(`Failed to list files in ${dirpath}: ${String(error)}`);
    }
  }

  /**
   * 재귀적 파일 목록
   */
  listFilesRecursive(dirpath: string): FileInfo[] {
    const results: FileInfo[] = [];

    const walk = (dir: string) => {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filepath = path.join(dir, file);
          const info = this.stat(filepath);
          results.push(info);
          if (info.isDirectory) {
            walk(filepath);
          }
        }
      } catch (error) {
        console.warn(`Cannot access ${dir}`);
      }
    };

    walk(dirpath);
    return results;
  }

  /**
   * 파일 삭제
   */
  deleteFile(filepath: string): void {
    try {
      fs.unlinkSync(filepath);
    } catch (error) {
      throw new Error(`Failed to delete ${filepath}: ${String(error)}`);
    }
  }

  /**
   * 디렉토리 삭제
   */
  deleteDirectory(dirpath: string, recursive: boolean = false): void {
    try {
      if (recursive) {
        fs.rmSync(dirpath, { recursive: true, force: true });
      } else {
        fs.rmdirSync(dirpath);
      }
    } catch (error) {
      throw new Error(`Failed to delete directory ${dirpath}: ${String(error)}`);
    }
  }

  /**
   * 파일 복사
   */
  copyFile(from: string, to: string): void {
    try {
      fs.copyFileSync(from, to);
    } catch (error) {
      throw new Error(`Failed to copy ${from} to ${to}: ${String(error)}`);
    }
  }

  /**
   * 파일 이동
   */
  moveFile(from: string, to: string): void {
    try {
      fs.renameSync(from, to);
    } catch (error) {
      throw new Error(`Failed to move ${from} to ${to}: ${String(error)}`);
    }
  }

  /**
   * 디렉토리 생성
   */
  createDirectory(dirpath: string, recursive: boolean = true): void {
    try {
      fs.mkdirSync(dirpath, { recursive });
    } catch (error) {
      throw new Error(`Failed to create directory ${dirpath}: ${String(error)}`);
    }
  }

  /**
   * 한 줄씩 읽기 (콜백)
   */
  async readLineByLine(
    filepath: string,
    callback: (line: string, index: number) => Promise<void> | void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(filepath),
        crlfDelay: Infinity,
      });

      let lineIndex = 0;

      rl.on('line', async (line) => {
        rl.pause();
        try {
          await callback(line, lineIndex);
          lineIndex++;
          rl.resume();
        } catch (error) {
          rl.close();
          reject(error);
        }
      });

      rl.on('close', () => {
        resolve();
      });

      rl.on('error', reject);
    });
  }

  /**
   * 모든 줄 읽기
   */
  readLines(filepath: string): string[] {
    const content = this.readFile(filepath);
    return content.split('\n');
  }

  /**
   * 처음 N줄 읽기
   */
  readHead(filepath: string, lines: number): string[] {
    return this.readLines(filepath).slice(0, lines);
  }

  /**
   * 마지막 N줄 읽기
   */
  readTail(filepath: string, lines: number): string[] {
    const all = this.readLines(filepath);
    return all.slice(Math.max(0, all.length - lines));
  }

  /**
   * 파일 크기 (MB)
   */
  getFileSizeMB(filepath: string): number {
    const stats = fs.statSync(filepath);
    return stats.size / (1024 * 1024);
  }

  /**
   * 파일 크기 (읽기 가능 형식)
   */
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 현재 디렉토리
   */
  getCurrentDirectory(): string {
    return process.cwd();
  }

  /**
   * 홈 디렉토리
   */
  getHomeDirectory(): string {
    return process.env.HOME || process.env.USERPROFILE || '/tmp';
  }

  /**
   * 절대 경로
   */
  resolvePath(filepath: string): string {
    return path.resolve(filepath);
  }

  /**
   * 경로 결합
   */
  joinPath(...parts: string[]): string {
    return path.join(...parts);
  }

  /**
   * 파일명 추출
   */
  basename(filepath: string): string {
    return path.basename(filepath);
  }

  /**
   * 디렉토리 추출
   */
  dirname(filepath: string): string {
    return path.dirname(filepath);
  }

  /**
   * 확장자 추출
   */
  extname(filepath: string): string {
    return path.extname(filepath);
  }

  /**
   * 임시 파일 생성
   */
  createTempFile(prefix: string = 'temp_'): string {
    const tempDir = '/tmp';
    const filename = `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    return path.join(tempDir, filename);
  }
}

/**
 * 테스트
 */
export function testFileIO(): void {
  console.log('=== File I/O Tests ===\n');

  const fileIO = new FileIO();
  const testFile = '/tmp/test_freelang.txt';

  // 1. 파일 쓰기
  console.log('1️⃣ Write File:');
  try {
    fileIO.writeFile(testFile, 'Line 1\nLine 2\nLine 3\n');
    console.log(`   ✅ File written: ${testFile}`);
  } catch (error) {
    console.log(`   ❌ ${String(error)}`);
  }

  // 2. 파일 읽기
  console.log('\n2️⃣ Read File:');
  try {
    const content = fileIO.readFile(testFile);
    console.log(`   ✅ Content length: ${content.length} chars`);
  } catch (error) {
    console.log(`   ❌ ${String(error)}`);
  }

  // 3. 파일 정보
  console.log('\n3️⃣ File Info:');
  try {
    const info = fileIO.stat(testFile);
    console.log(`   ✅ Size: ${fileIO.formatFileSize(info.size)}`);
    console.log(`   ✅ Modified: ${info.modified.toISOString()}`);
  } catch (error) {
    console.log(`   ❌ ${String(error)}`);
  }

  // 4. 줄 읽기
  console.log('\n4️⃣ Read Lines:');
  try {
    const lines = fileIO.readLines(testFile);
    console.log(`   ✅ Total lines: ${lines.length}`);
    console.log(`   ✅ First line: "${lines[0]}"`);
  } catch (error) {
    console.log(`   ❌ ${String(error)}`);
  }

  // 5. 파일 추가
  console.log('\n5️⃣ Append File:');
  try {
    fileIO.appendFile(testFile, 'Line 4\n');
    console.log(`   ✅ Content appended`);
  } catch (error) {
    console.log(`   ❌ ${String(error)}`);
  }

  // 6. 파일 존재 확인
  console.log('\n6️⃣ File Exists:');
  console.log(`   ✅ Exists: ${fileIO.exists(testFile)}`);

  // 7. 디렉토리 목록
  console.log('\n7️⃣ List Files:');
  try {
    const files = fileIO.listFiles('/tmp');
    console.log(`   ✅ Files in /tmp: ${files.length}`);
    console.log(`   ✅ First file: ${files[0]?.name}`);
  } catch (error) {
    console.log(`   ❌ ${String(error)}`);
  }

  // 8. 파일 삭제
  console.log('\n8️⃣ Delete File:');
  try {
    fileIO.deleteFile(testFile);
    console.log(`   ✅ File deleted`);
  } catch (error) {
    console.log(`   ❌ ${String(error)}`);
  }

  console.log('\n✅ All file I/O tests completed!');
}
