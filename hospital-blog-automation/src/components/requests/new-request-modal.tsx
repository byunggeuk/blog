"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { formatOptions } from "@/lib/mock-data";
import { NewRequestFormData, FormatType } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";

interface NewRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewRequestModal({ open, onOpenChange }: NewRequestModalProps) {
  const { createRequest, hospitals } = useApp();
  const activeHospitals = hospitals.filter((h) => h.is_active !== false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomFormat, setShowCustomFormat] = useState(false);
  const [formData, setFormData] = useState<NewRequestFormData>({
    hospital_id: "",
    target_keyword: "",
    topic_keyword: "",
    purpose: "",
    format_type: "Q&A형",
    format_custom: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createRequest(formData);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create request:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      hospital_id: "",
      target_keyword: "",
      topic_keyword: "",
      purpose: "",
      format_type: "Q&A형",
      format_custom: "",
    });
    setShowCustomFormat(false);
  };

  const handleFormatChange = (value: FormatType) => {
    setFormData({ ...formData, format_type: value });
    setShowCustomFormat(value === "기타");
  };

  const isValid =
    formData.hospital_id &&
    formData.target_keyword &&
    formData.topic_keyword &&
    formData.purpose &&
    formData.format_type &&
    (formData.format_type !== "기타" || formData.format_custom);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />새 글 요청
          </DialogTitle>
          <DialogDescription>
            블로그 글 생성에 필요한 정보를 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="hospital" className="text-sm font-medium">
                병원 선택 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.hospital_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, hospital_id: value })
                }
              >
                <SelectTrigger id="hospital">
                  <SelectValue placeholder="병원을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {activeHospitals.map((hospital) => (
                    <SelectItem
                      key={hospital.hospital_id}
                      value={hospital.hospital_id}
                    >
                      {hospital.hospital_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_keyword" className="text-sm font-medium">
                타겟 키워드 (SEO) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="target_keyword"
                placeholder="예: 유방암수술후부종"
                value={formData.target_keyword}
                onChange={(e) =>
                  setFormData({ ...formData, target_keyword: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                검색 최적화를 위한 메인 키워드
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic_keyword" className="text-sm font-medium">
                주제 키워드 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="topic_keyword"
                placeholder="예: 바이오브릿지 수술"
                value={formData.topic_keyword}
                onChange={(e) =>
                  setFormData({ ...formData, topic_keyword: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                글에서 다룰 주요 주제
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose" className="text-sm font-medium">
                글의 목적 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="purpose"
                placeholder="글을 통해 전달하고자 하는 메시지와 타겟 독자를 설명해주세요..."
                className="min-h-[100px] resize-none"
                value={formData.purpose}
                onChange={(e) =>
                  setFormData({ ...formData, purpose: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="format_type" className="text-sm font-medium">
                글의 구조 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.format_type}
                onValueChange={handleFormatChange}
              >
                <SelectTrigger id="format_type">
                  <SelectValue placeholder="구조를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.format_type && formData.format_type !== "기타" && (
                <p className="text-xs text-muted-foreground">
                  {
                    formatOptions.find((o) => o.value === formData.format_type)
                      ?.description
                  }
                </p>
              )}
            </div>

            {showCustomFormat && (
              <div className="space-y-2">
                <Label htmlFor="format_custom" className="text-sm font-medium">
                  글 구조 상세 설명 <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="format_custom"
                  placeholder="원하는 글의 구조와 형식을 자세히 설명해주세요..."
                  className="min-h-[80px] resize-none"
                  value={formData.format_custom}
                  onChange={(e) =>
                    setFormData({ ...formData, format_custom: e.target.value })
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  요청 중...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />글 생성 요청
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
