"use client"

import { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Plus, X } from "lucide-react"
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { AppLayout } from "@/components/layout/app-layout"

type Student = {
  id: string
  name: string
  age: string
}

// ── Modal ────────────────────────────────────────────
function StudentModal({
  open,
  student,
  onClose,
  onSave,
}: {
  open: boolean
  student: Student | null // null = 신규 등록, Student = 수정
  onClose: () => void
  onSave: (name: string, age: string) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(student?.name || "")
      setAge(student?.age || "")
    }
  }, [open, student])

  if (!open) return null

  const isEdit = student !== null
  const title = isEdit ? "원아 수정" : "원아 등록"
  const subtitle = isEdit
    ? "원아의 이름과 나이를 수정해주세요."
    : "새로운 원아의 이름과 나이를 입력해주세요."

  const handleSubmit = async () => {
    if (!name.trim() || !age.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim(), age.trim())
      onClose()
    } catch {
      alert("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[360px] bg-white border border-[#E1E2E5] shadow-xl flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9DA4B3] hover:text-[#333333] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex flex-col gap-2">
          <h2 className="text-[20px] font-medium text-[#333333]">{title}</h2>
          <p className="text-sm text-[#5B5F66]">{subtitle}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-[6px]">
            <Label className="text-sm font-medium text-[#333333]">원아 이름</Label>
            <Input
              placeholder="예) 홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-none border-[#9DA4B3]"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <Label className="text-sm font-medium text-[#333333]">나이</Label>
            <Input
              placeholder="예) 7"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              type="number"
              className="h-10 rounded-none border-[#9DA4B3]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center justify-end gap-3">
          <Button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !age.trim()}
            className="bg-[#0F5FFE] hover:bg-[#0F5FFE]/90 text-white rounded-none px-4 flex items-center gap-[6px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {saving ? "저장 중..." : isEdit ? "수정" : "등록"}
          </Button>
          <Button
            onClick={onClose}
            className="bg-[#333333] hover:bg-[#333333]/90 text-white rounded-none px-4 flex items-center gap-[6px] cursor-pointer"
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
export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  const fetchStudents = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "students"))
      const data = querySnapshot.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        age: d.data().age,
      }))
      data.sort((a, b) => a.name.localeCompare(b.name))
      setStudents(data)
    } catch (error) {
      console.error("Error fetching students:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  // Add or Update
  const handleSave = async (name: string, age: string) => {
    if (editingStudent) {
      // Update
      await updateDoc(doc(db, "students", editingStudent.id), { name, age })
      setStudents((prev) =>
        prev.map((s) => (s.id === editingStudent.id ? { ...s, name, age } : s))
      )
    } else {
      // Add
      const docRef = await addDoc(collection(db, "students"), {
        name,
        age,
        createdAt: new Date(),
      })
      setStudents((prev) =>
        [...prev, { id: docRef.id, name, age }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("정말 이 원아를 삭제하시겠습니까?")) return
    try {
      await deleteDoc(doc(db, "students", id))
      setStudents((prev) => prev.filter((s) => s.id !== id))
    } catch (error) {
      console.error("Error deleting student:", error)
      window.alert("원아 삭제 중 오류가 발생했습니다.")
    }
  }

  const openAddModal = () => {
    setEditingStudent(null)
    setModalOpen(true)
  }

  const openEditModal = (student: Student) => {
    setEditingStudent(student)
    setModalOpen(true)
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 font-sans">
        {/* Title + Add button */}
        <div className="flex items-center justify-between">
          <h1 className="text-[24px] font-bold text-[#333333] tracking-tight">
            원아관리
          </h1>
          <Button
            onClick={openAddModal}
            className="h-10 bg-[#0F5FFE] hover:bg-[#0F5FFE]/90 text-white rounded-sm px-4 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            원아 등록
          </Button>
        </div>

        {/* Table */}
        <div className="border border-[#E1E2E5] rounded-[8px] overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#E1E2E5] hover:bg-transparent">
                <TableHead className="w-[200px] h-[45px] text-center font-normal text-[#5B5F66]">이름</TableHead>
                <TableHead className="w-[120px] h-[45px] text-center font-normal text-[#5B5F66]">나이</TableHead>
                <TableHead className="h-[45px]"></TableHead>
                <TableHead className="w-[160px] h-[45px] text-right pr-[40px] font-normal text-[#5B5F66]">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-[#5B5F66]">
                    데이터를 불러오는 중입니다...
                  </TableCell>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-[#5B5F66]">
                    등록된 원아가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                students
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((student) => (
                  <TableRow key={student.id} className="border-b border-[#E1E2E5] hover:bg-gray-50/50">
                    <TableCell className="text-center font-normal text-[#333333] h-[48px]">
                      {student.name}
                    </TableCell>
                    <TableCell className="text-center font-normal text-[#333333] h-[48px]">
                      {student.age}
                    </TableCell>
                    <TableCell className="h-[48px]"></TableCell>
                    <TableCell className="h-[48px] text-right pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(student)}
                          className="h-8 px-3 text-[13px] border-[#E1E2E5] text-[#5B5F66] hover:bg-[#F5F5F5] hover:text-[#333333] rounded-sm cursor-pointer"
                        >
                          수정
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleDelete(student.id)}
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
          <Pagination page={currentPage} totalPages={Math.ceil(students.length / ITEMS_PER_PAGE)} onPageChange={setCurrentPage} />
        </div>
      </div>

      {/* Modal */}
      <StudentModal
        open={modalOpen}
        student={editingStudent}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </AppLayout>
  )
}
