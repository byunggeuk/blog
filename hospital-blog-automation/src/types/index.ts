// 병원 설정 타입
export interface Hospital {
  hospital_id: string;
  hospital_name: string;
  blog_url?: string;
  reference_folder_id?: string;
  output_folder_id?: string;
  prompt_name?: string; // 시트에 표시할 짧은 프롬프트 이름
  system_prompt: string; // 전체 시스템 프롬프트
  created_at: string;
  is_active: boolean;
}

// 요청 상태 타입
export type RequestStatus =
  | '대기'
  | '생성중'
  | '완료'
  | '수정요청'
  | '수정완료'
  | '에러'
  | '업로드완료';

// 글 구조 타입
export type FormatType =
  | 'Q&A형'
  | '정보제공형'
  | '치료과정 안내형'
  | '비교분석형'
  | '팩트체크형'
  | '칼럼형'
  | '기타'
  // 레거시 타입 (기존 데이터 호환용)
  | '사례/스토리텔링형'
  | '실패분석형'
  | '치료과정 시뮬레이션형';

// 채팅 메시지 역할
export type ChatRole = 'user' | 'assistant' | 'system';

// 채팅 메시지 타입
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  created_at: string;
  // AI 응답의 경우 생성된 문서 정보
  doc_url?: string;
  doc_id?: string;
}

// 글 요청 타입
export interface BlogRequest {
  request_id: string;
  created_at: string;
  hospital_id: string;
  hospital_name: string;
  target_keyword: string;
  topic_keyword: string;
  purpose: string;
  format_type: FormatType;
  format_custom?: string;
  status: RequestStatus;
  result_doc_id?: string;
  result_doc_url?: string;
  revision_request?: string;
  revision_count: number;
  completed_at?: string;
  created_by: string;
  // 채팅 히스토리
  chat_history: ChatMessage[];
}

// 새 글 요청 폼 데이터
export interface NewRequestFormData {
  hospital_id: string;
  target_keyword: string;
  topic_keyword: string;
  purpose: string;
  format_type: FormatType;
  format_custom?: string;
}

// 사용자 상태 타입
export type UserStatus = 'pending' | 'approved' | 'blocked';

// 사용자 정보
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user';
  status: UserStatus;
  slack_member_id?: string; // Slack 개인 알림용
  created_at: string;
  approved_at?: string;
  blocked_at?: string;
}

// 회원가입 폼 데이터
export interface SignUpFormData {
  email: string;
  name: string;
}
