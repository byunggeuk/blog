"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  LogOut,
  Settings,
  Users,
  FileText,
  Shield,
  User,
  BarChart3,
} from "lucide-react";
import { ProfileSettingsDialog } from "@/components/profile-settings-dialog";

interface HeaderProps {
  currentTab?: "dashboard" | "hospitals" | "users" | "statistics";
  onTabChange?: (
    tab: "dashboard" | "hospitals" | "users" | "statistics",
  ) => void;
}

export function Header({ currentTab = "dashboard", onTabChange }: HeaderProps) {
  const { user, authStatus, logout } = useApp();
  const isAuthenticated = authStatus === "authenticated";
  const isAdmin = user?.role === "admin";
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold hidden sm:inline">
              Hospital Blog Automation
            </span>
            <span className="text-lg font-semibold sm:hidden">HBA</span>
          </div>

          {/* Navigation Tabs (Admin Only) */}
          {isAuthenticated && isAdmin && onTabChange && (
            <nav className="flex items-center gap-1">
              <Button
                variant={currentTab === "dashboard" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onTabChange("dashboard")}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">대시보드</span>
              </Button>
              <Button
                variant={currentTab === "hospitals" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onTabChange("hospitals")}
                className="gap-2"
              >
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">병원 관리</span>
              </Button>
              <Button
                variant={currentTab === "users" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onTabChange("users")}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">사용자 관리</span>
              </Button>
              <Button
                variant={currentTab === "statistics" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onTabChange("statistics")}
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">통계</span>
              </Button>
            </nav>
          )}
        </div>

        {isAuthenticated && user && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {user.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">
                  {user.name}
                </span>
                {isAdmin && (
                  <Badge variant="secondary" className="gap-1 hidden sm:flex">
                    <Shield className="h-3 w-3" />
                    관리자
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 z-[100]"
              align="end"
              sideOffset={8}
            >
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{user.name}</p>
                    {isAdmin && (
                      <Badge variant="secondary" className="text-xs">
                        관리자
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setProfileDialogOpen(true)}>
                <User className="mr-2 h-4 w-4" />
                <span>프로필 설정</span>
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuItem
                    onSelect={() => (window.location.href = "/setup")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>시트 설정</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>로그아웃</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Profile Settings Dialog */}
        <ProfileSettingsDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
        />
      </div>
    </header>
  );
}
