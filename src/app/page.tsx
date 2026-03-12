import { AppLayout } from "@/components/layout/app-layout"

export default function Home() {
  return (
    <AppLayout>
      <div className="min-h-screen p-8">
        <h1 className="text-3xl font-bold mb-4">LX 세미콘 어린이집 관리자 대시보드</h1>
        <p className="text-muted-foreground">로그인 성공! 사이드바에서 메뉴를 선택해주세요.</p>
      </div>
    </AppLayout>
  )
}
