'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/lib/store';
import { BlogRequest, ChatMessage } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';
import {
  ExternalLink,
  Send,
  Loader2,
  Bot,
  User,
  Info,
  FileText,
  Building2,
  Target,
  Calendar,
  Eye,
  MessageSquare,
  History,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface RequestChatModalProps {
  request: BlogRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<
  BlogRequest['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  대기: { label: '대기', variant: 'outline' },
  생성중: { label: '생성중', variant: 'secondary' },
  완료: { label: '완료', variant: 'default' },
  수정요청: { label: '수정요청', variant: 'secondary' },
  수정완료: { label: '수정완료', variant: 'default' },
  에러: { label: '에러', variant: 'destructive' },
};

type ViewMode = 'chat' | 'preview' | 'versions';

interface ChatMessageItemProps {
  message: ChatMessage;
  onPreview?: (content: string) => void;
}

function ChatMessageItem({ message, onPreview }: ChatMessageItemProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'assistant';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-muted/50 rounded-lg px-4 py-3 max-w-md text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
            <Info className="h-4 w-4" />
            <span className="text-xs font-medium">시스템</span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message */}
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted rounded-tl-sm'
          }`}
        >
          {isAssistant ? (
            <p className="text-sm whitespace-pre-wrap line-clamp-6">
              {message.content.slice(0, 300)}
              {message.content.length > 300 && '...'}
            </p>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Action buttons for assistant messages */}
        {isAssistant && (
          <div className="flex gap-1.5 mt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 text-xs"
              onClick={() => onPreview?.(message.content)}
            >
              <Eye className="h-3 w-3" />
              미리보기
            </Button>
            {message.doc_url && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
              >
                <a href={message.doc_url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3 w-3" />
                  Drive
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground px-1">
          {format(new Date(message.created_at), 'HH:mm', { locale: ko })}
        </span>
      </div>
    </div>
  );
}

export function RequestChatModal({
  request,
  open,
  onOpenChange,
}: RequestChatModalProps) {
  const { sendMessage, requests } = useApp();
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get the latest request data from store
  const currentRequest = request
    ? requests.find((r) => r.request_id === request.request_id) || request
    : null;

  const isProcessing =
    currentRequest?.status === '생성중' || currentRequest?.status === '수정요청';

  // Get all assistant messages (versions)
  const versions = currentRequest?.chat_history.filter(
    (msg) => msg.role === 'assistant'
  ) || [];

  // Get latest content
  const latestContent = versions[versions.length - 1]?.content || '';

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (viewMode === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentRequest?.chat_history, viewMode]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (open && textareaRef.current && viewMode === 'chat') {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open, viewMode]);

  // Reset view mode when modal closes
  useEffect(() => {
    if (!open) {
      setViewMode('chat');
      setPreviewContent('');
      setSelectedVersion(null);
    }
  }, [open]);

  const handleSend = () => {
    if (!inputMessage.trim() || !currentRequest || isSending || isProcessing) return;

    setIsSending(true);
    sendMessage(currentRequest.request_id, inputMessage.trim());
    setInputMessage('');

    // Reset sending state after a brief moment
    setTimeout(() => setIsSending(false), 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePreview = (content: string) => {
    setPreviewContent(content);
    setViewMode('preview');
  };

  const handleVersionSelect = (index: number) => {
    setSelectedVersion(index);
    setPreviewContent(versions[index].content);
    setViewMode('preview');
  };

  if (!currentRequest) return null;

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy년 M월 d일 HH:mm', { locale: ko });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-semibold">
                {currentRequest.target_keyword}
              </DialogTitle>
              <Badge variant={statusConfig[currentRequest.status].variant}>
                {statusConfig[currentRequest.status].label}
              </Badge>
            </div>
            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              <Button
                variant={viewMode === 'chat' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setViewMode('chat')}
              >
                <MessageSquare className="h-4 w-4" />
                채팅
              </Button>
              <Button
                variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => {
                  setPreviewContent(latestContent);
                  setViewMode('preview');
                }}
                disabled={!latestContent}
              >
                <Eye className="h-4 w-4" />
                미리보기
              </Button>
              <Button
                variant={viewMode === 'versions' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setViewMode('versions')}
                disabled={versions.length === 0}
              >
                <History className="h-4 w-4" />
                버전 ({versions.length})
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {currentRequest.hospital_name}
            </span>
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              {currentRequest.topic_keyword}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(currentRequest.created_at)}
            </span>
          </div>
        </DialogHeader>

        {/* Request Info (Collapsible) - Only show in chat mode */}
        {viewMode === 'chat' && (
          <div className="px-6 py-3 border-b bg-muted/30 flex-shrink-0">
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                <Info className="h-4 w-4" />
                요청 정보 보기
                <span className="ml-auto text-xs group-open:hidden">펼치기</span>
                <span className="ml-auto text-xs hidden group-open:inline">접기</span>
              </summary>
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span className="font-medium">구조:</span>{' '}
                  <Badge variant="outline" className="ml-1">{currentRequest.format_type}</Badge>
                </div>
                <div>
                  <span className="font-medium">목적:</span>
                  <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                    {currentRequest.purpose}
                  </p>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {/* Chat View */}
          {viewMode === 'chat' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {currentRequest.chat_history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Bot className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-sm">아직 대화 내용이 없습니다.</p>
                    <p className="text-xs">글 생성이 완료되면 여기에 표시됩니다.</p>
                  </div>
                ) : (
                  currentRequest.chat_history.map((message) => (
                    <ChatMessageItem
                      key={message.id}
                      message={message}
                      onPreview={handlePreview}
                    />
                  ))
                )}

                {/* Loading indicator when processing */}
                {isProcessing && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>응답 생성 중...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="px-6 py-4 border-t bg-background flex-shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isProcessing
                        ? '응답을 기다리는 중...'
                        : '수정 요청이나 피드백을 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)'
                    }
                    disabled={isProcessing || isSending}
                    className="min-h-[60px] max-h-[120px] resize-none"
                    rows={2}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!inputMessage.trim() || isProcessing || isSending}
                    className="h-auto px-4"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  피드백을 보내면 AI가 문서를 수정하고 새 버전을 생성합니다.
                </p>
              </div>
            </div>
          )}

          {/* Preview View */}
          {viewMode === 'preview' && (
            <div className="h-full overflow-y-auto px-6 py-4">
              {previewContent ? (
                <MarkdownViewer
                  content={previewContent}
                  title={currentRequest.target_keyword}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">미리볼 콘텐츠가 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {/* Versions View */}
          {viewMode === 'versions' && (
            <div className="h-full overflow-y-auto px-6 py-4">
              <h3 className="text-sm font-medium mb-4">버전 히스토리</h3>
              {versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <History className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">아직 생성된 버전이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedVersion === index ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => handleVersionSelect(index)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={index === versions.length - 1 ? 'default' : 'outline'}>
                            v{index + 1}
                            {index === versions.length - 1 && ' (최신)'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(version.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVersionSelect(index);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          보기
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {version.content.slice(0, 150)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
