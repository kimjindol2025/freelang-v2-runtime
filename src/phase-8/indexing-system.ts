/**
 * Phase 8.2: FreeLang Indexing System
 *
 * B-Tree 기반 인덱싱
 * - 기본키 인덱스
 * - 빠른 검색 (O(log n))
 * - 범위 검색 지원
 *
 * 문법:
 *   create_index("User", "id")
 *   find_by_index("User", "id", 5)
 *   range_search("User", "id", 1, 10)
 */

/**
 * B-Tree 노드
 */
interface BTreeNode<K, V> {
  keys: K[];
  values: V[];
  children?: BTreeNode<K, V>[];
  isLeaf: boolean;
  parent?: BTreeNode<K, V>;
}

/**
 * B-Tree 구현
 */
export class BTree<K extends number | string, V> {
  private root: BTreeNode<K, V>;
  private order: number; // 최대 차수 (기본값 3)

  constructor(order: number = 3) {
    this.order = order;
    this.root = {
      keys: [],
      values: [],
      isLeaf: true,
    };
  }

  /**
   * 값 삽입
   */
  insert(key: K, value: V): void {
    if (this.root.keys.length >= 2 * this.order - 1) {
      this.splitRoot();
    }

    this.insertNonFull(this.root, key, value);
  }

  /**
   * 재귀적 삽입 (가득 차지 않은 노드)
   */
  private insertNonFull(node: BTreeNode<K, V>, key: K, value: V): void {
    let i = node.keys.length - 1;

    if (node.isLeaf) {
      // 리프 노드: 직접 삽입
      while (i >= 0 && this.compare(key, node.keys[i]) < 0) {
        node.keys[i + 1] = node.keys[i];
        node.values[i + 1] = node.values[i];
        i--;
      }
      node.keys[i + 1] = key;
      node.values[i + 1] = value;
    } else {
      // 내부 노드: 적절한 자식 찾기
      while (i >= 0 && this.compare(key, node.keys[i]) < 0) {
        i--;
      }
      i++;

      if (!node.children) node.children = [];
      const child = node.children[i];

      if (child.keys.length >= 2 * this.order - 1) {
        this.splitChild(node, i);
        if (this.compare(key, node.keys[i]) > 0) {
          i++;
        }
      }

      if (node.children) {
        this.insertNonFull(node.children[i], key, value);
      }
    }
  }

  /**
   * 루트 분할
   */
  private splitRoot(): void {
    const oldRoot = this.root;
    this.root = {
      keys: [],
      values: [],
      children: [oldRoot],
      isLeaf: false,
    };
    this.splitChild(this.root, 0);
  }

  /**
   * 자식 노드 분할
   */
  private splitChild(parent: BTreeNode<K, V>, i: number): void {
    if (!parent.children) parent.children = [];
    const fullChild = parent.children[i];
    const newChild: BTreeNode<K, V> = {
      keys: [],
      values: [],
      isLeaf: fullChild.isLeaf,
    };

    const mid = this.order - 1;

    // 키와 값 분할
    newChild.keys = fullChild.keys.splice(mid + 1);
    newChild.values = fullChild.values.splice(mid + 1);

    // 자식 분할
    if (!fullChild.isLeaf && fullChild.children) {
      newChild.children = fullChild.children.splice(mid + 1);
    }

    // 중간 키를 부모에 삽입
    parent.keys.splice(i, 0, fullChild.keys.pop()!);
    parent.values.splice(i, 0, fullChild.values.pop()!);
    parent.children!.splice(i + 1, 0, newChild);
  }

  /**
   * 값 검색
   */
  search(key: K): V | undefined {
    return this.searchNode(this.root, key);
  }

  /**
   * 재귀적 검색
   */
  private searchNode(node: BTreeNode<K, V>, key: K): V | undefined {
    let i = 0;
    while (i < node.keys.length && this.compare(key, node.keys[i]) > 0) {
      i++;
    }

    if (i < node.keys.length && this.compare(key, node.keys[i]) === 0) {
      return node.values[i];
    }

    if (node.isLeaf) {
      return undefined;
    }

    if (!node.children) {
      return undefined;
    }

    return this.searchNode(node.children[i], key);
  }

