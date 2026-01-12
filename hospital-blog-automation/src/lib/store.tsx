'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { BlogRequest, User, NewRequestFormData, SignUpFormData, UserStatus, ChatMessage, Hospital } from '@/types';
import { mockCurrentUser, mockUsers } from './mock-data';

// 인증 상태 타입
type AuthStatus = 'unauthenticated' | 'pending' | 'blocked' | 'authenticated';

interface AppState {
  user: User | null;
  users: User[];
  hospitals: Hospital[];
  requests: BlogRequest[];
  isLoading: boolean;
  authStatus: AuthStatus;
  dataSource: 'mock' | 'sheets';
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
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    user: null,
    users: mockUsers,
    hospitals: [],
    requests: [],
    isLoading: true,
    authStatus: 'unauthenticated',
    dataSource: 'mock',
  });

  // 초기 데이터 로드
  const loadInitialData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // 병원 데이터 로드
      const hospitalsRes = await fetch('/api/hospitals');
      const hospitalsData = await hospitalsRes.json();

      // 요청 데이터 로드
      const requestsRes = await fetch('/api/requests');
      const requestsData = await requestsRes.json();

      setState((prev) => ({
        ...prev,
        hospitals: hospitalsData.hospitals || [],
        requests: requestsData.requests || [],
        dataSource: hospitalsData.source || 'mock',
        isLoading: false,
      }));
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 데이터 새로고침
  const refreshData = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  // 로그인
  const login = useCallback((asAdmin: boolean = true) => {
    if (asAdmin) {
      setState((prev) => ({
        ...prev,
        user: mockCurrentUser,
        authStatus: 'authenticated',
      }));
    } else {
      const approvedUser = mockUsers.find((u) => u.role === 'user' && u.status === 'approved');
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
  const signUp = useCallback(
    async (data: SignUpFormData): Promise<void> => {
      const existingUser = state.users.find((u) => u.email === data.email);
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
    },
    [state.users]
  );

  // 사용자 승인
  const approveUser = useCallback((userId: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, status: 'approved' as UserStatus, approved_at: new Date().toISOString() } : u
      ),
    }));
  }, []);

  // 사용자 차단
  const blockUser = useCallback((userId: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, status: 'blocked' as UserStatus, blocked_at: new Date().toISOString() } : u
      ),
    }));
  }, []);

  // 사용자 차단 해제
  const unblockUser = useCallback((userId: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, status: 'approved' as UserStatus, blocked_at: undefined } : u
      ),
    }));
  }, []);

  // 새 요청 생성
  const createRequest = useCallback(
    async (data: NewRequestFormData): Promise<BlogRequest> => {
      const hospital = state.hospitals.find((h) => h.hospital_id === data.hospital_id);
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

      // 로컬 상태 업데이트
      setState((prev) => ({
        ...prev,
        requests: [newRequest, ...prev.requests],
      }));

      // API에 저장
      try {
        await fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRequest),
        });
      } catch (error) {
        console.error('요청 저장 실패:', error);
      }

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

        // Google Drive에 마크다운 파일 저장
        let fileId = '';
        let fileUrl = '';

        try {
          const fileName = `${data.target_keyword}_${requestId}`;
          const driveResponse = await fetch('/api/docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              fileName: fileName,
              content: result.content,
              folderId: hospital?.output_folder_id,
            }),
          });

          if (driveResponse.ok) {
            const driveResult = await driveResponse.json();
            fileId = driveResult.fileId;
            fileUrl = driveResult.fileUrl;
          }
        } catch (driveError) {
          console.error('Google Drive 저장 실패:', driveError);
        }

        // AI 응답 메시지
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_2`,
          role: 'assistant',
          content: result.content,
          created_at: new Date().toISOString(),
          doc_id: fileId || `local_${Date.now()}`,
          doc_url: fileUrl || undefined,
        };

        const updatedRequest: BlogRequest = {
          ...newRequest,
          status: '완료',
          result_doc_id: fileId || `local_${Date.now()}`,
          result_doc_url: fileUrl || undefined,
          completed_at: new Date().toISOString(),
          chat_history: [...newRequest.chat_history, assistantMessage],
        };

        // 로컬 상태 업데이트
        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) => (r.request_id === requestId ? updatedRequest : r)),
        }));

        // API에 업데이트
        try {
          await fetch('/api/requests', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedRequest),
          });
        } catch (error) {
          console.error('요청 업데이트 실패:', error);
        }
      } catch (error) {
        console.error('블로그 생성 오류:', error);

        const errorMessage: ChatMessage = {
          id: `msg_${Date.now()}_error`,
          role: 'system',
          content: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
          created_at: new Date().toISOString(),
        };

        const errorRequest: BlogRequest = {
          ...newRequest,
          status: '에러',
          chat_history: [...newRequest.chat_history, errorMessage],
        };

        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) => (r.request_id === requestId ? errorRequest : r)),
        }));

        // API에 에러 상태 업데이트
        try {
          await fetch('/api/requests', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorRequest),
          });
        } catch (updateError) {
          console.error('에러 상태 업데이트 실패:', updateError);
        }
      }

      return newRequest;
    },
    [state.hospitals, state.requests.length, state.user?.email]
  );

  // 요청 상태 업데이트
  const updateRequestStatus = useCallback((requestId: string, status: BlogRequest['status']) => {
    setState((prev) => ({
      ...prev,
      requests: prev.requests.map((r) => (r.request_id === requestId ? { ...r, status } : r)),
    }));
  }, []);

  // 채팅 메시지 전송
  const sendMessage = useCallback(
    async (requestId: string, message: string) => {
      const now = new Date().toISOString();
      const request = state.requests.find((r) => r.request_id === requestId);
      if (!request) return;

      const hospital = state.hospitals.find((h) => h.hospital_id === request.hospital_id);

      // 사용자 메시지 추가
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: message,
        created_at: now,
      };

      const updatedRequest: BlogRequest = {
        ...request,
        status: '수정요청',
        revision_request: message,
        revision_count: request.revision_count + 1,
        chat_history: [...request.chat_history, userMessage],
      };

      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) => (r.request_id === requestId ? updatedRequest : r)),
      }));

      // Claude API 호출
      try {
        const previousMessages = request.chat_history
          .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          }));

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

        // Google Drive 파일 업데이트
        let fileId = request.result_doc_id || '';
        let fileUrl = request.result_doc_url || '';

        try {
          if (fileId && !fileId.startsWith('local_')) {
            const driveResponse = await fetch('/api/docs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'update',
                fileId: fileId,
                content: result.content,
              }),
            });

            if (driveResponse.ok) {
              const driveResult = await driveResponse.json();
              fileUrl = driveResult.fileUrl;
            }
          } else {
            const fileName = `${request.target_keyword}_${requestId}`;
            const driveResponse = await fetch('/api/docs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create',
                fileName: fileName,
                content: result.content,
                folderId: hospital?.output_folder_id,
              }),
            });

            if (driveResponse.ok) {
              const driveResult = await driveResponse.json();
              fileId = driveResult.fileId;
              fileUrl = driveResult.fileUrl;
            }
          }
        } catch (driveError) {
          console.error('Google Drive 저장 실패:', driveError);
        }

        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: result.content,
          created_at: new Date().toISOString(),
          doc_id: fileId || `local_${Date.now()}`,
          doc_url: fileUrl || undefined,
        };

        const completedRequest: BlogRequest = {
          ...updatedRequest,
          status: '수정완료',
          result_doc_id: fileId || updatedRequest.result_doc_id,
          result_doc_url: fileUrl || updatedRequest.result_doc_url,
          completed_at: new Date().toISOString(),
          chat_history: [...updatedRequest.chat_history, assistantMessage],
        };

        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) => (r.request_id === requestId ? completedRequest : r)),
        }));

        // API에 업데이트
        try {
          await fetch('/api/requests', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(completedRequest),
          });
        } catch (error) {
          console.error('요청 업데이트 실패:', error);
        }
      } catch (error) {
        console.error('수정 요청 오류:', error);

        const errorMessage: ChatMessage = {
          id: `msg_${Date.now()}_error`,
          role: 'system',
          content: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
          created_at: new Date().toISOString(),
        };

        const errorRequest: BlogRequest = {
          ...updatedRequest,
          status: '에러',
          chat_history: [...updatedRequest.chat_history, errorMessage],
        };

        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) => (r.request_id === requestId ? errorRequest : r)),
        }));
      }
    },
    [state.requests, state.hospitals]
  );

  // 요청 목록 새로고침
  const refreshRequests = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const response = await fetch('/api/requests');
      const data = await response.json();
      setState((prev) => ({
        ...prev,
        requests: data.requests || [],
        isLoading: false,
      }));
    } catch (error) {
      console.error('요청 새로고침 실패:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
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
        refreshData,
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
