"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Hospital } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Building2,
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
  FileText,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface HospitalFormData {
  hospital_name: string;
  blog_url: string;
  reference_folder_id: string;
  output_folder_id: string;
  prompt_name: string;
  system_prompt: string;
}

const initialFormData: HospitalFormData = {
  hospital_name: "",
  blog_url: "",
  reference_folder_id: "",
  output_folder_id: "",
  prompt_name: "",
  system_prompt: "",
};

export function HospitalManagement() {
  const { hospitals, refreshData } = useApp();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [deletingHospital, setDeletingHospital] = useState<Hospital | null>(
    null,
  );
  const [formData, setFormData] = useState<HospitalFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);

  const activeHospitals = hospitals.filter((h) => h.is_active !== false);

  const handleOpenAdd = () => {
    setEditingHospital(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setFormData({
      hospital_name: hospital.hospital_name,
      blog_url: hospital.blog_url || "",
      reference_folder_id: hospital.reference_folder_id || "",
      output_folder_id: hospital.output_folder_id || "",
      prompt_name: hospital.prompt_name || "",
      system_prompt: hospital.system_prompt || "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (hospital: Hospital) => {
    setDeletingHospital(hospital);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.hospital_name.trim()) {
      alert("병원 이름을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      if (editingHospital) {
        // 수정
        const response = await fetch("/api/hospitals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editingHospital,
            ...formData,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "수정 실패");
        }
      } else {
        // 추가
        const response = await fetch("/api/hospitals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "추가 실패");
        }
      }

      await refreshData();
      setIsDialogOpen(false);
      setFormData(initialFormData);
    } catch (error) {
      alert(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingHospital) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/hospitals?id=${deletingHospital.hospital_id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "삭제 실패");
      }

      await refreshData();
      setIsDeleteDialogOpen(false);
      setDeletingHospital(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">병원 관리</h1>
          <p className="text-muted-foreground">
            블로그를 생성할 병원 정보를 관리합니다.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          병원 추가
        </Button>
      </div>

      {/* Hospital List */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">등록된 병원</CardTitle>
              <CardDescription className="text-sm">
                총 {activeHospitals.length}개의 병원이 등록되어 있습니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">병원명</TableHead>
                  <TableHead className="font-semibold">프롬프트</TableHead>
                  <TableHead className="font-semibold">폴더</TableHead>
                  <TableHead className="font-semibold text-center">
                    등록일
                  </TableHead>
                  <TableHead className="font-semibold text-center w-[100px]">
                    작업
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeHospitals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      등록된 병원이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeHospitals.map((hospital) => (
                    <TableRow
                      key={hospital.hospital_id}
                      className="hover:bg-muted/30"
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {hospital.hospital_name}
                          </span>
                          {hospital.blog_url && (
                            <a
                              href={hospital.blog_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              블로그
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hospital.prompt_name ? (
                          <Badge variant="secondary" className="gap-1">
                            <FileText className="h-3 w-3" />
                            {hospital.prompt_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            미설정
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {hospital.output_folder_id && (
                            <Badge variant="outline" className="gap-1">
                              <FolderOpen className="h-3 w-3" />
                              출력
                            </Badge>
                          )}
                          {hospital.reference_folder_id && (
                            <Badge variant="outline" className="gap-1">
                              <FolderOpen className="h-3 w-3" />
                              참조
                            </Badge>
                          )}
                          {!hospital.output_folder_id &&
                            !hospital.reference_folder_id && (
                              <span className="text-muted-foreground text-sm">
                                미설정
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {hospital.created_at
                          ? format(
                              new Date(hospital.created_at),
                              "yyyy-MM-dd",
                              { locale: ko },
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => handleOpenEdit(hospital)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() => handleOpenDelete(hospital)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingHospital ? "병원 수정" : "병원 추가"}
            </DialogTitle>
            <DialogDescription>
              {editingHospital
                ? "병원 정보를 수정합니다."
                : "새로운 병원을 등록합니다."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="hospital_name">병원명 *</Label>
              <Input
                id="hospital_name"
                value={formData.hospital_name}
                onChange={(e) =>
                  setFormData({ ...formData, hospital_name: e.target.value })
                }
                placeholder="예: OO성형외과"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="blog_url">블로그 URL</Label>
              <Input
                id="blog_url"
                value={formData.blog_url}
                onChange={(e) =>
                  setFormData({ ...formData, blog_url: e.target.value })
                }
                placeholder="https://blog.naver.com/..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="output_folder_id">출력 폴더 ID</Label>
                <Input
                  id="output_folder_id"
                  value={formData.output_folder_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      output_folder_id: e.target.value,
                    })
                  }
                  placeholder="Google Drive 폴더 ID"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reference_folder_id">참조 폴더 ID</Label>
                <Input
                  id="reference_folder_id"
                  value={formData.reference_folder_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reference_folder_id: e.target.value,
                    })
                  }
                  placeholder="Google Drive 폴더 ID"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="prompt_name">프롬프트 이름</Label>
              <Input
                id="prompt_name"
                value={formData.prompt_name}
                onChange={(e) =>
                  setFormData({ ...formData, prompt_name: e.target.value })
                }
                placeholder="예: 성형외과_기본프롬프트"
              />
              <p className="text-xs text-muted-foreground">
                시트에 표시될 짧은 이름입니다.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="system_prompt">시스템 프롬프트</Label>
              <Textarea
                id="system_prompt"
                value={formData.system_prompt}
                onChange={(e) =>
                  setFormData({ ...formData, system_prompt: e.target.value })
                }
                placeholder="블로그 글 생성 시 사용할 시스템 프롬프트를 입력하세요..."
                rows={10}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "저장 중..." : editingHospital ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>병원 삭제</DialogTitle>
            <DialogDescription>
              정말로 "{deletingHospital?.hospital_name}"을(를) 삭제하시겠습니까?
              삭제된 병원은 목록에서 제외되며, 기존 요청 기록은 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