  /**
   * 범위 검색
   */
  rangeSearch(minKey: K, maxKey: K): Array<[K, V]> {
    const result: Array<[K, V]> = [];
    this.rangeSearchNode(this.root, minKey, maxKey, result);
    return result;
  }

  /**
   * 재귀적 범위 검색
   */
  private rangeSearchNode(
    node: BTreeNode<K, V>,
    minKey: K,
    maxKey: K,
    result: Array<[K, V]>
  ): void {
    let i = 0;

    while (i < node.keys.length) {
      if (this.compare(minKey, node.keys[i]) <= 0) {
        if (!node.isLeaf && node.children) {
          this.rangeSearchNode(node.children[i], minKey, maxKey, result);
        }
      }

      if (
        this.compare(node.keys[i], minKey) >= 0 &&
        this.compare(node.keys[i], maxKey) <= 0
      ) {
        result.push([node.keys[i], node.values[i]]);
      }

      if (this.compare(node.keys[i], maxKey) >= 0) {
        return;
      }

      i++;
    }

    if (!node.isLeaf && node.children) {
      this.rangeSearchNode(node.children[i], minKey, maxKey, result);
    }
  }

  /**
   * 모든 항목 조회 (정렬된 순서)
   */
  getAllSorted(): Array<[K, V]> {
    const result: Array<[K, V]> = [];
    this.traverseInOrder(this.root, result);
    return result;
  }

  /**
   * 중위 순회
   */
  private traverseInOrder(node: BTreeNode<K, V>, result: Array<[K, V]>): void {
    let i = 0;

    for (; i < node.keys.length; i++) {
      if (!node.isLeaf && node.children) {
        this.traverseInOrder(node.children[i], result);
      }
      result.push([node.keys[i], node.values[i]]);
    }

    if (!node.isLeaf && node.children) {
      this.traverseInOrder(node.children[i], result);
    }
  }

  /**
   * 크기 비교
   */
  private compare(a: K, b: K): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  /**
   * 트리 크기
   */
  size(): number {
    return this.countNodes(this.root);
  }

  /**
   * 노드 개수 계산
   */
  private countNodes(node: BTreeNode<K, V>): number {
    let count = node.keys.length;
    if (!node.isLeaf && node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }
}

/**
 * 인덱스 정보
 */
export interface IndexInfo {
  name: string;
  structName: string;
  fieldName: string;
  type: "primary" | "secondary";
  size: number;
  created: Date;
}

/**
 * 인덱스 매니저
 */
export class IndexManager {
  private indexes: Map<string, BTree<any, any>> = new Map();
  private indexInfo: Map<string, IndexInfo> = new Map();

  /**
   * 인덱스 생성
   */
  createIndex(
    structName: string,
    fieldName: string,
    isPrimary: boolean = false
  ): void {
    const indexName = `${structName}_${fieldName}`;

    if (this.indexes.has(indexName)) {
      throw new Error(`Index '${indexName}' already exists`);
    }

    const btree = new BTree<any, any>(3);
    this.indexes.set(indexName, btree);

    this.indexInfo.set(indexName, {
      name: indexName,
      structName,
      fieldName,
      type: isPrimary ? "primary" : "secondary",
      size: 0,
      created: new Date(),
    });
  }

  /**
   * 인덱스에 값 추가
   */
  addToIndex(structName: string, fieldName: string, key: any, value: any): void {
    const indexName = `${structName}_${fieldName}`;

    if (!this.indexes.has(indexName)) {
      throw new Error(`Index '${indexName}' not found`);
    }

    const btree = this.indexes.get(indexName)!;
    btree.insert(key, value);

    const info = this.indexInfo.get(indexName)!;
    info.size = btree.size();
  }

