/**
 * ════════════════════════════════════════════════════════════════════
 * Definition Provider
 *
 * "정의로 이동" 기능:
 * - 함수 정의 찾기
 * - 타입 정의 찾기
 * - trait 정의 찾기
 * - 변수 선언 찾기
 * ════════════════════════════════════════════════════════════════════
 */

import { Location, Range, Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * 정의 제공자
 */
export class DefinitionProvider {
  /**
   * 정의 위치 찾기
   */
  findDefinition(document: TextDocument, position: { line: number; character: number }): Location | null {
    try {
      const text = document.getText();
      const word = this.getWordAt(document, position);

      if (!word) return null;

      // 정의 검색
      const definition = this.searchDefinition(text, word);

      if (!definition) return null;

      return {
        uri: document.uri,
        range: definition.range
      };
    } catch (e) {
      console.error(`Definition error: ${e}`);
      return null;
    }
  }

  /**
   * 정의 검색
   */
  private searchDefinition(text: string, word: string): { range: Range; type: string } | null {
    const lines = text.split('\n');

    // 1. 함수 정의: fn functionName(...)
    const fnDef = this.findFunctionDefinition(lines, word);
    if (fnDef) return fnDef;

    // 2. 변수 선언: let varName : Type
    const varDef = this.findVariableDefinition(lines, word);
    if (varDef) return varDef;

    // 3. 타입 정의: type TypeName = ...
    const typeDef = this.findTypeDefinition(lines, word);
    if (typeDef) return typeDef;

    // 4. Trait 정의: trait TraitName { ... }
    const traitDef = this.findTraitDefinition(lines, word);
    if (traitDef) return traitDef;

    // 5. Impl 블록: impl TraitName for Type { ... }
    const implDef = this.findImplDefinition(lines, word);
    if (implDef) return implDef;

    return null;
  }

  /**
   * 함수 정의 찾기
   */
  private findFunctionDefinition(lines: string[], funcName: string): { range: Range; type: string } | null {
    const pattern = new RegExp(`\\bfn\\s+${funcName}\\s*\\(`, 'i');

    for (let i = 0; i < lines.length; i++) {
      const match = pattern.exec(lines[i]);
      if (match) {
        const startPos = match.index + match[0].indexOf(funcName);
        return {
          range: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + funcName.length)
          ),
          type: 'function'
        };
      }
    }

    return null;
  }

  /**
   * 변수 선언 찾기
   */
  private findVariableDefinition(lines: string[], varName: string): { range: Range; type: string } | null {
    const pattern = new RegExp(`\\blet\\s+${varName}\\b`);

    for (let i = 0; i < lines.length; i++) {
      const match = pattern.exec(lines[i]);
      if (match) {
        const startPos = match.index + match[0].indexOf(varName);
        return {
          range: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + varName.length)
          ),
          type: 'variable'
        };
      }
    }

    return null;
  }

  /**
   * 타입 정의 찾기
   */
  private findTypeDefinition(lines: string[], typeName: string): { range: Range; type: string } | null {
    const pattern = new RegExp(`\\btype\\s+${typeName}\\b`);

    for (let i = 0; i < lines.length; i++) {
      const match = pattern.exec(lines[i]);
      if (match) {
        const startPos = match.index + match[0].indexOf(typeName);
        return {
          range: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + typeName.length)
          ),
          type: 'type'
        };
      }
    }

    return null;
  }

  /**
   * Trait 정의 찾기
   */
  private findTraitDefinition(lines: string[], traitName: string): { range: Range; type: string } | null {
    const pattern = new RegExp(`\\btrait\\s+${traitName}\\b`);

    for (let i = 0; i < lines.length; i++) {
      const match = pattern.exec(lines[i]);
      if (match) {
        const startPos = match.index + match[0].indexOf(traitName);
        return {
          range: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + traitName.length)
          ),
          type: 'trait'
        };
      }
    }

    return null;
  }

  /**
   * Impl 정의 찾기
   */
  private findImplDefinition(lines: string[], implName: string): { range: Range; type: string } | null {
    const pattern = new RegExp(`\\bimpl\\s+${implName}\\b`);

    for (let i = 0; i < lines.length; i++) {
      const match = pattern.exec(lines[i]);
      if (match) {
        const startPos = match.index + match[0].indexOf(implName);
        return {
          range: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + implName.length)
          ),
          type: 'impl'
        };
      }
    }

    return null;
  }

  /**
   * 위치의 단어 추출
   */
  private getWordAt(document: TextDocument, position: { line: number; character: number }): string | null {
    try {
      const text = document.getText();
      const offset = document.offsetAt(position);

      let start = offset;
      let end = offset;

      // 단어 경계 찾기
      while (start > 0 && /\w/.test(text[start - 1])) start--;
      while (end < text.length && /\w/.test(text[end])) end++;

      if (start === end) return null;

      return text.substring(start, end);
    } catch (e) {
      return null;
    }
  }
}

