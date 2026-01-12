'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Building2, Loader2, UserPlus, Clock, Ban, ArrowLeft } from 'lucide-react';

type AuthView = 'login' | 'signup';

export function LoginPage() {
  const { login, signUp } = useApp();
  const [view, setView] = useState<AuthView>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign up form state
  const [signUpData, setSignUpData] = useState({
    email: '',
    name: '',
  });

  const handleGoogleLogin = (asAdmin: boolean) => {
    setIsLoading(true);
    setTimeout(() => {
      login(asAdmin);
      setIsLoading(false);
    }, 500);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signUp(signUpData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );

  if (view === 'signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
            <CardDescription>
              가입 후 관리자 승인이 필요합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={signUpData.email}
                  onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  placeholder="홍길동"
                  value={signUpData.name}
                  onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button type="submit" className="w-full h-12" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    가입 중...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    회원가입
                  </>
                )}
              </Button>
            </form>

            <Separator />

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setView('login')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              로그인으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Hospital Blog Automation</CardTitle>
          <CardDescription>
            병원 블로그 글 자동 생성 시스템
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            내부 직원만 접근 가능합니다.<br />
            회사 Google 계정으로 로그인해주세요.
          </p>

          {/* Demo 로그인 버튼들 */}
          <div className="space-y-2">
            <Button
              onClick={() => handleGoogleLogin(true)}
              className="w-full h-12 text-base"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              관리자로 로그인 (데모)
            </Button>
            <Button
              onClick={() => handleGoogleLogin(false)}
              variant="outline"
              className="w-full h-12 text-base"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              일반 사용자로 로그인 (데모)
            </Button>
          </div>

          <Separator />

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              아직 계정이 없으신가요?
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setView('signup')}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              회원가입
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            로그인 시 서비스 이용약관에 동의합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// 승인 대기 화면
export function PendingApprovalPage() {
  const { logout, user } = useApp();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-amber-100 p-3">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">승인 대기 중</CardTitle>
          <CardDescription>
            관리자의 승인을 기다리고 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              <strong>{user?.name}</strong>님의 계정이 생성되었습니다.<br /><br />
              관리자가 승인하면 서비스를 이용하실 수 있습니다.
              승인 완료 시 별도 알림이 발송됩니다.
            </p>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            이메일: {user?.email}
          </div>

          <Separator />

          <Button variant="outline" className="w-full" onClick={logout}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            로그인 화면으로
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// 차단된 사용자 화면
export function BlockedUserPage() {
  const { logout, user } = useApp();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-red-100 p-3">
              <Ban className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">접근 권한 없음</CardTitle>
          <CardDescription>
            계정이 비활성화되었습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">
              <strong>{user?.name}</strong>님의 계정 접근 권한이 해제되었습니다.<br /><br />
              문의사항이 있으시면 관리자에게 연락해주세요.
            </p>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            이메일: {user?.email}
          </div>

          <Separator />

          <Button variant="outline" className="w-full" onClick={logout}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            로그인 화면으로
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
