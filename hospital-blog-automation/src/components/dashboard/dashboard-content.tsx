'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '@/lib/store';
import { BlogRequest, RequestStatus, FormatType } from '@/types';
import { NewRequestModal } from '@/components/requests/new-request-modal';
import { RequestChatModal } from '@/components/requests/request-chat-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Plus,
  Search,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Archive,
  Undo2,
} from 'lucide-react';
import { format, isValid, Locale } from 'date-fns';

// 안전하게 날짜 포맷팅 (유효하지 않은 날짜는 '-' 반환)
function safeFormatDate(dateStr: string | undefined, formatStr: string, options?: { locale?: Locale }): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (!isValid(date)) return '-';
  try {
    return format(date, formatStr, options);
  } catch {
    return '-';
  }
}
import { ko } from 'date-fns/locale';

const statusConfig: Record<
  RequestStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  대기: { label: '대기', variant: 'outline', icon: <Clock className="h-3 w-3" /> },
  생성중: { label: '생성중', variant: 'secondary', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  완료: { label: '완료', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  수정요청: { label: '수정요청', variant: 'secondary', icon: <RefreshCw className="h-3 w-3" /> },
  수정완료: { label: '수정완료', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  에러: { label: '에러', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
  업로드완료: { label: '업로드완료', variant: 'outline', icon: <Archive className="h-3 w-3" /> },
};

type DateFilter = 'all' | '7days' | '30days' | 'today';

type SortField = 'request_id' | 'target_keyword' | 'topic_keyword' | 'purpose' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';

const ACTIVE_STATUSES: RequestStatus[] = ['대기', '생성중', '완료', '수정요청', '수정완료', '에러'];

export function DashboardContent() {
  const { requests, hospitals, isLoading, refreshRequests, archiveRequest, restoreRequest } = useApp();
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BlogRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Tab
  const [activeTab, setActiveTab] = useState<string>('active');

  // Stats
  const stats = useMemo(() => {
    const activeRequests = requests.filter((r) => r.status !== '업로드완료');
    const total = activeRequests.length;
    const completed = activeRequests.filter(
      (r) => r.status === '완료' || r.status === '수정완료'
    ).length;
    const inProgress = activeRequests.filter(
      (r) => r.status === '생성중' || r.status === '수정요청'
    ).length;
    const pending = activeRequests.filter((r) => r.status === '대기').length;

    return { total, completed, inProgress, pending };
  }, [requests]);

  // Counts for tabs
  const activeCount = useMemo(() => requests.filter((r) => r.status !== '업로드완료').length, [requests]);
  const archiveCount = useMemo(() => requests.filter((r) => r.status === '업로드완료').length, [requests]);

  // Unique format types from requests
  const formatTypes = useMemo(() => {
    const types = new Set<string>();
    requests.forEach((r) => types.add(r.format_type));
    return Array.from(types).sort();
  }, [requests]);

  // Auto-process pending requests
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const processPendingRequests = async () => {
      if (isProcessingRef.current) return;

      const hasPending = requests.some(r => r.status === '대기');
      if (!hasPending) return;

      isProcessingRef.current = true;
      try {
        const response = await fetch('/api/process', { method: 'POST' });
        if (response.ok) {
          const result = await response.json();
          if (result.processed > 0) {
            refreshRequests();
          }
        }
      } catch (error) {
        console.error('Auto-process error:', error);
      } finally {
        isProcessingRef.current = false;
      }
    };

    processPendingRequests();
    const interval = setInterval(processPendingRequests, 30000);
    return () => clearInterval(interval);
  }, [requests, refreshRequests]);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Filtered & sorted requests
  const filteredRequests = useMemo(() => {
    const isArchiveTab = activeTab === 'archive';

    let filtered = requests.filter((request) => {
      // Tab filter: active vs archive
      if (isArchiveTab) {
        if (request.status !== '업로드완료') return false;
      } else {
        if (request.status === '업로드완료') return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          request.target_keyword.toLowerCase().includes(query) ||
          request.topic_keyword.toLowerCase().includes(query) ||
          request.hospital_name.toLowerCase().includes(query) ||
          request.request_id.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Hospital filter
      if (hospitalFilter !== 'all' && request.hospital_id !== hospitalFilter) {
        return false;
      }

      // Format filter
      if (formatFilter !== 'all' && request.format_type !== formatFilter) {
        return false;
      }

      // Status filter (only for active tab)
      if (!isArchiveTab && statusFilter !== 'all' && request.status !== statusFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const requestDate = new Date(request.created_at);
        // 유효하지 않은 날짜는 필터링하지 않음 (모두 포함)
        if (!isValid(requestDate)) return true;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dateFilter === 'today') {
          if (requestDate < today) return false;
        } else if (dateFilter === '7days') {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          if (requestDate < weekAgo) return false;
        } else if (dateFilter === '30days') {
          const monthAgo = new Date(today);
          monthAgo.setDate(monthAgo.getDate() - 30);
          if (requestDate < monthAgo) return false;
        }
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: string;
      let bVal: string;

      switch (sortField) {
        case 'request_id':
          aVal = a.request_id;
          bVal = b.request_id;
          break;
        case 'target_keyword':
          aVal = a.target_keyword;
          bVal = b.target_keyword;
          break;
        case 'topic_keyword':
          aVal = a.topic_keyword;
          bVal = b.topic_keyword;
          break;
        case 'purpose':
          aVal = a.purpose;
          bVal = b.purpose;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'created_at':
          aVal = a.created_at;
          bVal = b.created_at;
          break;
        default:
          aVal = a.created_at;
          bVal = b.created_at;
      }

      const cmp = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [requests, activeTab, searchQuery, hospitalFilter, formatFilter, statusFilter, dateFilter, sortField, sortDirection]);

  const handleRowClick = (request: BlogRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const handleArchive = async (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    await archiveRequest(requestId);
  };

  const handleRestore = async (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    await restoreRequest(requestId);
  };

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {children}
        {getSortIcon(field)}
      </div>
    </TableHead>
  );

  const renderTable = () => (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="request_id" className="w-[120px]">ID</SortableHeader>
                <TableHead>병원</TableHead>
                <SortableHeader field="target_keyword">타겟 키워드</SortableHeader>
                <SortableHeader field="topic_keyword">주제 키워드</SortableHeader>
                <TableHead className="w-[100px] text-center">구조</TableHead>
                <SortableHeader field="purpose" className="min-w-[200px]">목적</SortableHeader>
                <SortableHeader field="status" className="w-[100px]">상태</SortableHeader>
                <SortableHeader field="created_at" className="w-[100px]">날짜</SortableHeader>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    {activeTab === 'archive'
                      ? '아카이브된 요청이 없습니다.'
                      : searchQuery || hospitalFilter !== 'all' || statusFilter !== 'all' || formatFilter !== 'all' || dateFilter !== 'all'
                        ? '검색 결과가 없습니다.'
                        : '아직 요청이 없습니다. 새 글 요청을 생성해보세요!'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow
                    key={request.request_id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(request)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {request.request_id}
                    </TableCell>
                    <TableCell className="font-medium">{request.hospital_name}</TableCell>
                    <TableCell>{request.target_keyword}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.topic_keyword}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {request.format_type}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[250px]">
                      <span className="line-clamp-2">{request.purpose}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusConfig[request.status].variant}
                        className="gap-1"
                      >
                        {statusConfig[request.status].icon}
                        {statusConfig[request.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {safeFormatDate(request.created_at, 'MM-dd HH:mm', { locale: ko })}
                    </TableCell>
                    <TableCell>
                      {activeTab === 'active' && (request.status === '완료' || request.status === '수정완료') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={(e) => handleArchive(e, request.request_id)}
                        >
                          <Archive className="h-3 w-3" />
                          업로드완료
                        </Button>
                      )}
                      {activeTab === 'archive' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={(e) => handleRestore(e, request.request_id)}
                        >
                          <Undo2 className="h-3 w-3" />
                          복원
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 요청</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">완료</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">진행중</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">대기중</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions & Filters */}
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <Button onClick={() => setShowNewRequestModal(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />새 글 요청
        </Button>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="키워드 검색..."
              className="pl-9 w-full md:w-[200px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={hospitalFilter} onValueChange={setHospitalFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="전체 병원" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 병원</SelectItem>
              {hospitals
                .filter((hospital) => hospital.hospital_id)
                .map((hospital) => (
                  <SelectItem key={hospital.hospital_id} value={hospital.hospital_id}>
                    {hospital.hospital_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={formatFilter} onValueChange={setFormatFilter}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="전체 구조" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 구조</SelectItem>
              {formatTypes.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  {ft}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[140px]">
              <SelectValue placeholder="전체 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="대기">대기</SelectItem>
              <SelectItem value="생성중">생성중</SelectItem>
              <SelectItem value="완료">완료</SelectItem>
              <SelectItem value="수정요청">수정요청</SelectItem>
              <SelectItem value="수정완료">수정완료</SelectItem>
              <SelectItem value="에러">에러</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger className="w-full md:w-[140px]">
              <SelectValue placeholder="전체 기간" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 기간</SelectItem>
              <SelectItem value="today">오늘</SelectItem>
              <SelectItem value="7days">최근 7일</SelectItem>
              <SelectItem value="30days">최근 30일</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={refreshRequests} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tabs: Active / Archive */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">작업중 ({activeCount})</TabsTrigger>
          <TabsTrigger value="archive">아카이브 ({archiveCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {renderTable()}
        </TabsContent>

        <TabsContent value="archive">
          {renderTable()}
        </TabsContent>
      </Tabs>

      {/* Pagination placeholder */}
      {filteredRequests.length > 0 && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
          총 {filteredRequests.length}건
        </div>
      )}

      {/* Modals */}
      <NewRequestModal
        open={showNewRequestModal}
        onOpenChange={setShowNewRequestModal}
      />
      <RequestChatModal
        request={selectedRequest}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
      />
    </>
  );
}
