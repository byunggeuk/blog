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
import { Separator } from '@/components/ui/separator';
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

function ChatMessageItem({ message }: { message: ChatMessage }) {
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
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Document link for assistant messages */}
        {isAssistant && message.doc_url && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-1 gap-2 h-8 text-xs"
          >
            <a href={message.doc_url} target="_blank" rel="noopener noreferrer">
              <FileText className="h-3 w-3" />
              문서 열기
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get the latest request data from store
  const currentRequest = request
    ? requests.find((r) => r.request_id === request.request_id) || request
    : null;

  const isProcessing =
    currentRequest?.status === '생성중' || currentRequest?.status === '수정요청';

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentRequest?.chat_history]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
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

  if (!currentRequest) return null;

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy년 M월 d일 HH:mm', { locale: ko });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-semibold">
                {currentRequest.target_keyword}
              </DialogTitle>
              <Badge variant={statusConfig[currentRequest.status].variant}>
                {statusConfig[currentRequest.status].label}
              </Badge>
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

        {/* Request Info (Collapsible) */}
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

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {currentRequest.chat_history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">아직 대화 내용이 없습니다.</p>
              <p className="text-xs">글 생성이 완료되면 여기에 표시됩니다.</p>
            </div>
          ) : (
            currentRequest.chat_history.map((message) => (
              <ChatMessageItem key={message.id} message={message} />
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
      </DialogContent>
    </Dialog>
  );
}
