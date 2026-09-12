// 체험학습현황 엑셀 내보내기 (exceljs, 클라이언트 전용)
export type TripStatusExportData = {
  year: number
  half: string
  fund: string
  trips: {
    id: string
    name: string
    date: string
    participants: string[]
    costItems: { total: number; perChild: number }[]
  }[]
  students: { id: string; name: string }[]
  summary: {
    cost: number
    parentPayment: number
    fundAllocation: number
    fundBalance: number
  }
}

const MONEY_FMT = "#,##0"
const HEADER_FILL = "FFF9F9F9"
const TOTAL_FONT_COLOR = "FF0F5FFE"

export async function exportTripStatusExcel(data: TripStatusExportData) {
  const ExcelJS = await import("exceljs")
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("체험학습현황")

  const { year, half, fund, trips, students, summary } = data
  const fundLabel = fund === "전체" ? "전체" : fund

  // 제목 + 필터 조건
  ws.mergeCells(1, 1, 1, 3 + students.length)
  const title = ws.getCell(1, 1)
  title.value = "체험학습현황"
  title.font = { bold: true, size: 14 }

  ws.mergeCells(2, 1, 2, 3 + students.length)
  const filterInfo = ws.getCell(2, 1)
  filterInfo.value = `${year}년 ${half} · 사업비: ${fundLabel}`
  filterInfo.font = { color: { argb: "FF9DA4B3" }, size: 11 }

  // 요약 카드
  const summaryRows: [string, number][] = [
    ["비용", summary.cost],
    ["학부모 납부액", summary.parentPayment],
    ["사업비", summary.fundAllocation],
    [`사업비 잔액 (연간)${fund === "전체" ? "" : ` · ${fund}`}`, summary.fundBalance],
  ]
  summaryRows.forEach(([label, value], i) => {
    const r = 4 + i
    ws.getCell(r, 1).value = label
    const cell = ws.getCell(r, 2)
    cell.value = value
    cell.numFmt = MONEY_FMT
  })

  // 테이블 헤더
  const headerRowIdx = 9
  const header = ["방문지", "날짜", "참여", ...students.map((s) => s.name)]
  const headerRow = ws.getRow(headerRowIdx)
  header.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } }
    cell.alignment = { horizontal: "center", vertical: "middle" }
  })

  // 인원별 총액 행
  const totalRow = ws.getRow(headerRowIdx + 1)
  totalRow.getCell(1).value = "인원별 총액"
  students.forEach((s, i) => {
    const total = trips.reduce(
      (sum, t) =>
        sum +
        (t.participants.includes(s.id)
          ? t.costItems.reduce((acc, c) => acc + (c.perChild || 0), 0)
          : 0),
      0
    )
    if (total > 0) {
      const cell = totalRow.getCell(4 + i)
      cell.value = total
      cell.numFmt = MONEY_FMT
    }
  })
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: TOTAL_FONT_COLOR } }
  })

  // 체험학습 행
  trips.forEach((t, rowIdx) => {
    const row = ws.getRow(headerRowIdx + 2 + rowIdx)
    row.getCell(1).value = t.name
    row.getCell(2).value = t.date
    row.getCell(3).value = t.participants.length
    students.forEach((s, i) => {
      if (!t.participants.includes(s.id)) return
      const perChild = t.costItems.reduce((acc, c) => acc + (c.perChild || 0), 0)
      if (perChild > 0) {
        const cell = row.getCell(4 + i)
        cell.value = perChild
        cell.numFmt = MONEY_FMT
      }
    })
  })

  // 열 너비
  ws.getColumn(1).width = 26
  ws.getColumn(2).width = 12
  ws.getColumn(3).width = 7
  students.forEach((_, i) => {
    ws.getColumn(4 + i).width = 10
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `체험학습현황_${year}년_${half}_${fundLabel}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
