'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BarChart3, Users, FileText, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { BlogRequest } from '@/types';

interface EmployeeStats {
  email: string;
  name: string;
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  error: number;
  completionRate: number;
}

export function EmployeeStatistics() {
  const { requests, users } = useApp();
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeStats | null>(null);

  // 직원별 통계 계산
  const employeeStats = useMemo(() => {
    const statsMap = new Map<string, EmployeeStats>();

    // 모든 요청을 순회하며 직원별 통계 집계
    requests.forEach((request) => {
      // 이메일 정규화 (빈값, undefined, null 처리)
      const rawEmail = request.created_by;
      const email = (rawEmail && typeof rawEmail === 'string') ? rawEmail.trim().toLowerCase() : '';

      // 빈 이메일은 건너뛰기
      if (!email) return;

      const user = users.find((u) => u.email.toLowerCase() === email);

      if (!statsMap.has(email)) {
        statsMap.set(email, {
          email: rawEmail?.trim() || email, // 원본 이메일 표시용
          name: user?.name || email.split('@')[0],
          total: 0,
          completed: 0,
          pending: 0,
          inProgress: 0,
          error: 0,
          completionRate: 0,
        });
      }

      const stats = statsMap.get(email)!;
      stats.total++;

      switch (request.status) {
        case '완료':
        case '수정완료':
          stats.completed++;
          break;
        case '대기':
          stats.pending++;
          break;
        case '생성중':
        case '수정요청':
          stats.inProgress++;
          break;
        case '에러':
          stats.error++;
          break;
      }
    });

    // 완료율 계산
    statsMap.forEach((stats) => {
      stats.completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    });

    // 총 요청 수 기준 내림차순 정렬 (빈 이메일은 이미 위에서 제외됨)
    return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
  }, [requests, users]);

  // 전체 통계
  const totalStats = useMemo(() => {
    // 실제 등록된 사용자 수 (승인된 사용자만)
    const registeredUsers = users.filter((u) => u.status === 'approved').length;

    return {
      totalRequests: requests.length,
      totalCompleted: requests.filter((r) => r.status === '완료' || r.status === '수정완료').length,
      totalPending: requests.filter((r) => r.status === '대기').length,
      totalInProgress: requests.filter((r) => r.status === '생성중' || r.status === '수정요청').length,
      totalError: requests.filter((r) => r.status === '에러').length,
      registeredUsers,
      // employeeStats는 이미 빈 이메일이 필터링됨
      activeEmployees: employeeStats.length,
    };
  }, [requests, employeeStats, users]);

  // 선택된 직원의 요청 목록
  const selectedEmployeeRequests = useMemo(() => {
    if (!selectedEmployee) return [];
    return requests.filter(
      (r) => r.created_by?.trim().toLowerCase() === selectedEmployee.email.toLowerCase()
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [requests, selectedEmployee]);

  // 상태별 배지 색상
  const getStatusBadge = (status: string) => {
    switch (status) {
      case '완료':
      case '수정완료':
        return <Badge className="bg-green-100 text-green-700 border-green-200">{status}</Badge>;
      case '대기':
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">{status}</Badge>;
      case '생성중':
      case '수정요청':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">{status}</Badge>;
      case '에러':
        return <Badge className="bg-red-100 text-red-700 border-red-200">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 전체 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 요청</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              등록 직원 {totalStats.registeredUsers}명 (활동 {totalStats.activeEmployees}명)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">완료</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalStats.totalCompleted}</div>
            <p className="text-xs text-muted-foreground">
              {totalStats.totalRequests > 0
                ? Math.round((totalStats.totalCompleted / totalStats.totalRequests) * 100)
                : 0}
              % 완료율
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">진행중</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalStats.totalPending + totalStats.totalInProgress}
            </div>
            <p className="text-xs text-muted-foreground">
              대기 {totalStats.totalPending} / 처리중 {totalStats.totalInProgress}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오류</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalStats.totalError}</div>
            <p className="text-xs text-muted-foreground">
              {totalStats.totalRequests > 0
                ? Math.round((totalStats.totalError / totalStats.totalRequests) * 100)
                : 0}
              % 오류율
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 직원별 통계 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            직원별 통계
          </CardTitle>
          <CardDescription>각 직원의 블로그 요청 현황을 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {employeeStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              아직 요청 데이터가 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>직원</TableHead>
                  <TableHead className="text-center">총 요청</TableHead>
                  <TableHead className="text-center">완료</TableHead>
                  <TableHead className="text-center">진행중</TableHead>
                  <TableHead className="text-center">오류</TableHead>
                  <TableHead className="text-center">완료율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeStats.map((stats) => (
                  <TableRow
                    key={stats.email}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedEmployee(stats)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium text-primary hover:underline">{stats.name}</div>
                        <div className="text-xs text-muted-foreground">{stats.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">{stats.total}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {stats.completed}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {stats.pending + stats.inProgress}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {stats.error > 0 ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          {stats.error}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${stats.completionRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{stats.completionRate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 직원 상세 요청 내역 모달 */}
      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedEmployee?.name}님의 요청 내역
            </DialogTitle>
            <DialogDescription>
              {selectedEmployee?.email} · 총 {selectedEmployeeRequests.length}건
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {selectedEmployeeRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                요청 내역이 없습니다.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>요청일</TableHead>
                    <TableHead>병원</TableHead>
                    <TableHead>키워드</TableHead>
                    <TableHead>글 구조</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead className="text-center">문서</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedEmployeeRequests.map((request) => (
                    <TableRow key={request.request_id}>
                      <TableCell className="text-sm">
                        {new Date(request.created_at).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className="font-medium">{request.hospital_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">{request.target_keyword}</div>
                        <div className="text-xs text-muted-foreground">{request.topic_keyword}</div>
                      </TableCell>
                      <TableCell className="text-sm">{request.format_type}</TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(request.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        {request.result_doc_url ? (
                          <a
                            href={request.result_doc_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
