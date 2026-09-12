// 어린이집 학사 연도 기준 헬퍼
// 연간 = 3월 1일 ~ 다음년도 2월 말 (예: 2026년 = 2026-03-01 ~ 2027-02-28)
// 상반기 = 3~8월, 하반기 = 9월 ~ 다음년도 2월

export type AcademicHalf = "상반기" | "하반기"

// "YYYY-MM-DD" (또는 ISO 문자열)를 안전하게 파싱 (타임존 영향 제거)
function parseDateParts(dateStr: string): { year: number; month: number } | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})/)
  if (!m) {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }
  return { year: parseInt(m[1]), month: parseInt(m[2]) }
}

// 날짜가 속한 학사 연도 (예: 2027-01-10 → 2026년)
export function academicYearOf(dateStr: string): number | null {
  const parts = parseDateParts(dateStr)
  if (!parts) return null
  // 1~2월은 전년도 학사 연도에 속함
  return parts.month >= 3 ? parts.year : parts.year - 1
}

// 날짜가 특정 학사 연도(3월~다음년도 2월)에 속하는지
export function isInAcademicYear(dateStr: string, year: number): boolean {
  return academicYearOf(dateStr) === year
}

// 학사 연도 기준 반기 구분
export function academicHalfOf(dateStr: string): AcademicHalf | null {
  const parts = parseDateParts(dateStr)
  if (!parts) return null
  const { month } = parts
  if (month >= 3 && month <= 8) return "상반기"
  return "하반기"
}

// 학사 연도의 월 순서 (3월부터 2월까지) — 지원금 페이지 월 행 순서용
export function academicYearMonths(): number[] {
  return [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2]
}
