/**
 * FreeLang v2 - 텍스트 정규화 엔진
 * 사용자 입력을 의도 분석 가능한 토큰으로 변환
 */

export class TextNormalizer {
  /**
   * 입력 텍스트를 정규화된 토큰 배열로 변환
   *
   * 처리 단계:
   * 1. 공백 정리 (앞/뒤 제거, 중복 제거)
   * 2. 특수문자 제거 (괄호, 기호 등)
   * 3. 한글/영문 분리 (연속된 문자 유지)
   * 4. 토큰화 (공백 기준 분할)
   * 5. 불필요한 토큰 제거 (숫자만의 토큰)
   *
   * @param input 사용자 입력 텍스트
   * @returns 정규화된 토큰 배열
   */
  static normalize(input: string): string[] {
    if (!input || typeof input !== 'string') {
      return [];
    }

    // Step 1: 공백 정리
    let text = input.trim().replace(/\s+/g, ' ');

    // Step 2: 특수문자 제거 (한글, 영문, 숫자, 공백만 유지)
    text = text.replace(/[^가-힣a-zA-Z0-9\s]/g, '');

    // Step 2.5: 영문과 숫자 분리 (sum123 → sum 123)
    text = text.replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/(\d)([a-zA-Z])/g, '$1 $2');

    // Step 3: 공백 기준으로 토큰 분할
    const tokens = text.split(/\s+/).filter(t => t.length > 0);

    // Step 4: 한글 조사/어미 제거 (을, 는, 이, 를, 에서, 에, 와, 고, 지만, 영, 링)
    const processed = tokens.map(token => {
      // 한글만 있는 토큰에서 조사/어미 제거
      const match = token.match(/^(.*?)(을|는|이|를|에서|에|와|고|지만|영|링)$/);
      return match ? match[1] : token;
    });

    // Step 5: 불필요한 토큰 필터링
    const filtered = processed.filter(token => {
      if (!token) return false;
      // 순수 숫자만 제거
      if (/^\d+$/.test(token)) {
        return false;
      }
      // 길이 1인 한글 제거 (중요한 것 제외)
      if (token.length === 1 && /^[가-힣]$/.test(token)) {
        const important = ['배', '수', '큐', '스', '정'];
        return important.includes(token);
      }
      return true;
    });

    // Step 6: 영문 소문자로 통일
    return filtered.map(t => t.toLowerCase());
  }

  /**
   * 키워드 정확 매칭 확인
   * normalize(input)의 토큰이 keywords에 포함되는지 확인
   *
   * @param tokens 정규화된 토큰 배열
   * @param keywords 매칭 대상 키워드 배열
   * @returns 매칭된 키워드 개수
   */
  static countMatches(tokens: string[], keywords: string[]): number {
    const keywordSet = new Set(keywords.map(k => k.toLowerCase()));
    return tokens.filter(token => keywordSet.has(token)).length;
  }

  /**
   * Levenshtein 거리 기반 유사도 계산
   * 정확 매칭되지 않지만 유사한 키워드 발견용
   *
   * @param str1 첫 번째 문자열
   * @param str2 두 번째 문자열
   * @returns 유사도 점수 (0~1, 1이 같음)
   */
  static similarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;

    const len1 = s1.length;
    const len2 = s2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1;

    // Levenshtein 거리 계산 (간단한 버전)
    const distance = this._levenshteinDistance(s1, s2);
    return 1 - distance / maxLen;
  }

  /**
   * Levenshtein 거리 (편집 거리) 계산
   * @private
   */
  private static _levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;

    // DP 테이블 초기화
    const dp: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // 첫 번째 행/열 초기화
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    // DP 계산
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[len1][len2];
  }
}
