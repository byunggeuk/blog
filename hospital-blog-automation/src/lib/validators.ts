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

/**
 * HTML 블로그 글이 구조 규칙을 준수하는지 검증한다.
 */
export function validateHtmlBlogStructure(content: string): StructureValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 제목 검증: h1 태그 정확히 1개
  const h1Matches = content.match(/<h1[^>]*>.*?<\/h1>/gi) || [];
  if (h1Matches.length !== 1) {
    errors.push(`제목(<h1>)이 ${h1Matches.length}개입니다 (1개여야 함)`);
  } else {
    const titleContent = h1Matches[0].replace(/<[^>]+>/g, "");
    if (!titleContent.includes(",")) {
      errors.push('제목에 쉼표(,)가 없습니다 ("타겟키워드, 부제" 형태여야 함)');
    }
  }

  // 2. 소제목(인용구 블록) 검증: quote-block 정확히 6개
  const quoteBlockMatches = content.match(/<div class="quote-block">/gi) || [];
  if (quoteBlockMatches.length !== 6) {
    errors.push(
      `소제목(quote-block)이 ${quoteBlockMatches.length}개입니다 (정확히 6개여야 함)`,
    );
  }

  // 3. 본문 문단 검증
  const bodyTextMatches = content.match(/<p class="body-text">/gi) || [];
  if (bodyTextMatches.length < 14) {
    warnings.push(
      `본문 문단(body-text)이 ${bodyTextMatches.length}개입니다 (최소 14개 권장)`,
    );
  }

  // 4. 금지된 태그 검증
  const forbiddenTags = [
    { tag: /<h[2-6][^>]*>/gi, name: "h2~h6" },
    { tag: /<ul[^>]*>/gi, name: "ul" },
    { tag: /<ol[^>]*>/gi, name: "ol" },
    { tag: /<li[^>]*>/gi, name: "li" },
    { tag: /<table[^>]*>/gi, name: "table" },
  ];

  for (const { tag, name } of forbiddenTags) {
    const matches = content.match(tag) || [];
    if (matches.length > 0) {
      errors.push(`금지된 태그 <${name}>이 ${matches.length}개 발견됨`);
    }
  }

  // 5. 마크다운 문법 혼용 검증
  if (/^#{1,6}\s+/m.test(content)) {
    errors.push("마크다운 제목 문법(#)이 발견됨 (HTML만 사용해야 함)");
  }
  if (/^\s*[-*]\s+/m.test(content)) {
    errors.push("마크다운 리스트 문법(-, *)이 발견됨");
  }
  if (/^>\s+/m.test(content)) {
    errors.push("마크다운 인용문 문법(>)이 발견됨");
  }

  // 6. 서식 태그 검증
  const redBoldMatches = content.match(/<span class="red-bold">/gi) || [];
  const highlightMatches = content.match(/<span class="highlight">/gi) || [];

  if (redBoldMatches.length === 0 && highlightMatches.length === 0) {
    warnings.push("색상 강조(red-bold 또는 highlight)가 하나도 없습니다");
  }
  if (redBoldMatches.length + highlightMatches.length < 6) {
    warnings.push(
      `색상 강조가 ${redBoldMatches.length + highlightMatches.length}개입니다 (섹션당 1개 이상 권장)`,
    );
  }

  // 7. 사진 위치 검증
  const imgPlaceholders = content.match(/<div class="img-placeholder">/gi) || [];
  if (imgPlaceholders.length === 0) {
    warnings.push("사진 위치 표시(img-placeholder)가 없습니다");
  } else if (imgPlaceholders.length < 6) {
    warnings.push(
      `사진 위치가 ${imgPlaceholders.length}개입니다 (섹션당 1개씩 권장)`,
    );
  }

  // 8. 링크 검증
  const linkBlocks = content.match(/<p class="link-block">/gi) || [];
  if (linkBlocks.length === 0) {
    warnings.push("링크 블록(link-block)이 없습니다");
  }

  // 9. 분량 검증
  const textOnly = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (textOnly.length < 2000) {
    warnings.push(
      `본문 분량이 ${textOnly.length}자로 부족합니다 (최소 2,000자)`,
    );
  }
  if (textOnly.length > 3500) {
    warnings.push(
      `본문 분량이 ${textOnly.length}자로 초과합니다 (최대 3,000자)`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
