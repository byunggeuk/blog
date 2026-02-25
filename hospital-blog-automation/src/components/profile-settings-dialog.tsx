"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/store";
import { User } from "lucide-react";

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsDialog({
  open,
  onOpenChange,
}: ProfileSettingsDialogProps) {
  const { user } = useApp();
  const [slackMemberId, setSlackMemberId] = useState(
    user?.slack_member_id || "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          action: "update_slack_id",
          slackMemberId,
        }),
      });

      if (!response.ok) {
        throw new Error("저장에 실패했습니다.");
      }

      setMessage({ type: "success", text: "Slack ID가 저장되었습니다." });

      // 잠시 후 다이얼로그 닫기
      setTimeout(() => {
        onOpenChange(false);
        setMessage(null);
      }, 1500);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "오류가 발생했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            프로필 설정
          </DialogTitle>
          <DialogDescription>
            개인 알림을 받으려면 Slack Member ID를 설정하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={user?.name || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slack_id">Slack Member ID</Label>
            <Input
              id="slack_id"
              placeholder="예: U0123456789"
              value={slackMemberId}
              onChange={(e) => setSlackMemberId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Slack 프로필 {">"} 더보기 {">"} Member ID 복사에서 확인할 수
              있습니다.
            </p>
          </div>
          {message && (
            <p
              className={`text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}
            >
              {message.text}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
