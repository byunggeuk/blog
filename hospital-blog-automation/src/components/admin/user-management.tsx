"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/lib/store";
import { User, UserStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  UserCheck,
  UserX,
  Users,
  Clock,
  CheckCircle2,
  Ban,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

const statusConfig: Record<
  UserStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
  }
> = {
  pending: {
    label: "승인 대기",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    label: "승인됨",
    variant: "default",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  blocked: {
    label: "차단됨",
    variant: "destructive",
    icon: <Ban className="h-3 w-3" />,
  },
};

export function UserManagement() {
  const {
    users,
    user: currentUser,
    approveUser,
    blockUser,
    unblockUser,
  } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<
    "approve" | "block" | "unblock" | null
  >(null);

  // Stats
  const stats = useMemo(() => {
    const total = users.length;
    const pending = users.filter((u) => u.status === "pending").length;
    const approved = users.filter((u) => u.status === "approved").length;
    const blocked = users.filter((u) => u.status === "blocked").length;
    return { total, pending, approved, blocked };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (statusFilter !== "all" && user.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [users, searchQuery, statusFilter]);

  const handleAction = (
    user: User,
    action: "approve" | "block" | "unblock",
  ) => {
    setSelectedUser(user);
    setActionType(action);
  };

  const confirmAction = () => {
    if (!selectedUser || !actionType) return;

    switch (actionType) {
      case "approve":
        approveUser(selectedUser.id);
        break;
      case "block":
        blockUser(selectedUser.id);
        break;
      case "unblock":
        unblockUser(selectedUser.id);
        break;
    }

    setSelectedUser(null);
    setActionType(null);
  };

  const getActionDialogContent = () => {
    if (!selectedUser || !actionType) return null;

    const configs = {
      approve: {
        title: "사용자 승인",
        description: `${selectedUser.name}님의 가입을 승인하시겠습니까?`,
        icon: <UserCheck className="h-6 w-6 text-green-600" />,
        buttonText: "승인",
        buttonVariant: "default" as const,
      },
      block: {
        title: "사용자 차단",
        description: `${selectedUser.name}님의 접근 권한을 차단하시겠습니까? 차단된 사용자는 서비스에 접근할 수 없습니다.`,
        icon: <AlertTriangle className="h-6 w-6 text-red-600" />,
        buttonText: "차단",
        buttonVariant: "destructive" as const,
      },
      unblock: {
        title: "차단 해제",
        description: `${selectedUser.name}님의 차단을 해제하시겠습니까?`,
        icon: <UserCheck className="h-6 w-6 text-green-600" />,
        buttonText: "차단 해제",
        buttonVariant: "default" as const,
      },
    };

    return configs[actionType];
  };

  const dialogConfig = getActionDialogContent();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">사용자 관리</h1>
          <p className="text-muted-foreground">
            팀원들의 접근 권한을 관리합니다.
          </p>
        </div>
        <Badge variant="outline" className="hidden sm:flex gap-1">
          <Shield className="h-3 w-3" />
          관리자 전용
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">승인 대기</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.pending}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">승인됨</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.approved}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">차단됨</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.blocked}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="이름 또는 이메일 검색..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[160px]">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="pending">승인 대기</SelectItem>
            <SelectItem value="approved">승인됨</SelectItem>
            <SelectItem value="blocked">차단됨</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User Table */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">사용자 목록</CardTitle>
              <CardDescription className="text-sm">
                회원가입 신청을 승인하거나 퇴사자의 접근 권한을 차단할 수
                있습니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[120px] font-semibold">
                    이름
                  </TableHead>
                  <TableHead className="font-semibold">이메일</TableHead>
                  <TableHead className="w-[80px] font-semibold text-center">
                    역할
                  </TableHead>
                  <TableHead className="w-[100px] font-semibold text-center">
                    상태
                  </TableHead>
                  <TableHead className="w-[100px] font-semibold text-center">
                    가입일
                  </TableHead>
                  <TableHead className="w-[80px] font-semibold text-center">
                    작업
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {searchQuery || statusFilter !== "all"
                        ? "검색 결과가 없습니다."
                        : "등록된 사용자가 없습니다."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.name}
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">
                              나
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.role === "admin" ? (
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="h-3 w-3" />
                            관리자
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            일반
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={statusConfig[user.status].variant}
                          className="gap-1"
                        >
                          {statusConfig[user.status].icon}
                          {statusConfig[user.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm text-center">
                        {format(new Date(user.created_at), "yyyy-MM-dd", {
                          locale: ko,
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.id !== currentUser?.id &&
                          user.role !== "admin" && (
                            <div className="flex justify-center gap-1">
                              {user.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleAction(user, "approve")}
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                              )}
                              {user.status === "approved" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleAction(user, "block")}
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              )}
                              {user.status === "blocked" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleAction(user, "unblock")}
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
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

      {/* Confirmation Dialog */}
      <Dialog
        open={!!actionType}
        onOpenChange={() => {
          setSelectedUser(null);
          setActionType(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              {dialogConfig?.icon}
              <DialogTitle>{dialogConfig?.title}</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {dialogConfig?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm">
                <strong>이름:</strong> {selectedUser.name}
                <br />
                <strong>이메일:</strong> {selectedUser.email}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedUser(null);
                setActionType(null);
              }}
            >
              취소
            </Button>
            <Button
              variant={dialogConfig?.buttonVariant}
              onClick={confirmAction}
            >
              {dialogConfig?.buttonText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
