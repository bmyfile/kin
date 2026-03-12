"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { AppLayout } from "@/components/layout/app-layout"

// ── Types ────────────────────────────────────────────
type CostItem = { name: string; total: number; perChild: number }

type Trip = {
  id: string
  name: string
  date: string
  costItems: CostItem[]
  participants: string[]
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
  const [selectedHalf, setSelectedHalf] = useState<"상반기" | "하반기">("상반기")

  const fetchData = useCallback(async () => {
    try {
      const [tripsSnap, studentsSnap] = await Promise.all([
        getDocs(collection(db, "trips")),
        getDocs(collection(db, "students")),
      ])

      const tripsData = tripsSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || "",
        date: d.data().date || "",
        costItems: d.data().costItems || [],
        participants: d.data().participants || [],
      }))
      tripsData.sort((a, b) => a.date.localeCompare(b.date))

      const studentsData = studentsSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        age: d.data().age,
      }))
      studentsData.sort((a, b) => a.name.localeCompare(b.name))

      setTrips(tripsData)
      setStudents(studentsData)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter trips by selected period
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      if (!t.date) return false
      const year = parseInt(t.date.substring(0, 4))
      const month = parseInt(t.date.substring(5, 7))
      if (year !== selectedYear) return false
      if (selectedHalf === "상반기") return month >= 1 && month <= 6
      return month >= 7 && month <= 12
    })
  }, [trips, selectedYear, selectedHalf])

  // Calculate per-student costs for each trip
  const getStudentTripCost = (studentId: string, trip: Trip) => {
    if (!trip.participants.includes(studentId)) return 0
    return trip.costItems.reduce((sum, c) => sum + (c.perChild || 0), 0)
  }

  // Summary: 체험학습비 총액 = sum of all students' per-child costs across all trips
  const totalTripCost = useMemo(() => {
    return students.reduce((total, student) => {
      const studentSum = filteredTrips.reduce(
        (sum, trip) => sum + getStudentTripCost(student.id, trip),
        0
      )
      return total + studentSum
    }, 0)
  }, [filteredTrips, students])

  // Year options for select
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

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
                onChange={(e) => setSelectedYear(Number(e.target.value))}
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
                onChange={(e) => setSelectedHalf(e.target.value as "상반기" | "하반기")}
                className="h-10 px-4 border border-[#E1E2E5] bg-white text-sm text-[#333] focus:outline-none cursor-pointer"
              >
                <option value="상반기">상반기</option>
                <option value="하반기">하반기</option>
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
          </div>

          {/* Summary Card */}
          <div className="flex gap-6">
            <SummaryCard
              label="체험학습비 총액"
              value={`₩ ${totalTripCost.toLocaleString()}`}
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