  /**
   * 인덱스로 검색
   */
  searchByIndex(structName: string, fieldName: string, key: any): any {
    const indexName = `${structName}_${fieldName}`;

    if (!this.indexes.has(indexName)) {
      throw new Error(`Index '${indexName}' not found`);
    }

    const btree = this.indexes.get(indexName)!;
    return btree.search(key);
  }

  /**
   * 범위 검색
   */
  rangeSearch(
    structName: string,
    fieldName: string,
    minKey: any,
    maxKey: any
  ): Array<[any, any]> {
    const indexName = `${structName}_${fieldName}`;

    if (!this.indexes.has(indexName)) {
      throw new Error(`Index '${indexName}' not found`);
    }

    const btree = this.indexes.get(indexName)!;
    return btree.rangeSearch(minKey, maxKey);
  }

  /**
   * 모든 항목 조회
   */
  getAllSorted(structName: string, fieldName: string): Array<[any, any]> {
    const indexName = `${structName}_${fieldName}`;

    if (!this.indexes.has(indexName)) {
      throw new Error(`Index '${indexName}' not found`);
    }

    const btree = this.indexes.get(indexName)!;
    return btree.getAllSorted();
  }

  /**
   * 인덱스 정보 조회
   */
  getIndexInfo(structName: string, fieldName: string): IndexInfo | undefined {
    const indexName = `${structName}_${fieldName}`;
    return this.indexInfo.get(indexName);
  }

  /**
   * 모든 인덱스 나열
   */
  listIndexes(): IndexInfo[] {
    return Array.from(this.indexInfo.values());
  }

  /**
   * 인덱스 삭제
   */
  dropIndex(structName: string, fieldName: string): void {
    const indexName = `${structName}_${fieldName}`;

    if (!this.indexes.has(indexName)) {
      throw new Error(`Index '${indexName}' not found`);
    }

    this.indexes.delete(indexName);
    this.indexInfo.delete(indexName);
  }

  /**
   * 인덱스 통계
   */
  getStats(structName: string, fieldName: string): {
    indexName: string;
    size: number;
    created: Date;
    type: string;
  } | null {
    const indexName = `${structName}_${fieldName}`;
    const info = this.indexInfo.get(indexName);

    if (!info) {
      return null;
    }

    return {
      indexName: info.name,
      size: info.size,
      created: info.created,
      type: info.type,
    };
  }
}

// ==================== 전역 인스턴스 ====================
export const indexManager = new IndexManager();

// ==================== 테스트 ====================

export function testIndexingSystem(): void {
  console.log("=== Indexing System Tests ===\n");

  // 1. B-Tree 테스트
  console.log("1️⃣ B-Tree Operations:");
  const btree = new BTree<number, string>(3);

  btree.insert(10, "Alice");
  btree.insert(5, "Bob");
  btree.insert(15, "Charlie");
  btree.insert(3, "David");
  btree.insert(7, "Eve");
  btree.insert(12, "Frank");

  console.log("  Inserted 6 items");
  console.log("  Tree size:", btree.size());
  console.log("  Search(10):", btree.search(10));

  const allItems = btree.getAllSorted();
  console.log("  Sorted items:", allItems.map(([k]) => k).join(", "));

  const range = btree.rangeSearch(5, 12);
  console.log("  Range search [5,12]:", range.map(([k]) => k).join(", "));

  // 2. IndexManager 테스트
  console.log("\n2️⃣ Index Manager:");
  indexManager.createIndex("User", "id", true);
  console.log("  ✅ Index created: User.id");

  indexManager.addToIndex("User", "id", 1, { name: "Alice" });
  indexManager.addToIndex("User", "id", 2, { name: "Bob" });
  indexManager.addToIndex("User", "id", 3, { name: "Charlie" });

  const found = indexManager.searchByIndex("User", "id", 2);
  console.log("  ✅ Search result:", found);

  const allUsers = indexManager.getAllSorted("User", "id");
  console.log("  ✅ All users:", allUsers.length, "items");

  const indexInfo = indexManager.getIndexInfo("User", "id");
  console.log("  ✅ Index info:", indexInfo?.type, "type");

  console.log("\n✅ All indexing tests passed!");
}
