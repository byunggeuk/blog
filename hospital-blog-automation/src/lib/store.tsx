"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useSession, signOut } from "next-auth/react";
import {
  BlogRequest,
  User,
  NewRequestFormData,
  ChatMessage,
  Hospital,
} from "@/types";

type AuthStatus = "unauthenticated" | "pending" | "blocked" | "authenticated";

interface AppState {
  user: User | null;
  users: User[];
  hospitals: Hospital[];
  requests: BlogRequest[];
  isLoading: boolean;
  dataSource: "mock" | "sheets";
  authStatus: AuthStatus;
}

interface AppContextType extends AppState {
  logout: () => void;
  createRequest: (data: NewRequestFormData) => Promise<BlogRequest>;
  updateRequestStatus: (
    requestId: string,
    status: BlogRequest["status"],
  ) => void;
  archiveRequest: (requestId: string) => Promise<void>;
  restoreRequest: (requestId: string) => Promise<void>;
  discardRequest: (requestId: string) => Promise<void>;
  sendMessage: (requestId: string, message: string) => void;
  refreshRequests: () => void;
  refreshData: () => Promise<void>;
  approveUser: (userId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  const [state, setState] = useState<AppState>({
    user: null,
    users: [],
    hospitals: [],
    requests: [],
    isLoading: true,
    dataSource: "sheets",
    authStatus: "unauthenticated",
  });

  // Sync user from session and register/check user in DB
  useEffect(() => {
    const syncUser = async () => {
      if (session?.user) {
        const sessionUser = session.user;

        try {
          // Register or get existing user from DB
          const response = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: sessionUser.email,
              name: sessionUser.name,
            }),
          });

          const data = await response.json();

          if (data.user) {
            const dbUser = data.user;
            let authStatus: AuthStatus = "unauthenticated";

            if (dbUser.status === "approved") {
              authStatus = "authenticated";
            } else if (dbUser.status === "pending") {
              authStatus = "pending";
            } else if (dbUser.status === "blocked") {
              authStatus = "blocked";
            }

            setState((prev) => ({
              ...prev,
              user: {
                id: dbUser.id,
                email: dbUser.email,
                name: dbUser.name,
                role: dbUser.role,
                status: dbUser.status,
                created_at: dbUser.created_at,
                approved_at: dbUser.approved_at,
                blocked_at: dbUser.blocked_at,
              },
              authStatus,
            }));
          }
        } catch (error) {
          console.error("사용자 동기화 실패:", error);
          // Fallback to basic session user
          setState((prev) => ({
            ...prev,
            user: {
              id: sessionUser.email || "unknown",
              email: sessionUser.email || "",
              name: sessionUser.name || "",
              role: "user",
              status: "pending",
              created_at: new Date().toISOString(),
            },
            authStatus: "pending",
          }));
        }
      } else {
        setState((prev) => ({
          ...prev,
          user: null,
          authStatus: "unauthenticated",
        }));
      }
    };

    syncUser();
  }, [session]);

  const loadInitialData = useCallback(
    async (userEmail?: string, isAdmin?: boolean) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        // 요청 목록은 사용자 정보에 따라 필터링
        const requestsUrl = userEmail
          ? `/api/requests?userEmail=${encodeURIComponent(userEmail)}&isAdmin=${isAdmin}`
          : "/api/requests";

        const [hospitalsRes, requestsRes, usersRes] = await Promise.all([
          fetch("/api/hospitals"),
          fetch(requestsUrl),
          fetch("/api/users"),
        ]);

        const hospitalsData = await hospitalsRes.json();
        const requestsData = await requestsRes.json();
        const usersData = await usersRes.json();

        setState((prev) => ({
          ...prev,
          hospitals: hospitalsData.hospitals || [],
          requests: requestsData.requests || [],
          users: usersData.users || [],
          dataSource: hospitalsData.source || "sheets",
          isLoading: false,
        }));
      } catch (error) {
        console.error("데이터 로드 실패:", error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [],
  );

  // 사용자 인증 완료 후 데이터 로드 (본인 요청만 필터링)
  useEffect(() => {
    if (state.authStatus === "authenticated" && state.user) {
      loadInitialData(state.user.email, state.user.role === "admin");
    } else if (state.authStatus === "unauthenticated") {
      // 미인증 상태에서도 기본 데이터 로드 (병원 목록 등)
      loadInitialData();
    }
  }, [state.authStatus, state.user?.email, state.user?.role, loadInitialData]);

  const refreshData = useCallback(async () => {
    if (state.user) {
      await loadInitialData(state.user.email, state.user.role === "admin");
    } else {
      await loadInitialData();
    }
  }, [loadInitialData, state.user]);

  const logout = useCallback(() => {
    signOut({ callbackUrl: "/" });
  }, []);

  const createRequest = useCallback(
    async (data: NewRequestFormData): Promise<BlogRequest> => {
      const hospital = state.hospitals.find(
        (h) => h.hospital_id === data.hospital_id,
      );
      const now = new Date().toISOString();
      const requestId = `R${now.slice(0, 10).replace(/-/g, "")}${String(state.requests.length + 1).padStart(3, "0")}`;

      const systemMessage: ChatMessage = {
        id: `msg_${Date.now()}_1`,
        role: "system",
        content: `블로그 글 생성을 시작합니다.\n\n**타겟 키워드:** ${data.target_keyword}\n**주제:** ${data.topic_keyword}\n**구조:** ${data.format_type}${data.format_custom ? `\n**추가 설명:** ${data.format_custom}` : ""}`,
        created_at: now,
      };

      const newRequest: BlogRequest = {
        request_id: requestId,
        created_at: now,
        hospital_id: data.hospital_id,
        hospital_name: hospital?.hospital_name || "",
        target_keyword: data.target_keyword,
        topic_keyword: data.topic_keyword,
        purpose: data.purpose,
        format_type: data.format_type,
        format_custom: data.format_custom,
        status: "대기",
        revision_count: 0,
        created_by: state.user?.email || "unknown@company.com",
        chat_history: [systemMessage],
      };

      setState((prev) => ({
        ...prev,
        requests: [newRequest, ...prev.requests],
      }));

      try {
        await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newRequest),
        });
      } catch (error) {
        console.error("요청 저장 실패:", error);
      }

      setTimeout(() => updateRequestStatus(requestId, "생성중"), 100);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hospitalName: hospital?.hospital_name || "",
            hospitalSystemPrompt: hospital?.system_prompt || "",
            targetKeyword: data.target_keyword,
            topicKeyword: data.topic_keyword,
            purpose: data.purpose,
            formatType: data.format_type,
            formatCustom: data.format_custom,
            messages: [],
            isInitialGeneration: true,
            referenceFolderId: hospital?.reference_folder_id || "",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "글 생성에 실패했습니다.");
        }

        const result = await response.json();

        let fileId = "";
        let fileUrl = "";

        try {
          const fileName = `${data.target_keyword}_${requestId}`;
          const driveResponse = await fetch("/api/docs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create",
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
          console.error("Google Drive 저장 실패:", driveError);
        }

        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_2`,
          role: "assistant",
          content: result.content,
          created_at: new Date().toISOString(),
          doc_id: fileId || `local_${Date.now()}`,
          doc_url: fileUrl || undefined,
        };

        const updatedRequest: BlogRequest = {
          ...newRequest,
          status: "완료",
          result_doc_id: fileId || `local_${Date.now()}`,
          result_doc_url: fileUrl || undefined,
          completed_at: new Date().toISOString(),
          chat_history: [...newRequest.chat_history, assistantMessage],
        };

        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) =>
            r.request_id === requestId ? updatedRequest : r,
          ),
        }));

        try {
          await fetch("/api/requests", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedRequest),
          });
        } catch (error) {
          console.error("요청 업데이트 실패:", error);
        }
      } catch (error) {
        console.error("블로그 생성 오류:", error);

        const errorMessage: ChatMessage = {
          id: `msg_${Date.now()}_error`,
          role: "system",
          content: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
          created_at: new Date().toISOString(),
        };

        const errorRequest: BlogRequest = {
          ...newRequest,
          status: "에러",
          chat_history: [...newRequest.chat_history, errorMessage],
        };

        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) =>
            r.request_id === requestId ? errorRequest : r,
          ),
        }));

        try {
          await fetch("/api/requests", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(errorRequest),
          });
        } catch (updateError) {
          console.error("에러 상태 업데이트 실패:", updateError);
        }
      }

      return newRequest;
    },
    [state.hospitals, state.requests.length, state.user?.email],
  );

  const updateRequestStatus = useCallback(
    (requestId: string, status: BlogRequest["status"]) => {
      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.request_id === requestId ? { ...r, status } : r,
        ),
      }));
    },
    [],
  );

  const archiveRequest = useCallback(
    async (requestId: string) => {
      const request = state.requests.find((r) => r.request_id === requestId);
      if (!request) return;

      const updatedRequest: BlogRequest = { ...request, status: "업로드완료" };

      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.request_id === requestId ? updatedRequest : r,
        ),
      }));

      try {
        await fetch("/api/requests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedRequest),
        });
      } catch (error) {
        console.error("아카이브 처리 실패:", error);
        // Revert on failure
        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) =>
            r.request_id === requestId ? request : r,
          ),
        }));
      }
    },
    [state.requests],
  );

  const restoreRequest = useCallback(
    async (requestId: string) => {
      const request = state.requests.find((r) => r.request_id === requestId);
      if (!request) return;

      const restoredStatus = request.revision_count > 0 ? "수정완료" : "완료";
      const updatedRequest: BlogRequest = {
        ...request,
        status: restoredStatus,
      };

      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.request_id === requestId ? updatedRequest : r,
        ),
      }));

      try {
        await fetch("/api/requests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedRequest),
        });
      } catch (error) {
        console.error("복원 처리 실패:", error);
        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) =>
            r.request_id === requestId ? request : r,
          ),
        }));
      }
    },
    [state.requests],
  );

  const discardRequest = useCallback(
    async (requestId: string) => {
      const request = state.requests.find((r) => r.request_id === requestId);
      if (!request) return;

      const updatedRequest: BlogRequest = { ...request, status: "폐기" };

      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.request_id === requestId ? updatedRequest : r,
        ),
      }));

      try {
        await fetch("/api/requests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedRequest),
        });
      } catch (error) {
        console.error("폐기 처리 실패:", error);
        // Revert on failure
        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) =>
            r.request_id === requestId ? request : r,
          ),
        }));
      }
    },
    [state.requests],
  );

  const sendMessage = useCallback(
    async (requestId: string, message: string) => {
      const now = new Date().toISOString();
      const request = state.requests.find((r) => r.request_id === requestId);
      if (!request) return;

      const hospital = state.hospitals.find(
        (h) => h.hospital_id === request.hospital_id,
      );

      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: "user",
        content: message,
        created_at: now,
      };

      const updatedRequest: BlogRequest = {
        ...request,
        status: "수정요청",
        revision_request: message,
        revision_count: request.revision_count + 1,
        chat_history: [...request.chat_history, userMessage],
      };

      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.request_id === requestId ? updatedRequest : r,
        ),
      }));

      try {
        const previousMessages = request.chat_history
          .filter((msg) => msg.role === "user" || msg.role === "assistant")
          .map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));

        previousMessages.push({ role: "user", content: message });

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hospitalName: hospital?.hospital_name || request.hospital_name,
            hospitalSystemPrompt: hospital?.system_prompt || "",
            targetKeyword: request.target_keyword,
            topicKeyword: request.topic_keyword,
            purpose: request.purpose,
            formatType: request.format_type,
            formatCustom: request.format_custom,
            messages: previousMessages,
            isInitialGeneration: false,
            referenceFolderId: hospital?.reference_folder_id || "",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "수정 요청에 실패했습니다.");
        }

        const result = await response.json();

        let fileId = request.result_doc_id || "";
        let fileUrl = request.result_doc_url || "";

        try {
          if (fileId && !fileId.startsWith("local_")) {
            const driveResponse = await fetch("/api/docs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "update",
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
            const driveResponse = await fetch("/api/docs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "create",
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
          console.error("Google Drive 저장 실패:", driveError);
        }

        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: "assistant",
          content: result.content,
          created_at: new Date().toISOString(),
          doc_id: fileId || `local_${Date.now()}`,
          doc_url: fileUrl || undefined,
        };

        const completedRequest: BlogRequest = {
          ...updatedRequest,
          status: "수정완료",
          result_doc_id: fileId || updatedRequest.result_doc_id,
          result_doc_url: fileUrl || updatedRequest.result_doc_url,
          completed_at: new Date().toISOString(),
          chat_history: [...updatedRequest.chat_history, assistantMessage],
        };

        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) =>
            r.request_id === requestId ? completedRequest : r,
          ),
        }));

        try {
          await fetch("/api/requests", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(completedRequest),
          });
        } catch (error) {
          console.error("요청 업데이트 실패:", error);
        }
      } catch (error) {
        console.error("수정 요청 오류:", error);

        const errorMessage: ChatMessage = {
          id: `msg_${Date.now()}_error`,
          role: "system",
          content: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
          created_at: new Date().toISOString(),
        };

        const errorRequest: BlogRequest = {
          ...updatedRequest,
          status: "에러",
          chat_history: [...updatedRequest.chat_history, errorMessage],
        };

        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((r) =>
            r.request_id === requestId ? errorRequest : r,
          ),
        }));
      }
    },
    [state.requests, state.hospitals],
  );

  const refreshRequests = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      // 본인 요청만 필터링 (관리자는 전체)
      const requestsUrl = state.user
        ? `/api/requests?userEmail=${encodeURIComponent(state.user.email)}&isAdmin=${state.user.role === "admin"}`
        : "/api/requests";

      const response = await fetch(requestsUrl);
      const data = await response.json();
      setState((prev) => ({
        ...prev,
        requests: data.requests || [],
        isLoading: false,
      }));
    } catch (error) {
      console.error("요청 새로고침 실패:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [state.user]);

  const approveUser = useCallback(async (userId: string) => {
    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "approve" }),
      });

      if (response.ok) {
        setState((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  status: "approved" as const,
                  approved_at: new Date().toISOString(),
                }
              : u,
          ),
        }));
      }
    } catch (error) {
      console.error("사용자 승인 실패:", error);
    }
  }, []);

  const blockUser = useCallback(async (userId: string) => {
    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "block" }),
      });

      if (response.ok) {
        setState((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  status: "blocked" as const,
                  blocked_at: new Date().toISOString(),
                }
              : u,
          ),
        }));
      }
    } catch (error) {
      console.error("사용자 차단 실패:", error);
    }
  }, []);

  const unblockUser = useCallback(async (userId: string) => {
    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "unblock" }),
      });

      if (response.ok) {
        setState((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId
              ? { ...u, status: "approved" as const, blocked_at: undefined }
              : u,
          ),
        }));
      }
    } catch (error) {
      console.error("차단 해제 실패:", error);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        logout,
        createRequest,
        updateRequestStatus,
        archiveRequest,
        restoreRequest,
        discardRequest,
        sendMessage,
        refreshRequests,
        refreshData,
        approveUser,
        blockUser,
        unblockUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
