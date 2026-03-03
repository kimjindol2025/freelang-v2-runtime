/**
 * Phase 15-1: Dynamic Array Engine
 *
 * 메모리 최적화를 위한 가변 크기 배열
 * - 자동 리사이징 (1.5x growth factor)
 * - 메모리 효율성 극대화
 * - O(1) amortized append
 * - 성능 오버헤드 최소화
 *
 * 목표: 배열 메모리 사용량 20-30% 감소
 */

/**
 * 동적 배열 (Dynamic Array / ArrayList)
 *
 * 특징:
 * - Initial capacity: 16
 * - Growth factor: 1.5x (vs JavaScript 2x)
 * - Shrink threshold: capacity > size * 4
 */
export class DynamicArray<T> {
  private data: T[];
  private _size: number = 0;
  private _capacity: number;
  private readonly INITIAL_CAPACITY = 16;
  private readonly GROWTH_FACTOR = 1.5;
  private readonly SHRINK_THRESHOLD = 4; // capacity > size * 4일 때 shrink

  /**
   * 생성자
   * @param initialCapacity - 초기 용량 (생략시 16)
   */
  constructor(initialCapacity?: number) {
    this._capacity = initialCapacity || this.INITIAL_CAPACITY;
    this.data = new Array(this._capacity);
  }

  /**
   * 배열 끝에 요소 추가 (O(1) amortized)
   */
  append(item: T): void {
    if (this._size >= this._capacity) {
      this.grow();
    }
    this.data[this._size] = item;
    this._size++;
  }

  /**
   * 인덱스로 요소 조회
   */
  get(index: number): T {
    if (index < 0 || index >= this._size) {
      throw new RangeError(`Index out of bounds: ${index}`);
    }
    return this.data[index];
  }

  /**
   * 인덱스로 요소 설정
   */
  set(index: number, value: T): void {
    if (index < 0 || index >= this._size) {
      throw new RangeError(`Index out of bounds: ${index}`);
    }
    this.data[index] = value;
  }

  /**
   * 인덱스로 요소 삽입 (중간)
   * O(n) - 뒤의 모든 요소 이동
   */
  insert(index: number, item: T): void {
    if (index < 0 || index > this._size) {
      throw new RangeError(`Index out of bounds: ${index}`);
    }

    if (this._size >= this._capacity) {
      this.grow();
    }

    // 뒤로 이동
    for (let i = this._size; i > index; i--) {
      this.data[i] = this.data[i - 1];
    }

    this.data[index] = item;
    this._size++;
  }

  /**
   * 인덱스로 요소 제거
   * O(n) - 뒤의 모든 요소 이동
   */
  remove(index: number): T {
    if (index < 0 || index >= this._size) {
      throw new RangeError(`Index out of bounds: ${index}`);
    }

    const removed = this.data[index];

    // 앞으로 이동
    for (let i = index; i < this._size - 1; i++) {
      this.data[i] = this.data[i + 1];
    }

    this._size--;
    this.data[this._size] = undefined as any; // 참조 해제

    // 자동 shrink
    if (this._capacity > this.INITIAL_CAPACITY &&
        this._size < this._capacity / this.SHRINK_THRESHOLD) {
      this.shrink();
    }

    return removed;
  }

  /**
   * 끝에서 요소 제거
   */
  pop(): T | undefined {
    if (this._size === 0) {
      return undefined;
    }
    const item = this.data[this._size - 1];
    this._size--;
    this.data[this._size] = undefined as any;
    return item;
  }

  /**
   * 현재 크기
   */
  size(): number {
    return this._size;
  }

  /**
   * 현재 용량
   */
  capacity(): number {
    return this._capacity;
  }

  /**
   * 비어있는지 확인
   */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /**
   * 모든 요소 삭제
   */
  clear(): void {
    for (let i = 0; i < this._size; i++) {
      this.data[i] = undefined as any;
    }
    this._size = 0;
    // 용량도 초기값으로 리셋
    if (this._capacity > this.INITIAL_CAPACITY) {
      this._capacity = this.INITIAL_CAPACITY;
      this.data = new Array(this._capacity);
    }
  }

  /**
   * 용량 명시적 설정 (최소 현재 크기 이상이어야 함)
   */
  reserve(newCapacity: number): void {
    if (newCapacity < this._size) {
      throw new Error(
        `Reserve capacity ${newCapacity} is less than current size ${this._size}`
      );
    }
    if (newCapacity !== this._capacity) {
      this.resize(newCapacity);
    }
  }

  /**
   * 배열을 일반 배열로 변환
   */
  toArray(): T[] {
    return this.data.slice(0, this._size);
  }

  /**
   * Iterator 지원
   */
  *[Symbol.iterator](): IterableIterator<T> {
    for (let i = 0; i < this._size; i++) {
      yield this.data[i];
    }
  }

  /**
   * 메모리 사용량 정보 (디버깅용)
   */
  getMemoryInfo(): { size: number; capacity: number; wastedCapacity: number } {
    return {
      size: this._size,
      capacity: this._capacity,
      wastedCapacity: this._capacity - this._size,
    };
  }

  /**
   * 프라이빗: 배열 확장 (용량 증가)
   * Growth factor: 1.5x
   */
  private grow(): void {
    const newCapacity = Math.ceil(this._capacity * this.GROWTH_FACTOR);
    this.resize(newCapacity);
  }

  /**
   * 프라이빗: 배열 축소 (메모리 해제)
   */
  private shrink(): void {
    // 현재 크기가 capacity/4 이하일 때만 축소
    if (this._size > this._capacity / this.SHRINK_THRESHOLD) {
      return; // 축소 조건 불만족
    }

    const newCapacity = Math.max(
      this.INITIAL_CAPACITY,
      Math.ceil(this._size * this.SHRINK_THRESHOLD)
    );

    if (newCapacity < this._capacity) {
      this.resize(newCapacity);
    }
  }

  /**
   * 프라이빗: 배열 리사이징
   */
  private resize(newCapacity: number): void {
    if (newCapacity === this._capacity) {
      return;
    }

    const newData = new Array(newCapacity);

    // 기존 데이터 복사
    const copySize = Math.min(this._size, newCapacity);
    for (let i = 0; i < copySize; i++) {
      newData[i] = this.data[i];
    }

    this.data = newData;
    this._capacity = newCapacity;

    // 용량 축소로 인한 크기 조정
    if (this._size > this._capacity) {
      this._size = this._capacity;
    }
  }
}

/**
 * 정적 팩토리 메서드
 */
export function createDynamicArray<T>(
  initialCapacity?: number
): DynamicArray<T> {
  return new DynamicArray(initialCapacity);
}

/**
 * 배열을 DynamicArray로 변환
 */
export function toDynamicArray<T>(array: T[]): DynamicArray<T> {
  const da = new DynamicArray<T>(array.length * 2);
  for (const item of array) {
    da.append(item);
  }
  return da;
}
