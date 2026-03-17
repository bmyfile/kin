"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  categories: string[]
  months: { [month: string]: MonthData }
  subsidies: { [categoryId: string]: number }
}

type TripForFunds = {
  id: string
  name: string
  date: string
  fundAllocations: { category: string; amount: number }[]
}

type CellTripDetail = {
  tripId: string
  tripName: string
  tripDate: string
  amount: number
}

// ── Cell Detail Modal ────────────────────────────────
function CellDetailModal({
  isOpen,
  onClose,
  month,
  category,
  tripDetails,
  totalAmount,
  memo,
  onSaveMemo,
}: {
  isOpen: boolean
  onClose: () => void
  month: number
  category: string
  tripDetails: CellTripDetail[]
  totalAmount: number
  memo: string
  onSaveMemo: (memo: string) => void
}) {
  const [text, setText] = useState(memo)

  useEffect(() => { setText(memo) }, [memo])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-[480px] p-8 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#333]">
            {month}월 - {category}
          </h3>
          <button onClick={onClose} className="text-[#9DA4B3] hover:text-[#333] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Trip list */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[#5B5F66]">체험학습 내역</span>
          {tripDetails.length === 0 ? (
            <p className="text-sm text-[#9DA4B3] py-3 text-center border border-dashed border-[#E1E2E5] rounded">
              이 월에 해당 항목의 배정된 체험학습이 없습니다.
            </p>
          ) : (
            <div className="border border-[#E1E2E5] rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9F9F9] border-b border-[#E1E2E5]">
                    <th className="text-left px-3 py-2 font-medium text-[#5B5F66]">체험학습명</th>
                    <th className="text-center px-3 py-2 font-medium text-[#5B5F66] w-[90px]">날짜</th>
                    <th className="text-right px-3 py-2 font-medium text-[#5B5F66] w-[100px]">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {tripDetails.map((td) => (
                    <tr key={td.tripId} className="border-b border-[#E1E2E5] last:border-b-0">
                      <td className="px-3 py-2 text-[#333]">{td.tripName}</td>
                      <td className="px-3 py-2 text-center text-[#5B5F66]">
                        {td.tripDate ? td.tripDate.slice(5).replace("-", ".") : "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-[#333]">
                        {td.amount.toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-3 py-2 bg-[#F9F9F9] border-t border-[#E1E2E5]">
                <span className="text-sm font-medium text-[#5B5F66]">합계</span>
                <span className="text-sm font-semibold text-[#333]">
                  {totalAmount.toLocaleString()}원
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Memo */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[#5B5F66]">메모</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-28 p-3 border border-[#E1E2E5] text-sm text-[#333] resize-none focus:outline-none focus:ring-1 focus:ring-[#333] rounded"
            placeholder={`${month}월 ${category} 관련 메모를 입력하세요...`}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 cursor-pointer"
            onClick={() => { onSaveMemo(text); onClose() }}
          >
            저장
          </Button>
          <Button
            type="button"
            variant="outline"
            className="px-6 cursor-pointer"
            onClick={onClose}
          >
            닫기
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
  const [trips, setTrips] = useState<TripForFunds[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Unsaved changes modal
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const pendingNavRef = useRef<string | null>(null)
  const router = useRouter()

  // Cell detail modal state
  const [cellModalOpen, setCellModalOpen] = useState(false)
  const [cellModalMonth, setCellModalMonth] = useState(1)
  const [cellModalCat, setCellModalCat] = useState("")

  const docId = `funds-${selectedYear}`

  // ── Aggregated trip data ──────────────────────────
  const aggregatedAmounts = useMemo(() => {
    const result: { [month: string]: { [cat: string]: number } } = {}
    for (const trip of trips) {
      if (!trip.date) continue
      const month = String(new Date(trip.date).getMonth() + 1)
      if (!result[month]) result[month] = {}
      for (const alloc of trip.fundAllocations || []) {
        result[month][alloc.category] = (result[month][alloc.category] || 0) + alloc.amount
      }
    }
    return result
  }, [trips])

  const cellTripDetails = useMemo(() => {
    const result: { [key: string]: CellTripDetail[] } = {}
    for (const trip of trips) {
      if (!trip.date) continue
      const month = String(new Date(trip.date).getMonth() + 1)
      for (const alloc of trip.fundAllocations || []) {
        const key = `${month}-${alloc.category}`
        if (!result[key]) result[key] = []
        result[key].push({
          tripId: trip.id,
          tripName: trip.name,
          tripDate: trip.date,
          amount: alloc.amount,
        })
      }
    }
    return result
  }, [trips])

  // ── Load data ─────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [fundsSnap, tripsSnap] = await Promise.all([
        getDocs(collection(db, "funds")),
        getDocs(collection(db, "trips")),
      ])

      // Funds doc (categories, subsidies, memos)
      const found = fundsSnap.docs.find((d) => d.id === docId)
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

      // Trips for selected year
      const allTrips: TripForFunds[] = tripsSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || "",
        date: d.data().date || "",
        fundAllocations: (d.data().fundAllocations || []).map((f: { category: string; amount: number }) => ({
          category: f.category,
          amount: Number(f.amount) || 0,
        })),
      }))
      setTrips(allTrips.filter((t) => {
        if (!t.date) return false
        return new Date(t.date).getFullYear() === selectedYear
      }))
    } catch (err) {
      console.error("Error fetching funds:", err)
    } finally {
      setLoading(false)
    }
  }, [docId, selectedYear])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Save data ─────────────────────────────────────
  const saveData = useCallback(async () => {
    setSaving(true)
    try {
      // Only persist memos (amount: 0)
      const memosOnly: { [month: string]: MonthData } = {}
      for (const [month, cats] of Object.entries(monthsData)) {
        for (const [cat, data] of Object.entries(cats)) {
          if (data.memo) {
            if (!memosOnly[month]) memosOnly[month] = {}
            memosOnly[month][cat] = { amount: 0, memo: data.memo }
          }
        }
      }
      await setDoc(doc(db, "funds", docId), {
        year: selectedYear,
        categories,
        months: memosOnly,
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

  // ── Calculations (from aggregated trip data) ──────
  const getAmount = (month: number, cat: string) =>
    aggregatedAmounts[String(month)]?.[cat] || 0

  const getMemo = (month: number, cat: string) =>
    monthsData[month]?.[cat]?.memo || ""

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
              사업체 지원금 현황 (연간)
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
                        {categories.map((cat) => {
                          const amount = getAmount(month, cat)
                          const hasMemo = !!getMemo(month, cat)
                          return (
                            <td
                              key={cat}
                              className="border-r border-[#E1E2E5] w-[220px] h-[48px] p-[6px] cursor-pointer hover:bg-[#F5F8FF] transition-colors"
                              onClick={() => {
                                setCellModalMonth(month)
                                setCellModalCat(cat)
                                setCellModalOpen(true)
                              }}
                            >
                              <div className="flex items-center justify-between px-2 h-full">
                                <span className="text-sm text-right flex-1 text-[#333]">
                                  {amount ? `₩ ${amount.toLocaleString()}` : "-"}
                                </span>
                                {hasMemo && (
                                  <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0 ml-2" title="메모 있음" />
                                )}
                              </div>
                            </td>
                          )
                        })}
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

    {/* Cell Detail Modal — Portal to #modal-root */}
    {typeof window !== 'undefined' && cellModalOpen && createPortal(
      <div className="fixed inset-0 z-[99999] pointer-events-auto">
        <CellDetailModal
          isOpen={cellModalOpen}
          onClose={() => setCellModalOpen(false)}
          month={cellModalMonth}
          category={cellModalCat}
          tripDetails={cellTripDetails[`${cellModalMonth}-${cellModalCat}`] || []}
          totalAmount={getAmount(cellModalMonth, cellModalCat)}
          memo={getMemo(cellModalMonth, cellModalCat)}
          onSaveMemo={(text: string) => updateMemo(cellModalMonth, cellModalCat, text)}
        />
      </div>,
      document.getElementById('modal-root')!
    )}
    </>
  )
}
