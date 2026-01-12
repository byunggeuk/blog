'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/lib/store';
import { BlogRequest, RequestStatus } from '@/types';
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
import {
  Plus,
  Search,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
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
};

type DateFilter = 'all' | '7days' | '30days' | 'today';

export function DashboardContent() {
  const { requests, hospitals, isLoading, refreshRequests } = useApp();
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BlogRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // Stats
  const stats = useMemo(() => {
    const total = requests.length;
    const completed = requests.filter(
      (r) => r.status === '완료' || r.status === '수정완료'
    ).length;
    const inProgress = requests.filter(
      (r) => r.status === '생성중' || r.status === '수정요청'
    ).length;
    const pending = requests.filter((r) => r.status === '대기').length;

    return { total, completed, inProgress, pending };
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
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

      // Status filter
      if (statusFilter !== 'all' && request.status !== statusFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const requestDate = new Date(request.created_at);
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
  }, [requests, searchQuery, hospitalFilter, statusFilter, dateFilter]);

  const handleRowClick = (request: BlogRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

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
              {hospitals.map((hospital) => (
                <SelectItem key={hospital.hospital_id} value={hospital.hospital_id}>
                  {hospital.hospital_name}
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

      {/* Request Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">ID</TableHead>
                  <TableHead>병원</TableHead>
                  <TableHead>타겟 키워드</TableHead>
                  <TableHead>주제 키워드</TableHead>
                  <TableHead className="w-[100px] text-center">구조</TableHead>
                  <TableHead className="min-w-[200px]">목적</TableHead>
                  <TableHead className="w-[100px]">상태</TableHead>
                  <TableHead className="w-[100px]">날짜</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {searchQuery || hospitalFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all'
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
                        {format(new Date(request.created_at), 'MM-dd HH:mm', { locale: ko })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
