"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { collection, doc, getDoc, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { AppLayout } from "@/components/layout/app-layout"
import { exportTripStatusExcel } from "@/lib/trip-status-excel"
import { Download } from "lucide-react"

// ── Types ────────────────────────────────────────────
type CostItem = { name: string; total: number; perChild: number }
type FundAllocation = { category: string; amount: number }

type Trip = {
  id: string
  name: string
  date: string
  costItems: CostItem[]
  participants: string[]
  parentPayment: number
  fundAllocations: FundAllocation[]
}

type Student = { id: string; name: string; age: string }

// ── Summary Card ─────────────────────────────────────
function SummaryCard({
  label,
  value,
  color = "#333",
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex-1 min-w-[160px] bg-white border border-[#E1E2E5] rounded-2xl px-8 py-6 flex flex-col gap-2">
      <span className="text-xs text-[#9DA4B3] font-normal">{label}</span>
      <span className="text-xl font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────
export default function TripStatusPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedHalf, setSelectedHalf] = useState<"상반기" | "하반기" | "상하반기">("상반기")
  const [selectedFund, setSelectedFund] = useState("전체")
  const [fundCategories, setFundCategories] = useState<string[]>([])
  const [subsidiesMap, setSubsidiesMap] = useState<{ [cat: string]: number }>({})

  const fetchData = useCallback(async () => {
    try {
      const [tripsSnap, studentsSnap, fundsSnap] = await Promise.all([
        getDocs(collection(db, "trips")),
        getDocs(collection(db, "students")),
        getDoc(doc(db, "funds", `funds-${selectedYear}`)),
      ])

      const tripsData = tripsSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || "",
        date: d.data().date || "",
        costItems: d.data().costItems || [],
        participants: d.data().participants || [],
        parentPayment: Number(d.data().parentPayment) || 0,
        fundAllocations: (d.data().fundAllocations || []).map((f: { category: string; amount: number }) => ({
          category: f.category,
          amount: Number(f.amount) || 0,
        })),
      }))
      tripsData.sort((a, b) => a.date.localeCompare(b.date))

      const studentsData = studentsSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        age: d.data().age,
      }))
      studentsData.sort((a, b) => a.name.localeCompare(b.name))

      // Fund categories & subsidies from funds doc
      if (fundsSnap.exists()) {
        const data = fundsSnap.data()
        setFundCategories(data.categories || [])
        setSubsidiesMap(data.subsidies || {})
      } else {
        setFundCategories([])
        setSubsidiesMap({})
      }

      setTrips(tripsData)
      setStudents(studentsData)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter trips by selected period and fund category
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      if (!t.date) return false
      const year = parseInt(t.date.substring(0, 4))
      const month = parseInt(t.date.substring(5, 7))
      if (year !== selectedYear) return false
      if (selectedHalf === "상반기") {
        if (month < 1 || month > 6) return false
      } else if (selectedHalf === "하반기") {
        if (month < 7 || month > 12) return false
      }
      if (selectedFund !== "전체") {
        return (t.fundAllocations || []).some((f) => f.category === selectedFund)
      }
      return true
    })
  }, [trips, selectedYear, selectedHalf, selectedFund])

  // Calculate per-student costs for each trip
  const getStudentTripCost = (studentId: string, trip: Trip) => {
    if (!trip.participants.includes(studentId)) return 0
    return trip.costItems.reduce((sum, c) => sum + (c.perChild || 0), 0)
  }

  // Summary calculations
  const totalCost = useMemo(() => {
    return filteredTrips.reduce((sum, t) =>
      sum + t.costItems.reduce((s, c) => s + (c.total || 0), 0), 0)
  }, [filteredTrips])

  const totalParentPayment = useMemo(() => {
    return filteredTrips.reduce((sum, t) => sum + (t.parentPayment || 0), 0)
  }, [filteredTrips])

  const totalFundAllocation = useMemo(() => {
    return filteredTrips.reduce((sum, t) =>
      sum + (t.fundAllocations || []).reduce((s, f) =>
        s + (selectedFund === "전체" || f.category === selectedFund ? f.amount : 0), 0), 0)
  }, [filteredTrips, selectedFund])

  // 사업비 잔액: 연간 지원금 - 해당 연도 전체 trips의 사업비 배정 합계 (사업비 필터 선택 시 해당 사업비 기준)
  // 지원금 합계는 등록된 카테고리만 계산 (subsidies에 삭제된 항목의 잔여 키가 남아있을 수 있음)
  const totalSubsidies = useMemo(() => {
    return fundCategories.reduce((s, cat) => s + (Number(subsidiesMap[cat]) || 0), 0)
  }, [fundCategories, subsidiesMap])

  const yearTrips = useMemo(() => {
    return trips.filter((t) => {
      if (!t.date) return false
      return parseInt(t.date.substring(0, 4)) === selectedYear
    })
  }, [trips, selectedYear])

  const fundBalance = useMemo(() => {
    const yearAllocated = yearTrips.reduce((sum, t) =>
      sum + (t.fundAllocations || []).reduce((s, f) =>
        s + (selectedFund === "전체" || f.category === selectedFund ? f.amount : 0), 0), 0)
    const subsidyTotal = selectedFund === "전체"
      ? totalSubsidies
      : Number(subsidiesMap[selectedFund]) || 0
    return subsidyTotal - yearAllocated
  }, [yearTrips, totalSubsidies, subsidiesMap, selectedFund])

  // Year options for select
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  // Excel download
  const [exporting, setExporting] = useState(false)
  const handleExcelDownload = async () => {
    setExporting(true)
    try {
      await exportTripStatusExcel({
        year: selectedYear,
        half: selectedHalf,
        fund: selectedFund,
        trips: filteredTrips,
        students,
        summary: {
          cost: totalCost,
          parentPayment: totalParentPayment,
          fundAllocation: totalFundAllocation,
          fundBalance,
        },
      })
    } catch (e) {
      console.error("Excel export failed:", e)
      alert("엑셀 다운로드 중 오류가 발생했습니다.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 font-sans -mx-8 -mt-8">
        {/* Override header title */}
        <div className="px-8 pt-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-[24px] font-bold text-[#333] tracking-tight">
              체험학습현황
            </h1>
          </div>

          {/* Filters */}
          <div className="flex items-end gap-4 mb-6">
            <div className="flex flex-col gap-[6px]">
              <span className="text-xs text-[#9DA4B3]">교차 연도</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value))
                  setSelectedFund("전체")
                }}
                className="h-10 px-4 border border-[#E1E2E5] bg-white text-sm text-[#333] focus:outline-none cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-[6px]">
              <span className="text-xs text-[#9DA4B3]">구분</span>
              <select
                value={selectedHalf}
                onChange={(e) => setSelectedHalf(e.target.value as "상반기" | "하반기" | "상하반기")}
                className="h-10 px-4 border border-[#E1E2E5] bg-white text-sm text-[#333] focus:outline-none cursor-pointer"
              >
                <option value="상반기">상반기</option>
                <option value="하반기">하반기</option>
                <option value="상하반기">상하반기</option>
              </select>
            </div>
            <div className="flex flex-col gap-[6px]">
              <span className="text-xs text-[#9DA4B3]">사업비</span>
              <select
                value={selectedFund}
                onChange={(e) => setSelectedFund(e.target.value)}
                className="h-10 px-4 border border-[#E1E2E5] bg-white text-sm text-[#333] focus:outline-none cursor-pointer"
              >
                <option value="전체">전체</option>
                {fundCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4 text-sm rounded-none border-[#E1E2E5] text-[#333] cursor-pointer"
              onClick={fetchData}
            >
              조회
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4 text-sm rounded-none border-[#E1E2E5] text-[#333] cursor-pointer"
              onClick={handleExcelDownload}
              disabled={exporting || loading}
            >
              <Download className="w-4 h-4" />
              {exporting ? "저장 중..." : "엑셀 다운로드"}
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="flex gap-4 flex-wrap">
            <SummaryCard
              label="비용"
              value={`₩ ${totalCost.toLocaleString()}`}
            />
            <SummaryCard
              label="학부모 납부액"
              value={`₩ ${totalParentPayment.toLocaleString()}`}
            />
            <SummaryCard
              label="사업비"
              value={`₩ ${totalFundAllocation.toLocaleString()}`}
            />
            <SummaryCard
              label={selectedFund === "전체" ? "사업비 잔액 (연간)" : `사업비 잔액 (연간) · ${selectedFund}`}
              value={`₩ ${fundBalance.toLocaleString()}`}
              color={fundBalance >= 0 ? "#2563EB" : "#E83838"}
            />
          </div>
        </div>

        {/* Detail Table — rows=trips, cols=students */}
        <div className="px-8 pb-8">
          <div className="overflow-x-auto border border-[#E1E2E5] rounded-2xl bg-white">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 320 + students.length * 80 }}>
              <thead>
                <tr className="bg-[#F9F9F9]">
                  <th className="text-center font-normal text-[#5B5F66] border-r border-b border-[#E1E2E5] w-[160px] h-[40px] sticky left-0 bg-[#F9F9F9] z-10">
                    방문지
                  </th>
                  <th className="text-center font-normal text-[#5B5F66] border-r border-b border-[#E1E2E5] w-[100px] h-[40px]">
                    날짜
                  </th>
                  <th className="text-center font-normal text-[#5B5F66] border-r border-b border-[#E1E2E5] w-[60px] h-[40px]">
                    참여
                  </th>
                  {students.map((s) => (
                    <th
                      key={s.id}
                      className="text-center font-normal text-[#5B5F66] border-r border-b border-[#E1E2E5] min-w-[70px] h-[40px]"
                    >
                      <div className="text-[12px] leading-tight">
                        {s.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={3 + students.length}
                      className="h-24 text-center text-[#9DA4B3]"
                    >
                      데이터를 불러오는 중입니다...
                    </td>
                  </tr>
                ) : filteredTrips.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3 + students.length}
                      className="h-24 text-center text-[#9DA4B3]"
                    >
                      해당 기간에 등록된 체험학습이 없습니다.
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Totals row — directly below header */}
                    <tr className="bg-[#F9F9F9] border-b-2 border-[#E1E2E5]">
                      <td className="text-center font-bold text-[#333] h-[44px] border-r border-[#E1E2E5] bg-[#F9F9F9] sticky left-0 z-10">
                        인원별 총액
                      </td>
                      <td className="text-center text-[#333] h-[44px] border-r border-[#E1E2E5] bg-[#F9F9F9]" />
                      <td className="text-center text-[#333] h-[44px] border-r border-[#E1E2E5] bg-[#F9F9F9]" />
                      {students.map((student) => {
                        const total = filteredTrips.reduce(
                          (sum, trip) => sum + getStudentTripCost(student.id, trip),
                          0
                        )
                        return (
                          <td
                            key={student.id}
                            className="text-center font-bold text-[#0F5FFE] h-[44px] border-r border-[#E1E2E5] bg-[#F9F9F9]"
                          >
                            {total > 0 ? total.toLocaleString() : "-"}
                          </td>
                        )
                      })}
                    </tr>
                    {filteredTrips.map((trip) => {
                      const participantCount = trip.participants.length
                      return (
                        <tr
                          key={trip.id}
                          className="border-b border-[#E1E2E5] hover:bg-gray-50/50"
                        >
                          <td className="text-center text-[#333] h-[40px] border-r border-[#E1E2E5] bg-white sticky left-0 z-10 font-medium">
                            {trip.name}
                          </td>
                          <td className="text-center text-[#333] h-[40px] border-r border-[#E1E2E5] text-[12px]">
                            {trip.date}
                          </td>
                          <td className="text-center text-[#333] h-[40px] border-r border-[#E1E2E5]">
                            {participantCount}
                          </td>
                          {students.map((student) => {
                            const cost = getStudentTripCost(student.id, trip)
                            return (
                              <td
                                key={student.id}
                                className="text-center text-[#333] h-[40px] border-r border-[#E1E2E5]"
                              >
                                {cost > 0 ? cost.toLocaleString() : "-"}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
