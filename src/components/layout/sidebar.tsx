"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, Bus, Wallet, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

export function Sidebar({ onBeforeNavigate }: { onBeforeNavigate?: (href: string) => boolean }) {
  const pathname = usePathname();

  const menuItems = [
    { href: "/students", icon: Users, label: "원아관리" },
    { href: "/trips", icon: Bus, label: "체험학습관리" },
    { href: "/funds", icon: Wallet, label: "사업체 지원금 관리" },
    { href: "/trip-status", icon: LayoutDashboard, label: "체험학습현황" },
  ]

  return (
    <aside className="w-64 bg-[#F2F3F0] border-r border-[#E1E2E5] flex flex-col h-full shrink-0">
      <div className="p-8 pb-4">
        <h2 className="text-[20px] font-bold tracking-tight text-[#17181A] mb-1">
          LX 세미콘 어린이집
        </h2>
        <p className="text-[14px] text-[#5B5F66]">관리자 시스템</p>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-4">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={(e) => {
                    if (onBeforeNavigate && !onBeforeNavigate(item.href)) {
                      e.preventDefault()
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-[15px] font-medium rounded-md transition-colors",
                    isActive 
                      ? "bg-[#17181A] text-white shadow-sm"
                      : "text-[#5B5F66] hover:bg-[#E1E2E5]/50 hover:text-[#17181A]"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  )
}
