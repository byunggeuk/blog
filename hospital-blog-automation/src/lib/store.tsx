'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { BlogRequest, User, NewRequestFormData, SignUpFormData, UserStatus, ChatMessage } from '@/types';
import { mockRequests, mockCurrentUser, mockUsers, mockHospitals } from './mock-data';

// 인증 상태 타입
type AuthStatus = 'unauthenticated' | 'pending' | 'blocked' | 'authenticated';

interface AppState {
  user: User | null;
  users: User[]; // 전체 사용자 목록 (관리자용)
  requests: BlogRequest[];
  isLoading: boolean;
  authStatus: AuthStatus;
}

interface AppContextType extends AppState {
  // 인증 관련
  login: (asAdmin?: boolean) => void;
  logout: () => void;
  signUp: (data: SignUpFormData) => Promise<void>;

  // 사용자 관리 (관리자)
  approveUser: (userId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;

  // 요청 관련
  createRequest: (data: NewRequestFormData) => Promise<BlogRequest>;
  updateRequestStatus: (requestId: string, status: BlogRequest['status']) => void;
  sendMessage: (requestId: string, message: string) => void;
  refreshRequests: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    user: null,
    users: mockUsers,
    requests: mockRequests,
    isLoading: false,
    authStatus: 'unauthenticated',
  });

  // 로그인 (데모용: asAdmin true면 관리자로, false면 일반 사용자로)
  const login = useCallback((asAdmin: boolean = true) => {
    if (asAdmin) {
      setState((prev) => ({
        ...prev,
        user: mockCurrentUser,
        authStatus: 'authenticated',
      }));
    } else {
      const approvedUser = mockUsers.find(u => u.role === 'user' && u.status === 'approved');
      if (approvedUser) {
        setState((prev) => ({
          ...prev,
          user: approvedUser,
          authStatus: 'authenticated',
        }));
      }
    }
  }, []);

  const logout = useCallback(() => {
    setState((prev) => ({
      ...prev,
      user: null,
      authStatus: 'unauthenticated',
    }));
  }, []);

  // 회원가입
  const signUp = useCallback(async (data: SignUpFormData): Promise<void> => {
    const existingUser = state.users.find(u => u.email === data.email);
    if (existingUser) {
      throw new Error('이미 등록된 이메일입니다.');
    }

    const newUser: User = {
      id: `U${String(state.users.length + 1).padStart(3, '0')}`,
      email: data.email,
      name: data.name,
      role: 'user',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    await new Promise((resolve) => setTimeout(resolve, 500));

    setState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
      user: newUser,
      authStatus: 'pending',
    }));
  }, [state.users]);

  // 사용자 승인 (관리자)
  const approveUser = useCallback((userId: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId
          ? { ...u, status: 'approved' as UserStatus, approved_at: new Date().toISOString() }
          : u
      ),
    }));
  }, []);

  // 사용자 차단 (관리자)
  const blockUser = useCallback((userId: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId
          ? { ...u, status: 'blocked' as UserStatus, blocked_at: new Date().toISOString() }
          : u
      ),
    }));
  }, []);

  // 사용자 차단 해제 (관리자)
  const unblockUser = useCallback((userId: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId
          ? { ...u, status: 'approved' as UserStatus, blocked_at: undefined }
          : u
      ),
    }));
  }, []);

  const createRequest = useCallback(async (data: NewRequestFormData): Promise<BlogRequest> => {
    const hospital = mockHospitals.find((h) => h.hospital_id === data.hospital_id);
    const now = new Date().toISOString();
    const requestId = `R${now.slice(0, 10).replace(/-/g, '')}${String(state.requests.length + 1).padStart(3, '0')}`;

    // 초기 시스템 메시지
    const systemMessage: ChatMessage = {
      id: `msg_${Date.now()}_1`,
      role: 'system',
      content: `블로그 글 생성을 시작합니다.\n\n**타겟 키워드:** ${data.target_keyword}\n**주제:** ${data.topic_keyword}\n**구조:** ${data.format_type}${data.format_custom ? `\n**추가 설명:** ${data.format_custom}` : ''}`,
      created_at: now,
    };

    const newRequest: BlogRequest = {
      request_id: requestId,
      created_at: now,
      hospital_id: data.hospital_id,
      hospital_name: hospital?.hospital_name || '',
      target_keyword: data.target_keyword,
      topic_keyword: data.topic_keyword,
      purpose: data.purpose,
      format_type: data.format_type,
      format_custom: data.format_custom,
      status: '대기',
      revision_count: 0,
      created_by: state.user?.email || 'unknown@company.com',
      chat_history: [systemMessage],
    };

    setState((prev) => ({
      ...prev,
      requests: [newRequest, ...prev.requests],
    }));

    // 상태를 '생성중'으로 변경
    setTimeout(() => updateRequestStatus(requestId, '생성중'), 100);

    // Claude API 호출
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalName: hospital?.hospital_name || '',
          hospitalSystemPrompt: hospital?.system_prompt || '',
          targetKeyword: data.target_keyword,
          topicKeyword: data.topic_keyword,
          purpose: data.purpose,
          formatType: data.format_type,
          formatCustom: data.format_custom,
          messages: [],
          isInitialGeneration: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '글 생성에 실패했습니다.');
      }

      const result = await response.json();
      const docId = `doc${Date.now()}`;

      // AI 응답 메시지 추가
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_2`,
        role: 'assistant',
        content: result.content,
        created_at: new Date().toISOString(),
        doc_id: docId,
      };

      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.request_id === requestId
            ? {
                ...r,
                status: '완료' as const,
                result_doc_id: docId,
                completed_at: new Date().toISOString(),
                chat_history: [...r.chat_history, assistantMessage],
              }
            : r
        ),
      }));
    } catch (error) {
      console.error('Blog generation error:', error);

      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'system',
        content: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        created_at: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.request_id === requestId
            ? {
                ...r,
                status: '에러' as const,
                chat_history: [...r.chat_history, errorMessage],
              }
            : r
        ),
      }));
    }

    return newRequest;
  }, [state.requests.length, state.user?.email]);

  const updateRequestStatus = useCallback((requestId: string, status: BlogRequest['status']) => {
    setState((prev) => ({
      ...prev,
      requests: prev.requests.map((r) =>
        r.request_id === requestId ? { ...r, status } : r
      ),
    }));
  }, []);

  // 채팅 메시지 전송
  const sendMessage = useCallback(async (requestId: string, message: string) => {
    const now = new Date().toISOString();
    const request = state.requests.find((r) => r.request_id === requestId);
    if (!request) return;

    const hospital = mockHospitals.find((h) => h.hospital_id === request.hospital_id);

    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: message,
      created_at: now,
    };

    setState((prev) => ({
      ...prev,
      requests: prev.requests.map((r) =>
        r.request_id === requestId
          ? {
              ...r,
              status: '수정요청' as const,
              revision_request: message,
              revision_count: r.revision_count + 1,
              chat_history: [...r.chat_history, userMessage],
            }
          : r
      ),
    }));

    // Claude API 호출
    try {
      // 이전 대화 기록에서 user/assistant 메시지만 추출
      const previousMessages = request.chat_history
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));

      // 새 사용자 메시지 추가
      previousMessages.push({ role: 'user', content: message });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalName: hospital?.hospital_name || request.hospital_name,
          hospitalSystemPrompt: hospital?.system_prompt || '',
          targetKeyword: request.target_keyword,
          topicKeyword: request.topic_keyword,
          purpose: request.purpose,
          formatType: request.format_type,
          formatCustom: request.format_custom,
          messages: previousMessages,
          isInitialGeneration: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '수정 요청에 실패했습니다.');
      }

      const result = await response.json();
      const docId = `doc${Date.now()}`;

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: result.content,
        created_at: new Date().toISOString(),
        doc_id: docId,
      };

      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.request_id === requestId
            ? {
                ...r,
                status: '수정완료' as const,
                result_doc_id: docId,
                completed_at: new Date().toISOString(),
                chat_history: [...r.chat_history, assistantMessage],
              }
            : r
        ),
      }));
    } catch (error) {
      console.error('Revision error:', error);

      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'system',
        content: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        created_at: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.request_id === requestId
            ? {
                ...r,
                status: '에러' as const,
                chat_history: [...r.chat_history, errorMessage],
              }
            : r
        ),
      }));
    }
  }, [state.requests]);

  const refreshRequests = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, isLoading: false }));
    }, 500);
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        login,
        logout,
        signUp,
        approveUser,
        blockUser,
        unblockUser,
        createRequest,
        updateRequestStatus,
        sendMessage,
        refreshRequests,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
