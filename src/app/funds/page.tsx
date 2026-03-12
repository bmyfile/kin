"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { collection, doc, getDocs, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { AppLayout } from "@/components/layout/app-layout"
import { Plus, X } from "lucide-react"

// ── Types ────────────────────────────────────────────
type MonthData = {
  [categoryId: string]: {
    amount: number
    memo: string
  }
}

type FundsData = {
  year: number
  categories: string[] // category names
  months: { [month: string]: MonthData } // "1"~"12"
  subsidies: { [categoryId: string]: number } // 지원금 per category
}

// ── Memo Modal ───────────────────────────────────────
function MemoModal({
  isOpen,
  onClose,
  month,
  category,
  memo,
  onSave,
}: {
  isOpen: boolean
  onClose: () => void
  month: number
  category: string
  memo: string
  onSave: (memo: string) => void
}) {
  const [text, setText] = useState(memo)

  useEffect(() => { setText(memo) }, [memo])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-[480px] p-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#333]">
            메모 ({month}월)
          </h3>
          <button onClick={onClose} className="text-[#9DA4B3] hover:text-[#333] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-[#9DA4B3]">
          해당 월의 사업체 지원 내역에 대한 메모를 확인/작성하세요.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-40 p-4 border border-[#E1E2E5] text-sm text-[#333] resize-none focus:outline-none focus:ring-1 focus:ring-[#333]"
          placeholder={`${month}월 ${category} 관련 메모를 입력하세요...`}
        />
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 cursor-pointer"
            onClick={() => { onSave(text); onClose() }}
          >
            + 저장
          </Button>
          <Button
            type="button"
            variant="outline"
            className="px-6 cursor-pointer"
            onClick={onClose}
          >
            + 닫기
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────
export default function FundsPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [categories, setCategories] = useState<string[]>(["현장학습비", "숲체험비"])
  const [monthsData, setMonthsData] = useState<{ [month: string]: MonthData }>({})
  const [subsidies, setSubsidies] = useState<{ [cat: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Unsaved changes modal
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const pendingNavRef = useRef<string | null>(null)
  const router = useRouter()

  // Memo modal state
  const [memoOpen, setMemoOpen] = useState(false)
  const [memoMonth, setMemoMonth] = useState(1)
  const [memoCat, setMemoCat] = useState("")

  const docId = `funds-${selectedYear}`

  // Load data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, "funds"))
      const found = snap.docs.find((d) => d.id === docId)
      if (found) {
        const data = found.data() as FundsData
        setCategories(data.categories || ["현장학습비", "숲체험비"])
        setMonthsData(data.months || {})
        setSubsidies(data.subsidies || {})
      } else {
        setCategories(["현장학습비", "숲체험비"])
        setMonthsData({})
        setSubsidies({})
      }
    } catch (err) {
      console.error("Error fetching funds:", err)
    } finally {
      setLoading(false)
    }
  }, [docId])

  useEffect(() => { fetchData() }, [fetchData])

  // Save data
  const saveData = useCallback(async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, "funds", docId), {
        year: selectedYear,
        categories,
        months: monthsData,
        subsidies,
      })
    } catch (err) {
      console.error("Error saving funds:", err)
    } finally {
      setSaving(false)
    }
  }, [docId, selectedYear, categories, monthsData, subsidies])

  // Browser beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  const handleNavigation = (href: string) => {
    if (isDirty) {
      pendingNavRef.current = href
      setShowUnsavedModal(true)
    } else {
      router.push(href)
    }
  }

  const handleSaveAndNavigate = async () => {
    await saveData()
    setIsDirty(false)
    setShowUnsavedModal(false)
    if (pendingNavRef.current) router.push(pendingNavRef.current)
  }

  const handleDiscardAndNavigate = () => {
    setIsDirty(false)
    setShowUnsavedModal(false)
    if (pendingNavRef.current) router.push(pendingNavRef.current)
  }

  // Update amount
  const updateAmount = (month: number, cat: string, value: string) => {
    const numVal = parseInt(value.replace(/,/g, "")) || 0
    setIsDirty(true)
    setMonthsData((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        [cat]: { ...(prev[month]?.[cat] || { amount: 0, memo: "" }), amount: numVal },
      },
    }))
  }

  // Update memo
  const updateMemo = (month: number, cat: string, memo: string) => {
    setIsDirty(true)
    setMonthsData((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        [cat]: { ...(prev[month]?.[cat] || { amount: 0, memo: "" }), memo },
      },
    }))
  }

  // Update subsidy
  const updateSubsidy = (cat: string, value: string) => {
    const numVal = parseInt(value.replace(/,/g, "")) || 0
    setIsDirty(true)
    setSubsidies((prev) => ({ ...prev, [cat]: numVal }))
  }

  // Add category
  const addCategory = () => {
    const name = prompt("추가할 항목 이름을 입력하세요:")
    if (name && !categories.includes(name)) {
      setIsDirty(true)
      setCategories((prev) => [...prev, name])
    }
  }

  // Remove category
  const removeCategory = (cat: string) => {
    if (!confirm(`"${cat}" 항목을 삭제하시겠습니까?`)) return
    setIsDirty(true)
    setCategories((prev) => prev.filter((c) => c !== cat))
  }

  // Calculations
  const getAmount = (month: number, cat: string) => monthsData[month]?.[cat]?.amount || 0
  const getMemo = (month: number, cat: string) => monthsData[month]?.[cat]?.memo || ""

  const getCategoryTotal = (cat: string) => {
    let sum = 0
    for (let m = 1; m <= 12; m++) sum += getAmount(m, cat)
    return sum
  }

  const getCategoryHalfTotal = (cat: string, half: "상반기" | "하반기") => {
    let sum = 0
    const start = half === "상반기" ? 1 : 7
    const end = half === "상반기" ? 6 : 12
    for (let m = start; m <= end; m++) sum += getAmount(m, cat)
    return sum
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  return (
    <>
    <AppLayout onBeforeNavigate={(href) => {
      if (isDirty) {
        pendingNavRef.current = href
        setShowUnsavedModal(true)
        return false
      }
      return true
    }}>
      <div className="flex flex-col gap-6 font-sans -mx-8 -mt-8">
        <div className="px-8 pt-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-[24px] font-bold text-[#333] tracking-tight">
              사업체 지원금 현황 및 입력 (연간)
            </h1>
            <div className="flex items-center gap-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-10 px-4 border border-[#E1E2E5] bg-white text-sm text-[#333] focus:outline-none cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <Button
                onClick={async () => { await saveData(); setIsDirty(false) }}
                disabled={saving}
                className="bg-[#17181A] hover:bg-[#333] text-white px-6 cursor-pointer"
              >
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="px-8 pb-8">
          {categories.length === 0 ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center py-24 bg-white border-2 border-dashed border-[#E1E2E5] rounded-xl">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-[#333] mb-2">등록된 지원금 항목이 없습니다</h3>
              <p className="text-sm text-[#9DA4B3] mb-6">아래 버튼을 눌러 지원금 항목을 추가하세요.</p>
              <Button
                onClick={addCategory}
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 cursor-pointer"
              >
                + 항목 추가
              </Button>
            </div>
          ) : (
          <div className="flex gap-0 items-stretch min-h-[600px]">
          <div className="overflow-x-auto border-2 border-[#E1E2E5] bg-white flex-1">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 60 + categories.length * 220 }}>
              {/* Header row 1 — label */}
              <thead>
                <tr className="bg-[#F9F9F9]">
                  <th className="bg-[#F9F9F9] border-r border-b border-[#E1E2E5] w-[60px] h-[40px]" />
                  <th
                    colSpan={categories.length}
                    className="text-center font-medium text-[#9DA4B3] text-sm border-r border-b border-[#E1E2E5] h-[40px]"
                  >
                    사업체 지원금만 해당
                  </th>
                </tr>
                {/* Header row 2 — categories */}
                <tr className="bg-[#F9F9F9]">
                  <th className="bg-[#F9F9F9] border-r border-b border-[#E1E2E5] w-[60px] h-[40px]" />
                  {categories.map((cat) => (
                    <th
                      key={cat}
                      className="text-center font-medium text-[#5B5F66] text-sm border-r border-b border-[#E1E2E5] w-[220px] h-[40px]"
                    >
                      <div className="flex items-center justify-center gap-2">
                        {cat}
                        <button
                          onClick={() => removeCategory(cat)}
                          className="text-[#ccc] hover:text-red-500 text-xs cursor-pointer"
                          title="항목 삭제"
                        >
                          ✕
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={2 + categories.length} className="h-24 text-center text-[#9DA4B3]">
                      데이터를 불러오는 중입니다...
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Monthly rows 1~12 */}
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <tr key={month} className="border-b border-[#E1E2E5]">
                        <td className="text-center text-sm text-[#333] bg-[#F9F9F9] border-r border-[#E1E2E5] w-[60px] h-[48px]">
                          {month}
                        </td>
                        {categories.map((cat) => (
                          <td key={cat} className="border-r border-[#E1E2E5] w-[220px] h-[48px] p-[6px]">
                            <div className="flex items-center gap-[6px]">
                              <Input
                                type="text"
                                value={getAmount(month, cat) ? getAmount(month, cat).toLocaleString() : ""}
                                onChange={(e) => updateAmount(month, cat, e.target.value)}
                                placeholder="0"
                                className="h-[36px] text-sm text-right flex-1"
                              />
                              <button
                                onClick={() => {
                                  setMemoMonth(month)
                                  setMemoCat(cat)
                                  setMemoOpen(true)
                                }}
                                className="border border-[#E1E2E5] px-2 py-1 text-sm hover:bg-gray-50 cursor-pointer shrink-0"
                                title="메모"
                              >
                                📝
                              </button>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}

                    {/* 합계 row */}
                    <tr className="bg-[#F9F9F9] border-b border-[#E1E2E5]">
                      <td className="text-center text-sm font-semibold text-[#5B5F66] bg-[#F9F9F9] border-r border-[#E1E2E5] w-[60px] h-[40px]">
                        합계
                      </td>
                      {categories.map((cat) => (
                        <td
                          key={cat}
                          className="text-right font-semibold text-[#333] pr-4 bg-[#F9F9F9] border-r border-[#E1E2E5] w-[220px] h-[40px] text-[15px]"
                        >
                          ₩ {getCategoryTotal(cat).toLocaleString()}
                        </td>
                      ))}
                    </tr>

                    {/* 지원금 row */}
                    <tr className="border-b border-[#E1E2E5]">
                      <td className="text-center text-sm font-medium text-[#333] bg-white border-r border-[#E1E2E5] w-[60px] h-[40px]">
                        지원금
                      </td>
                      {categories.map((cat) => (
                        <td
                          key={cat}
                          className="border-r border-[#E1E2E5] w-[220px] h-[40px] p-[6px]"
                        >
                          <Input
                            type="text"
                            value={subsidies[cat] ? subsidies[cat].toLocaleString() : ""}
                            onChange={(e) => updateSubsidy(cat, e.target.value)}
                            placeholder="0"
                            className="h-[34px] text-sm text-right"
                          />
                        </td>
                      ))}
                    </tr>

                    {/* 상반기 row */}
                    <tr className="border-b border-[#E1E2E5]">
                      <td className="text-center text-sm text-[#9DA4B3] bg-white border-r border-[#E1E2E5] w-[60px] h-[40px]">
                        상반기
                      </td>
                      {categories.map((cat) => (
                        <td
                          key={cat}
                          className="text-right text-sm text-[#9DA4B3] pr-4 border-r border-[#E1E2E5] w-[220px] h-[40px]"
                        >
                          ₩ {getCategoryHalfTotal(cat, "상반기").toLocaleString()}
                        </td>
                      ))}
                    </tr>

                    {/* 하반기 row */}
                    <tr className="border-b border-[#E1E2E5]">
                      <td className="text-center text-sm text-[#9DA4B3] bg-white border-r border-[#E1E2E5] w-[60px] h-[40px]">
                        하반기
                      </td>
                      {categories.map((cat) => (
                        <td
                          key={cat}
                          className="text-right text-sm text-[#9DA4B3] pr-4 border-r border-[#E1E2E5] w-[220px] h-[40px]"
                        >
                          ₩ {getCategoryHalfTotal(cat, "하반기").toLocaleString()}
                        </td>
                      ))}
                    </tr>

                    {/* 잔액 row */}
                    <tr className="bg-[#F9F9F9] border-b border-[#E1E2E5]">
                      <td className="text-center text-sm font-semibold text-[#333] bg-[#F9F9F9] border-r border-[#E1E2E5] w-[60px] h-[40px]">
                        잔액
                      </td>
                      {categories.map((cat) => {
                        const balance = (subsidies[cat] || 0) - getCategoryTotal(cat)
                        return (
                          <td
                            key={cat}
                            className={`text-right font-semibold pr-4 border-r border-[#E1E2E5] w-[220px] h-[40px] text-[15px] bg-[#F9F9F9] ${
                              balance >= 0 ? "text-[#2563EB]" : "text-[#E83838]"
                            }`}
                          >
                            ₩ {balance.toLocaleString()}
                          </td>
                        )
                      })}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          {/* Vertical Add Button */}
          <button
            onClick={addCategory}
            className="w-[48px] shrink-0 border-2 border-dashed border-[#D1D5DB] bg-[#FAFAFA] hover:bg-[#F0F0F0] hover:border-[#9DA4B3] transition-colors cursor-pointer flex items-center justify-center rounded-r-lg"
            title="항목 추가"
          >
            <Plus className="w-6 h-6 text-[#9DA4B3]" />
          </button>
          </div>
          )}
        </div>
      </div>
    </AppLayout>

    {/* Unsaved Changes Modal — Portal to #modal-root */}
    {typeof window !== 'undefined' && showUnsavedModal && createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 pointer-events-auto">
        <div className="bg-white rounded-xl shadow-xl w-[400px] p-8 flex flex-col gap-4">
          <div className="text-4xl text-center">⚠️</div>
          <h3 className="text-lg font-bold text-[#333] text-center">
            저장되지 않은 변경사항
          </h3>
          <p className="text-sm text-[#5B5F66] text-center">
            변경사항이 저장되지 않았습니다.<br />저장하시겠습니까?
          </p>
          <div className="flex gap-3 mt-4">
            <Button
              className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8] text-white cursor-pointer h-12 text-base font-bold"
              onClick={handleSaveAndNavigate}
            >
              저장 후 이동
            </Button>
            <Button
              variant="outline"
              className="flex-1 cursor-pointer h-12 text-base font-medium border-[#E1E2E5] text-[#E83838] hover:bg-red-50 hover:border-red-200"
              onClick={handleDiscardAndNavigate}
            >
              저장하지 않고 이동
            </Button>
          </div>
        </div>
      </div>,
      document.getElementById('modal-root')!
    )}

    {/* Memo Modal — Portal to #modal-root */}
    {typeof window !== 'undefined' && memoOpen && createPortal(
      <div className="fixed inset-0 z-[99999] pointer-events-auto">
        <MemoModal
          isOpen={memoOpen}
          onClose={() => setMemoOpen(false)}
          month={memoMonth}
          category={memoCat}
          memo={getMemo(memoMonth, memoCat)}
          onSave={(text: string) => updateMemo(memoMonth, memoCat, text)}
        />
      </div>,
      document.getElementById('modal-root')!
    )}
    </>
  )
}
