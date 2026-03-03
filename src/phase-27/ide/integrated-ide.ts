/**
 * 🎯 Phase 27: Integrated Online IDE System
 *
 * 편집기 + 컴파일 + 예제 + 튜토리얼 + 문서 통합
 */

import { OnlineIDE, CompileResult } from './editor';
import { ExampleManager, Example } from '../examples/example-manager';
import { TutorialSystem, Tutorial } from '../tutorials/tutorial-system';
import { APIDocGenerator } from '../api/api-doc-generator';

export interface IDESession {
  sessionId: string;
  userId: string;
  code: string;
  lastModified: number;
  currentExample?: string;
  currentTutorial?: string;
}

export interface IDEState {
  editorConfig: any;
  themePreference: 'dark' | 'light';
  fontSize: number;
  autoCompile: boolean;
  autoSave: boolean;
  recentFiles: string[];
  bookmarks: string[];
}

/**
 * 통합 온라인 IDE
 */
export class IntegratedIDE {
  private editor: OnlineIDE;
  private examples: ExampleManager;
  private tutorials: TutorialSystem;
  private apiDocs: APIDocGenerator;
  private sessions: Map<string, IDESession> = new Map();
  private userStates: Map<string, IDEState> = new Map();
  private compilationHistory: CompileResult[] = [];

  constructor() {
    this.editor = new OnlineIDE();
    this.examples = new ExampleManager();
    this.tutorials = new TutorialSystem();
    this.apiDocs = new APIDocGenerator();
  }

  /**
   * IDE 세션 생성
   */
  createSession(userId: string): IDESession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const session: IDESession = {
      sessionId,
      userId,
      code: '',
      lastModified: Date.now()
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 세션 로드
   */
  loadSession(sessionId: string): IDESession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 코드 편집
   */
  updateCode(sessionId: string, code: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.code = code;
    session.lastModified = Date.now();
    this.editor.setCode(code);
    return true;
  }

  /**
   * 실시간 컴파일
   */
  async compileCode(sessionId: string): Promise<CompileResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        errors: [{ line: 0, column: 0, message: 'Session not found', severity: 'error' }],
        warnings: [],
        executionTime: 0
      };
    }

    const result = await this.editor.compile();
    this.compilationHistory.push(result);

    // Keep only last 100 compilations
    if (this.compilationHistory.length > 100) {
      this.compilationHistory.shift();
    }

    return result;
  }

  /**
   * 예제 로드
   */
  loadExample(sessionId: string, exampleId: string): boolean {
    const example = this.examples.getExample(exampleId);
    if (!example) return false;

    return this.updateCode(sessionId, example.code);
  }

  /**
   * 튜토리얼 시작
   */
  startTutorial(sessionId: string, tutorialId: string): Tutorial | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const tutorial = this.tutorials.getTutorial(tutorialId);
    if (!tutorial) return undefined;

    session.currentTutorial = tutorialId;
    return tutorial;
  }

  /**
   * 사용자 상태 초기화
   */
  initializeUserState(userId: string): IDEState {
    const state: IDEState = {
      editorConfig: {
        theme: 'dark',
        fontSize: 14,
        tabSize: 2
      },
      themePreference: 'dark',
      fontSize: 14,
      autoCompile: true,
      autoSave: true,
      recentFiles: [],
      bookmarks: []
    };
    this.userStates.set(userId, state);
    return state;
  }

  /**
   * 사용자 상태 조회
   */
  getUserState(userId: string): IDEState | undefined {
    return this.userStates.get(userId);
  }

  /**
   * 북마크 추가
   */
  addBookmark(userId: string, fileId: string): boolean {
    const state = this.userStates.get(userId);
    if (!state) return false;

    if (!state.bookmarks.includes(fileId)) {
      state.bookmarks.push(fileId);
    }
    return true;
  }

  /**
   * 최근 파일 추가
   */
  addRecentFile(userId: string, fileId: string): boolean {
    const state = this.userStates.get(userId);
    if (!state) return false;

    // Remove if already exists
    state.recentFiles = state.recentFiles.filter(f => f !== fileId);

    // Add to beginning
    state.recentFiles.unshift(fileId);

    // Keep only last 20
    if (state.recentFiles.length > 20) {
      state.recentFiles.pop();
    }

    return true;
  }

  /**
   * API 문서 조회
   */
  getAPIDocumentation(): string {
    return this.apiDocs.generateHTMLDocs();
  }

  /**
   * OpenAPI 스펙 조회
   */
  getOpenAPISpec(): any {
    return this.apiDocs.generateOpenAPISpec();
  }

  /**
   * IDE 통계
   */
  getStats(): {
    activeSessions: number;
    totalExamples: number;
    totalTutorials: number;
    avgCompilationTime: number;
    compilationSuccessRate: number;
  } {
    const successCount = this.compilationHistory.filter(r => r.success).length;
    const avgTime = this.compilationHistory.length > 0
      ? this.compilationHistory.reduce((sum, r) => sum + r.executionTime, 0) / this.compilationHistory.length
      : 0;

    return {
      activeSessions: this.sessions.size,
      totalExamples: this.examples.getAllExamples().length,
      totalTutorials: this.tutorials.getAllTutorials().length,
      avgCompilationTime: avgTime,
      compilationSuccessRate: this.compilationHistory.length > 0
        ? (successCount / this.compilationHistory.length) * 100
        : 0
    };
  }

  /**
   * 세션 정리
   */
  cleanupOldSessions(maxAgeMinutes: number = 60): number {
    const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);
    let removedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.lastModified < cutoffTime) {
        this.sessions.delete(sessionId);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * 컴파일 이력 조회
   */
  getCompilationHistory(limit: number = 10): CompileResult[] {
    return this.compilationHistory.slice(-limit);
  }

  /**
   * 검색 (예제 + 튜토리얼)
   */
  search(query: string): {
    examples: Example[];
    tutorials: Tutorial[];
  } {
    const lowerQuery = query.toLowerCase();
    const examples = this.examples.getAllExamples()
      .filter(ex => ex.title.toLowerCase().includes(lowerQuery) ||
                    ex.description.toLowerCase().includes(lowerQuery) ||
                    ex.tags.some(tag => tag.toLowerCase().includes(lowerQuery)));

    const tutorials = this.tutorials.getAllTutorials()
      .filter(t => t.title.toLowerCase().includes(lowerQuery) ||
                   t.description.toLowerCase().includes(lowerQuery));

    return { examples, tutorials };
  }

  /**
   * 문서 내보내기
   */
  exportDocumentation(format: 'html' | 'markdown' | 'json'): string {
    switch (format) {
      case 'html':
        return this.apiDocs.generateHTMLDocs();
      case 'markdown':
        return this.apiDocs.generateMarkdownDocs();
      case 'json':
        return JSON.stringify(this.apiDocs.generateOpenAPISpec(), null, 2);
      default:
        return '';
    }
  }
}
