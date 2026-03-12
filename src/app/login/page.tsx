"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export default function LoginScreen() {
  const router = useRouter()
  const { user, loading: authLoading, loginWithGoogle } = useAuth()
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // If already logged in, redirect to home
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/")
    }
  }, [authLoading, user, router])

  const handleGoogleLogin = async () => {
    setError("")
    setIsSubmitting(true)

    try {
      await loginWithGoogle()
      router.replace("/")
    } catch (err) {
      if (err instanceof Error && err.message === "허용되지 않은 계정입니다.") {
        setError("접근 권한이 없는 계정입니다. 관리자에게 문의해 주세요.")
      } else {
        setError("로그인에 실패했습니다. 다시 시도해 주세요.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show nothing while checking auth state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F5FFE]" />
      </div>
    )
  }

  // Already logged in, will redirect
  if (user) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] p-4 font-sans">
      <Card className="w-full max-w-[420px] shadow-sm rounded-none border-0">
        <CardHeader className="text-center pt-8 pb-2 px-8 flex flex-col gap-2">
          <h1 className="text-[28px] font-bold text-[#333333] tracking-tight">
            LX 세미콘 어린이집
          </h1>
          <p className="text-base font-medium text-[#5B5F66]">
            관리자 로그인
          </p>
        </CardHeader>
        <CardContent className="px-8 pt-6 pb-8">
          {error && (
            <div className="mb-6 px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm">
              {error}
            </div>
          )}
          <Button
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-[#333333] border border-[#E1E2E5] rounded-sm flex items-center justify-center gap-3 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {isSubmitting ? "로그인 중..." : "Google 계정으로 로그인"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
