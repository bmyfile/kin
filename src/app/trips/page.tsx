"use client"

import { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Plus, X, Trash2 } from "lucide-react"
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { AppLayout } from "@/components/layout/app-layout"

// ── Types ────────────────────────────────────────────
type CostItem = { name: string; total: number; perChild: number }

type Trip = {
  id: string
  name: string
  date: string
  costItems: CostItem[]
  participants: string[] // student IDs
}

type Student = { id: string; name: string; age: string }

// ── Modal ────────────────────────────────────────────
function TripModal({
  open,
  trip,
  students,
  onClose,
  onSave,
}: {
  open: boolean
  trip: Trip | null
  students: Student[]
  onClose: () => void
  onSave: (data: Omit<Trip, "id">) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [costItems, setCostItems] = useState<CostItem[]>([{ name: "", total: 0, perChild: 0 }])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(trip?.name || "")
      setDate(trip?.date || "")
      setCostItems(
        trip?.costItems?.length ? [...trip.costItems] : [{ name: "", total: 0, perChild: 0 }]
      )
      setSelectedStudents(trip?.participants || [])
    }
  }, [open, trip])

  if (!open) return null

  const isEdit = trip !== null
  const title = isEdit ? "체험학습 수정" : "체험학습 등록"
  const subtitle = "체험학습에 대한 기본 정보와 참여 아동을 선택해주세요."

  const totalCost = costItems.reduce((s, c) => s + (c.total || 0), 0)
  const participantCount = selectedStudents.length || 1
  const perChildCost = costItems.reduce((s, c) => s + (c.perChild || 0), 0)

  const addCostItem = () => setCostItems([...costItems, { name: "", total: 0, perChild: 0 }])

  const removeCostItem = (i: number) => {
    if (costItems.length <= 1) return
    setCostItems(costItems.filter((_, idx) => idx !== i))
  }

  const updateCostItem = (i: number, field: keyof CostItem, value: string | number) => {
    const items = [...costItems]
    if (field === "name") {
      items[i].name = value as string
    } else {
      const num = Number(String(value).replace(/,/g, "")) || 0
      items[i][field] = num
      if (field === "total") {
        items[i].perChild = Math.round(num / participantCount)
      }
    }
    setCostItems(items)
  }

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(students.map((s) => s.id))
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || !date) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), date, costItems, participants: selectedStudents })
      onClose()
    } catch {
      window.alert("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[480px] max-h-[90vh] overflow-y-auto bg-white border border-[#E1E2E5] shadow-xl flex flex-col">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-[#9DA4B3] hover:text-[#333] cursor-pointer z-10">
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex flex-col gap-2">
          <h2 className="text-[20px] font-medium text-[#333]">{title}</h2>
          <p className="text-sm text-[#5B5F66]">{subtitle}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 flex flex-col gap-4">
          {/* Row 1: Name + Date */}
          <div className="flex gap-4">
            <div className="flex flex-col gap-[6px] flex-1">
              <Label className="text-sm font-medium text-[#333]">체험학습명</Label>
              <Input
                placeholder="예) 동물원 견학"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-none border-[#9DA4B3]"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-[6px] w-[140px]">
              <Label className="text-sm font-medium text-[#333]">날짜</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-none border-[#9DA4B3]"
              />
            </div>
          </div>

          {/* Cost Items */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#333]">비용 항목</span>
              <button
                type="button"
                onClick={addCostItem}
                className="text-xs px-2 py-1 border border-[#E1E2E5] rounded text-[#333] hover:bg-[#F5F5F5] cursor-pointer"
              >
                항목 추가
              </button>
            </div>

            {/* Column headings */}
            <div className="flex items-center gap-2 px-1">
              <span className="flex-1 text-xs text-[#9DA4B3]">비용 항목명</span>
              <span className="w-[100px] text-xs text-[#9DA4B3]">전체(원)</span>
              <span className="w-[100px] text-xs text-[#9DA4B3]">개별(원)</span>
              <span className="w-8" />
            </div>

            {costItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="차량비"
                  value={item.name}
                  onChange={(e) => updateCostItem(i, "name", e.target.value)}
                  className="flex-1 h-10 rounded-none border-[#9DA4B3]"
                />
                <Input
                  type="text"
                  placeholder="0"
                  value={item.total ? item.total.toLocaleString() : ""}
                  onChange={(e) => updateCostItem(i, "total", e.target.value)}
                  className="w-[100px] h-10 rounded-none border-[#9DA4B3] text-right"
                />
                <Input
                  type="text"
                  placeholder="0"
                  value={item.perChild ? item.perChild.toLocaleString() : ""}
                  onChange={(e) => updateCostItem(i, "perChild", e.target.value)}
                  className="w-[100px] h-10 rounded-none border-[#9DA4B3] text-right"
                />
                <button
                  type="button"
                  onClick={() => removeCostItem(i)}
                  className="w-8 h-8 flex items-center justify-center border border-[#E1E2E5] rounded text-[#9DA4B3] hover:text-[#E83838] hover:border-[#FFE5E5] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Totals */}
            <div className="flex items-center justify-end gap-4 pt-3 border-t border-[#E1E2E5]">
              <span className="text-xs text-[#9DA4B3]">총 비용:</span>
              <span className="text-sm font-semibold text-[#333]">
                전체 {totalCost.toLocaleString()}원
              </span>
              <span className="text-sm font-semibold text-[#0F5FFE]">
                개별 {perChildCost.toLocaleString()}원
              </span>
            </div>
          </div>

          {/* Participants */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#333]">참여 아동 선택</span>
            <div className="border border-[#E1E2E5] rounded bg-[#F5F5F5] p-3 max-h-[280px] overflow-y-auto flex flex-col gap-3">
              {/* All select */}
              <label className="flex items-center gap-2 cursor-pointer pb-2 border-b border-[#E1E2E5]">
                <input
                  type="checkbox"
                  checked={students.length > 0 && selectedStudents.length === students.length}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-[#0F5FFE]"
                />
                <span className="text-[15px] font-medium text-[#333]">전체 선택</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {students.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      className="w-4 h-4 accent-[#0F5FFE] shrink-0"
                    />
                    <span className="text-[14px] text-[#333] truncate">
                      {s.name} ({s.age}세)
                    </span>
                  </label>
                ))}
              </div>
              {students.length === 0 && (
                <span className="text-sm text-[#9DA4B3]">등록된 원아가 없습니다.</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center justify-end gap-3">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !date}
            className="bg-[#0F5FFE] hover:bg-[#0F5FFE]/90 text-white rounded-none px-4 flex items-center gap-[6px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {saving ? "저장 중..." : isEdit ? "수정" : "등록"}
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="bg-[#333] hover:bg-[#333]/90 text-white rounded-none px-4 flex items-center gap-[6px] cursor-pointer"
          >
            <Plus className="w-4 h-4 rotate-45" />
            취소
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Pagination ───────────────────────────────────────
const ITEMS_PER_PAGE = 10

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  return (
    <div className="flex items-center justify-center p-4 border-t border-[#E1E2E5]">
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="w-8 h-8 flex items-center justify-center rounded text-[#9DA4B3] hover:bg-gray-100 disabled:opacity-40 cursor-pointer">&lt;</button>
        {pages.map((p) => (
          <button key={p} onClick={() => onPageChange(p)} className={`w-8 h-8 flex items-center justify-center rounded font-medium cursor-pointer ${p === page ? 'bg-[#0F5FFE] text-white' : 'text-[#5B5F66] hover:bg-gray-100'}`}>{p}</button>
        ))}
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="w-8 h-8 flex items-center justify-center rounded text-[#9DA4B3] hover:bg-gray-100 disabled:opacity-40 cursor-pointer">&gt;</button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────
export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

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
      tripsData.sort((a, b) => b.date.localeCompare(a.date)) // 최신 순

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

  const handleSave = async (data: Omit<Trip, "id">) => {
    if (editingTrip) {
      await updateDoc(doc(db, "trips", editingTrip.id), { ...data })
      setTrips((prev) =>
        prev.map((t) => (t.id === editingTrip.id ? { ...t, ...data } : t))
      )
    } else {
      const docRef = await addDoc(collection(db, "trips"), {
        ...data,
        createdAt: new Date(),
      })
      setTrips((prev) =>
        [{ id: docRef.id, ...data }, ...prev].sort((a, b) => b.date.localeCompare(a.date))
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("정말 이 체험학습을 삭제하시겠습니까?")) return
    try {
      await deleteDoc(doc(db, "trips", id))
      setTrips((prev) => prev.filter((t) => t.id !== id))
    } catch (error) {
      console.error("Error deleting trip:", error)
      window.alert("삭제 중 오류가 발생했습니다.")
    }
  }

  const openAddModal = () => {
    setEditingTrip(null)
    setModalOpen(true)
  }

  const openEditModal = (trip: Trip) => {
    setEditingTrip(trip)
    setModalOpen(true)
  }

  // Helper: get participant names
  const getParticipantNames = (participantIds: string[]) => {
    return participantIds
      .map((id) => students.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(", ")
  }

  const getTotalCost = (costItems: CostItem[]) =>
    costItems.reduce((s, c) => s + (c.total || 0), 0)

  const getPerChildCost = (costItems: CostItem[]) =>
    costItems.reduce((s, c) => s + (c.perChild || 0), 0)

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 font-sans">
        {/* Title + Add button */}
        <div className="flex items-center justify-between">
          <h1 className="text-[24px] font-bold text-[#333333] tracking-tight">
            체험학습관리
          </h1>
          <Button
            type="button"
            onClick={openAddModal}
            className="h-10 bg-[#0F5FFE] hover:bg-[#0F5FFE]/90 text-white rounded-sm px-4 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            체험학습 등록
          </Button>
        </div>

        {/* Table */}
        <div className="border border-[#E1E2E5] rounded-[8px] overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#E1E2E5] hover:bg-transparent">
                <TableHead className="w-[140px] h-[45px] text-center font-normal text-[#5B5F66]">날짜</TableHead>
                <TableHead className="w-[200px] h-[45px] text-center font-normal text-[#5B5F66]">체험학습명</TableHead>
                <TableHead className="h-[45px] text-center font-normal text-[#5B5F66]">참여자</TableHead>
                <TableHead className="w-[160px] h-[45px] text-center font-normal text-[#5B5F66]">참여비(원)</TableHead>
                <TableHead className="w-[160px] h-[45px] text-right pr-[40px] font-normal text-[#5B5F66]">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-[#5B5F66]">
                    데이터를 불러오는 중입니다...
                  </TableCell>
                </TableRow>
              ) : trips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-[#5B5F66]">
                    등록된 체험학습이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                trips
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((trip) => (
                  <TableRow key={trip.id} className="border-b border-[#E1E2E5] hover:bg-gray-50/50">
                    <TableCell className="text-center font-normal text-[#333] h-[48px]">
                      {trip.date}
                    </TableCell>
                    <TableCell className="text-center font-normal text-[#333] h-[48px]">
                      {trip.name}
                    </TableCell>
                    <TableCell className="text-center font-normal text-[#333] h-[48px] truncate max-w-[240px]">
                      {getParticipantNames(trip.participants) || "-"}
                    </TableCell>
                    <TableCell className="text-center font-normal text-[#333] h-[48px]">
                      {getTotalCost(trip.costItems).toLocaleString()} / {getPerChildCost(trip.costItems).toLocaleString()}
                    </TableCell>
                    <TableCell className="h-[48px] text-right pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(trip)}
                          className="h-8 px-3 text-[13px] border-[#E1E2E5] text-[#5B5F66] hover:bg-[#F5F5F5] hover:text-[#333] rounded-sm cursor-pointer"
                        >
                          수정
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleDelete(trip.id)}
                          className="inline-flex items-center justify-center h-8 px-3 text-[13px] border border-[#FFE5E5] text-[#E83838] bg-[#FFF5F5] hover:bg-[#FFE5E5] hover:text-[#E83838] rounded-sm cursor-pointer font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination page={currentPage} totalPages={Math.ceil(trips.length / ITEMS_PER_PAGE)} onPageChange={setCurrentPage} />
        </div>
      </div>

      <TripModal
        open={modalOpen}
        trip={editingTrip}
        students={students}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </AppLayout>
  )
}
