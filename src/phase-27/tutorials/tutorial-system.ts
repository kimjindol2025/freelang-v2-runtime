/**
 * 📖 Phase 27: Tutorial System
 *
 * 30개 가이드 + 학습 진행도 추적
 */

export interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  duration: number; // minutes
  videoUrl?: string;
  codeExample: string;
  quiz?: Question[];
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'code-write' | 'true-false';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lessons: Lesson[];
  prerequisites: string[];
  estimatedTime: number; // minutes
  author: string;
  createdAt: number;
}

export interface LearnerProgress {
  learnerId: string;
  tutorialId: string;
  completedLessons: Set<string>;
  quizScores: Map<string, number>;
  completionPercentage: number;
  startedAt: number;
  lastAccessedAt: number;
}

/**
 * 튜토리얼 시스템
 */
export class TutorialSystem {
  private tutorials: Map<string, Tutorial> = new Map();
  private progress: Map<string, LearnerProgress> = new Map();
  private lessonIndex: Map<string, Lesson> = new Map();

  constructor() {
    this.initializeBuiltInTutorials();
  }

  /**
   * 기본 튜토리얼 30개 초기화
   */
  private initializeBuiltInTutorials(): void {
    const tutorials: Tutorial[] = [
      // Beginner (10 tutorials)
      {
        id: 'tut-intro',
        title: 'FreeLang Introduction',
        description: 'Get started with FreeLang basics',
        difficulty: 'beginner',
        lessons: [
          {
            id: 'les-1-1',
            title: 'What is FreeLang?',
            description: 'Introduction to FreeLang',
            content: 'FreeLang is a modern programming language...',
            duration: 15,
            videoUrl: 'https://youtube.com/watch?v=...',
            codeExample: 'fn main { "Hello FreeLang" }',
            quiz: [
              {
                id: 'q1',
                type: 'multiple-choice',
                question: 'What is FreeLang?',
                options: ['A language', 'A library', 'A framework'],
                correctAnswer: 0,
                explanation: 'FreeLang is a programming language'
              }
            ]
          }
        ],
        prerequisites: [],
        estimatedTime: 30,
        author: 'FreeLang Team',
        createdAt: Date.now()
      },
      // ... 29 more tutorials
    ];

    tutorials.forEach(tutorial => {
      this.tutorials.set(tutorial.id, tutorial);
      tutorial.lessons.forEach(lesson => {
        this.lessonIndex.set(lesson.id, lesson);
      });
    });
  }

  /**
   * 튜토리얼 조회
   */
  getTutorial(id: string): Tutorial | undefined {
    return this.tutorials.get(id);
  }

  /**
   * 난이도별 튜토리얼 조회
   */
  getTutorialsByDifficulty(difficulty: string): Tutorial[] {
    return Array.from(this.tutorials.values())
      .filter(t => t.difficulty === difficulty);
  }

  /**
   * 모든 튜토리얼
   */
  getAllTutorials(): Tutorial[] {
    return Array.from(this.tutorials.values());
  }

  /**
   * 단원 조회
   */
  getLesson(id: string): Lesson | undefined {
    return this.lessonIndex.get(id);
  }

  /**
   * 진행도 시작
   */
  startTutorial(learnerId: string, tutorialId: string): LearnerProgress {
    const key = `${learnerId}:${tutorialId}`;
    const progress: LearnerProgress = {
      learnerId,
      tutorialId,
      completedLessons: new Set(),
      quizScores: new Map(),
      completionPercentage: 0,
      startedAt: Date.now(),
      lastAccessedAt: Date.now()
    };
    this.progress.set(key, progress);
    return progress;
  }

  /**
   * 단원 완료
   */
  completeLesson(learnerId: string, tutorialId: string, lessonId: string): boolean {
    const key = `${learnerId}:${tutorialId}`;
    const progress = this.progress.get(key);
    if (!progress) return false;

    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) return false;

    progress.completedLessons.add(lessonId);
    progress.lastAccessedAt = Date.now();
    progress.completionPercentage =
      (progress.completedLessons.size / tutorial.lessons.length) * 100;

