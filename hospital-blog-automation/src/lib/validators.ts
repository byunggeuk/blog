export interface StructureValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 생성된 블로그 글이 불변 구조 규칙(PRD §0)을 준수하는지 검증한다.
 */
export function validateBlogStructure(content: string): StructureValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 대제목 검증: ## 으로 시작하는 줄이 정확히 1개, 쉼표 포함
  const h2Matches = content.match(/^## .+$/gm) || [];
  if (h2Matches.length !== 1) {
    errors.push(`대제목(##)이 ${h2Matches.length}개입니다 (1개여야 함)`);
  } else if (!h2Matches[0].includes(",")) {
    errors.push('대제목에 쉼표(,)가 없습니다 ("타겟키워드, 부제" 형태여야 함)');
  }

  // 2. 소제목 검증: ### 정확히 6개
  const h3Matches = content.match(/^### .+$/gm) || [];
  if (h3Matches.length !== 6) {
    errors.push(
      `소제목(###)이 ${h3Matches.length}개입니다 (정확히 6개여야 함)`,
    );
  }

  // 3. 소제목 질문형 검증
  for (const h3 of h3Matches) {
    const title = h3.replace(/^### /, "");
    if (!title.includes("?")) {
      warnings.push(`소제목이 질문형이 아닐 수 있습니다: "${title}"`);
    }
  }

  // 4. 하위 소제목 금지: #### 이상 없어야 함
  const h4Matches = content.match(/^#{4,} .+$/gm) || [];
  if (h4Matches.length > 0) {
    errors.push(`하위 소제목(####)이 ${h4Matches.length}개 발견됨 (금지)`);
  }

  // 5. 리스트 형식 금지
  const bulletMatches = content.match(/^[\s]*[-*]\s+.+$/gm) || [];
  const numListMatches = content.match(/^[\s]*\d+[.)]\s+.+$/gm) || [];
  if (bulletMatches.length > 0) {
    errors.push(`글머리 기호(-, *)가 ${bulletMatches.length}줄 발견됨 (금지)`);
  }
  if (numListMatches.length > 0) {
    errors.push(`번호 리스트가 ${numListMatches.length}줄 발견됨 (금지)`);
  }

  // 6. 볼드 항목명 패턴 감지: 줄 시작이 **텍스트** 인 경우
  const boldItemMatches = content.match(/^\*\*.+?\*\*/gm) || [];
  if (boldItemMatches.length > 0) {
    errors.push(`볼드 항목명 패턴이 ${boldItemMatches.length}줄 발견됨 (금지)`);
  }

  // 7. 인용문 금지
  const quoteMatches = content.match(/^>\s+.+$/gm) || [];
  if (quoteMatches.length > 0) {
    errors.push(`인용문(>)이 ${quoteMatches.length}줄 발견됨 (금지)`);
  }

  // 8. 분량 검증 (제목/소제목 제외한 본문만)
  const bodyText = content.replace(/^#{1,6} .+$/gm, "").trim();
  if (bodyText.length < 2000) {
    warnings.push(
      `본문 분량이 ${bodyText.length}자로 부족합니다 (최소 2,000자)`,
    );
  }
  if (bodyText.length > 3000) {
    warnings.push(
      `본문 분량이 ${bodyText.length}자로 초과합니다 (최대 3,000자)`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