/**
 * 고급 정의 프로바이더 (여러 위치 반환)
 */
export class AdvancedDefinitionProvider extends DefinitionProvider {
  /**
   * 모든 정의 찾기 (오버로드된 함수 등)
   */
  findAllDefinitions(
    document: TextDocument,
    position: { line: number; character: number }
  ): Location[] {
    const locations: Location[] = [];

    try {
      const text = document.getText();
      const word = this.getWordAtPublic(document, position);

      if (!word) return [];

      const lines = text.split('\n');

      // 모든 함수 정의 찾기
      this.findAllFunctions(lines, word, document.uri, locations);

      // 모든 변수 정의 찾기
      this.findAllVariables(lines, word, document.uri, locations);

      // Trait 정의 찾기
      this.findAllTraits(lines, word, document.uri, locations);

      return locations;
    } catch (e) {
      console.error(`Advanced definition error: ${e}`);
      return [];
    }
  }

  /**
   * 모든 함수 찾기
   */
  private findAllFunctions(
    lines: string[],
    funcName: string,
    uri: string,
    locations: Location[]
  ): void {
    const pattern = new RegExp(`\\bfn\\s+${funcName}\\s*\\(`, 'gi');

    for (let i = 0; i < lines.length; i++) {
      let match;
      const lineText = lines[i];

      // 정규식 리셋
      pattern.lastIndex = 0;

      while ((match = pattern.exec(lineText)) !== null) {
        const startPos = match.index + match[0].indexOf(funcName);
        locations.push({
          uri,
          range: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + funcName.length)
          )
        });
      }
    }
  }

  /**
   * 모든 변수 찾기
   */
  private findAllVariables(
    lines: string[],
    varName: string,
    uri: string,
    locations: Location[]
  ): void {
    const pattern = new RegExp(`\\blet\\s+${varName}\\b`, 'gi');

    for (let i = 0; i < lines.length; i++) {
      let match;
      const lineText = lines[i];
      pattern.lastIndex = 0;

      while ((match = pattern.exec(lineText)) !== null) {
        const startPos = match.index + match[0].indexOf(varName);
        locations.push({
          uri,
          range: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + varName.length)
          )
        });
      }
    }
  }

  /**
   * 모든 trait 찾기
   */
  private findAllTraits(
    lines: string[],
    traitName: string,
    uri: string,
    locations: Location[]
  ): void {
    const pattern = new RegExp(`\\btrait\\s+${traitName}\\b`, 'gi');

    for (let i = 0; i < lines.length; i++) {
      let match;
      const lineText = lines[i];
      pattern.lastIndex = 0;

      while ((match = pattern.exec(lineText)) !== null) {
        const startPos = match.index + match[0].indexOf(traitName);
        locations.push({
          uri,
          range: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + traitName.length)
          )
        });
      }
    }
  }

  /**
   * 공개 메서드: 위치의 단어 추출
   */
  private getWordAtPublic(
    document: TextDocument,
    position: { line: number; character: number }
  ): string | null {
    return (this as any).getWordAt(document, position);
  }
}
