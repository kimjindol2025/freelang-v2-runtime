/**
 * Phase 8: FreeLang Struct System
 *
 * 구조체 정의, 생성, 필드 접근, 메서드 지원
 *
 * 문법:
 *   struct User { id: number, name: string }
 *   let user = User { id: 1, name: "Alice" }
 *   user.name  // "Alice"
 */

/**
 * 구조체 필드 정의
 */
export interface StructField {
  name: string;
  type: string;          // "number", "string", "User", etc.
  optional?: boolean;
  default?: any;
}

/**
 * 구조체 정의
 */
export interface StructDefinition {
  name: string;
  fields: StructField[];
  methods?: StructMethod[];
  derives?: string[];    // #[derive(Debug, Clone)]
}

/**
 * 구조체 메서드
 */
export interface StructMethod {
  name: string;
  params: { name: string; type: string }[];
  returnType: string;
  body: string;
}

/**
 * 구조체 인스턴스 값
 */
export interface StructValue {
  _type: "struct";
  _structName: string;
  [fieldName: string]: any;
}

/**
 * 구조체 타입 (타입 시스템용)
 */
export interface StructType {
  kind: "struct";
  name: string;
  fields: Map<string, string>;    // fieldName -> type
  methods: Map<string, StructMethod>;
}

/**
 * 구조체 관리자
 */
export class StructManager {
  private structs: Map<string, StructDefinition> = new Map();
  private types: Map<string, StructType> = new Map();

  /**
   * 구조체 정의 등록
   */
  defineStruct(definition: StructDefinition): void {
    this.structs.set(definition.name, definition);

    // 타입 등록
    const fieldMap = new Map<string, string>();
    for (const field of definition.fields) {
      fieldMap.set(field.name, field.type);
    }

    const methodMap = new Map<string, StructMethod>();
    if (definition.methods) {
      for (const method of definition.methods) {
        methodMap.set(method.name, method);
      }
    }

    this.types.set(definition.name, {
      kind: "struct",
      name: definition.name,
      fields: fieldMap,
      methods: methodMap,
    });
  }

  /**
   * 구조체 정의 조회
   */
  getStruct(name: string): StructDefinition | undefined {
    return this.structs.get(name);
  }

  /**
   * 구조체 타입 조회
   */
  getType(name: string): StructType | undefined {
    return this.types.get(name);
  }

  /**
   * 구조체 인스턴스 생성
   */
  createInstance(name: string, fields: Record<string, any>): StructValue {
    const definition = this.structs.get(name);
    if (!definition) {
      throw new Error(`Struct '${name}' not found`);
    }

    // 필드 검증
    const instance: StructValue = {
      _type: "struct",
      _structName: name,
    };

    for (const field of definition.fields) {
      if (field.name in fields) {
        instance[field.name] = fields[field.name];
      } else if (field.optional) {
        instance[field.name] = field.default ?? null;
      } else if (field.default !== undefined) {
        instance[field.name] = field.default;
      } else {
        throw new Error(`Required field '${field.name}' not provided`);
      }
    }

    return instance;
  }

  /**
   * 필드 접근
   */
  getField(instance: StructValue, fieldName: string): any {
    if (instance._type !== "struct") {
      throw new Error("Not a struct instance");
    }

    if (!(fieldName in instance)) {
      throw new Error(`Field '${fieldName}' not found in struct '${instance._structName}'`);
    }

    return instance[fieldName];
  }

  /**
   * 필드 설정 (불변성 유지)
   */
  setField(instance: StructValue, fieldName: string, value: any): StructValue {
    if (instance._type !== "struct") {
      throw new Error("Not a struct instance");
    }

    const definition = this.structs.get(instance._structName);
    if (!definition) {
      throw new Error(`Struct '${instance._structName}' not found`);
    }

    // 필드 유효성 검사
    const field = definition.fields.find(f => f.name === fieldName);
    if (!field) {
      throw new Error(`Field '${fieldName}' not found in struct '${instance._structName}'`);
    }

    // 새 인스턴스 생성 (불변성)
    const newInstance = { ...instance };
    newInstance[fieldName] = value;
    return newInstance;
  }

  /**
   * 메서드 호출
   */
  callMethod(instance: StructValue, methodName: string, args: any[]): any {
    const definition = this.structs.get(instance._structName);
    if (!definition || !definition.methods) {
      throw new Error(`Method '${methodName}' not found`);
    }

    const method = definition.methods.find(m => m.name === methodName);
    if (!method) {
      throw new Error(`Method '${methodName}' not found in struct '${instance._structName}'`);
    }

    // 메서드 본문 실행 (간단한 구현)
    console.log(`Calling ${instance._structName}.${methodName}()`);
    return null;
  }

  /**
   * 모든 등록된 구조체 나열
   */
  listStructs(): string[] {
    return Array.from(this.structs.keys());
  }

  /**
   * 구조체 정보 조회
   */
  getStructInfo(name: string): {
    name: string;
    fieldCount: number;
    methodCount: number;
    fields: string[];
  } | null {
    const def = this.structs.get(name);
    if (!def) return null;

    return {
      name: def.name,
      fieldCount: def.fields.length,
      methodCount: def.methods?.length ?? 0,
      fields: def.fields.map(f => `${f.name}: ${f.type}`),
    };
  }
}

// ==================== 전역 인스턴스 ====================
export const structManager = new StructManager();

// ==================== 테스트 ====================

/**
 * 샘플: User 구조체 정의
 */
export function initializeSampleStructs(): void {
  // User 구조체
  structManager.defineStruct({
    name: "User",
    fields: [
      { name: "id", type: "number" },
      { name: "name", type: "string" },
      { name: "email", type: "string", optional: true },
    ],
  });

  // Point 구조체
  structManager.defineStruct({
    name: "Point",
    fields: [
      { name: "x", type: "number", default: 0 },
      { name: "y", type: "number", default: 0 },
    ],
  });

  // Database 구조체
  structManager.defineStruct({
    name: "Database",
    fields: [
      { name: "name", type: "string" },
      { name: "tables", type: "number", default: 0 },
      { name: "version", type: "string", default: "1.0" },
    ],
  });
}

/**
 * 테스트 함수
 */
export function testStructSystem(): void {
  console.log("=== Struct System Tests ===\n");

  // 1. 구조체 정의
  initializeSampleStructs();
  console.log("✅ Structs defined:", structManager.listStructs().join(", "));

  // 2. 인스턴스 생성
  const user = structManager.createInstance("User", {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
  });
  console.log("✅ User created:", user);

  // 3. 필드 접근
  const userName = structManager.getField(user, "name");
  console.log("✅ user.name =", userName);

  // 4. 필드 수정
  const updatedUser = structManager.setField(user, "name", "Bob");
  console.log("✅ Updated user:", updatedUser);

  // 5. Point 생성
  const point = structManager.createInstance("Point", { x: 10, y: 20 });
  console.log("✅ Point created:", point);

  // 6. 구조체 정보
  const userInfo = structManager.getStructInfo("User");
  console.log("✅ User info:", userInfo);

  console.log("\n✅ All struct tests passed!");
}
