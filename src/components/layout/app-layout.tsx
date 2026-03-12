"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "./sidebar"
import { useAuth } from "@/lib/auth-context"
import { Loader2, LogOut } from "lucide-react"

export function AppLayout({
  children,
  onBeforeNavigate,
}: {
  children: React.ReactNode
  onBeforeNavigate?: (href: string) => boolean
}) {
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, user, router])

  const handleLogout = async () => {
    await logout()
    router.replace("/login")
  }

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F5F5]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F5FFE]" />
      </div>
    )
  }

  // Not authenticated — will redirect
  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F5] font-sans">
      <Sidebar onBeforeNavigate={onBeforeNavigate} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-16 shrink-0 flex items-center justify-between px-8 bg-[#F5F5F5] border-b border-[#E1E2E5]">
          <span className="text-[18px] font-semibold text-[#333333]">이현선 원장님, 늘 행복하세요!</span>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[#5B5F66] bg-white border border-[#E1E2E5] rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto w-full p-8">
          <div className="mx-auto w-full max-w-[900px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