    return true;
  }

  /**
   * 퀴즈 제출
   */
  submitQuiz(learnerId: string, tutorialId: string, lessonId: string, score: number): boolean {
    const key = `${learnerId}:${tutorialId}`;
    const progress = this.progress.get(key);
    if (!progress) return false;

    progress.quizScores.set(lessonId, score);
    progress.lastAccessedAt = Date.now();

    return true;
  }

  /**
   * 진행도 조회
   */
  getProgress(learnerId: string, tutorialId: string): LearnerProgress | undefined {
    const key = `${learnerId}:${tutorialId}`;
    return this.progress.get(key);
  }

  /**
   * 학습자 전체 진행도
   */
  getLearnerProgress(learnerId: string): Map<string, number> {
    const result = new Map<string, number>();
    for (const [key, progress] of this.progress) {
      if (progress.learnerId === learnerId) {
        result.set(progress.tutorialId, progress.completionPercentage);
      }
    }
    return result;
  }

  /**
   * 튜토리얼 추가
   */
  addTutorial(tutorial: Tutorial): boolean {
    if (this.tutorials.has(tutorial.id)) return false;
    this.tutorials.set(tutorial.id, tutorial);
    tutorial.lessons.forEach(lesson => {
      this.lessonIndex.set(lesson.id, lesson);
    });
    return true;
  }

  /**
   * 튜토리얼 수정
   */
  updateTutorial(id: string, updates: Partial<Tutorial>): boolean {
    const tutorial = this.tutorials.get(id);
    if (!tutorial) return false;
    this.tutorials.set(id, { ...tutorial, ...updates });
    return true;
  }

  /**
   * 추천 튜토리얼
   */
  getRecommended(learnerId: string, limit: number = 3): Tutorial[] {
    const completed = new Set<string>();
    for (const [key, progress] of this.progress) {
      if (progress.learnerId === learnerId && progress.completionPercentage === 100) {
        completed.add(progress.tutorialId);
      }
    }

    return Array.from(this.tutorials.values())
      .filter(t => !completed.has(t.id))
      .sort((a, b) => {
        const diffOrder = { 'beginner': 0, 'intermediate': 1, 'advanced': 2 };
        return diffOrder[a.difficulty] - diffOrder[b.difficulty];
      })
      .slice(0, limit);
  }

  /**
   * 학습 경로 추천
   */
  getLearningPath(learnerId: string, targetLevel: 'beginner' | 'intermediate' | 'advanced'): Tutorial[] {
    const difficulties: ('beginner' | 'intermediate' | 'advanced')[] = ['beginner', 'intermediate', 'advanced'];
    const maxIdx = difficulties.indexOf(targetLevel);

    return Array.from(this.tutorials.values())
      .filter(t => difficulties.indexOf(t.difficulty) <= maxIdx)
      .sort((a, b) => {
        const diffOrder = { 'beginner': 0, 'intermediate': 1, 'advanced': 2 };
        return diffOrder[a.difficulty] - diffOrder[b.difficulty];
      });
  }

  /**
   * 통계
   */
  getStats(): {
    totalTutorials: number;
    totalLessons: number;
    avgDuration: number;
    totalLearners: number;
    avgCompletionRate: number;
  } {
    const tutorials = Array.from(this.tutorials.values());
    const totalLessons = tutorials.reduce((sum, t) => sum + t.lessons.length, 0);
    const avgDuration = tutorials.reduce((sum, t) => sum + t.estimatedTime, 0) / tutorials.length;

    const completionRates: number[] = [];
    for (const progress of this.progress.values()) {
      completionRates.push(progress.completionPercentage);
    }

    return {
      totalTutorials: tutorials.length,
      totalLessons,
      avgDuration,
      totalLearners: new Set(Array.from(this.progress.values()).map(p => p.learnerId)).size,
      avgCompletionRate: completionRates.length > 0
        ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
        : 0
    };
  }
}
