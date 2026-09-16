import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  TextRun,
} from 'docx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// This is a placeholder layout, not KEP's actual report format (not yet
// provided) -- structure and numbering below are illustrative only.
const COMPANY_NAME = '한국엔지니어링플라스틱(주)';
const SYSTEM_NAME = 'KEP 설비정비 표준화 시스템';
const REPORT_TITLE = '설비정비 현황 보고서';

const TYPE_LABELS = {
  breakdown_repair: '고장수리',
  preventive_inspection: '예방점검',
  other: '기타',
  unknown: '미상',
};

// 정비 상세 내역 섹션에서 고를 수 있는 항목들. 앞의 5개(작업일자~수행반)가
// KEP 계전팀 1차 피드백 반영 후 정비이력 화면의 기본 컬럼과 동일한 항목.
export const DETAIL_FIELD_DEFS = [
  { key: 'record_date', label: '작업일자', defaultOn: true },
  { key: 'work_name', label: '작업명', defaultOn: true },
  { key: 'work_content', label: '작업내용', defaultOn: true },
  { key: 'symptom_text', label: '현상', defaultOn: true },
  { key: 'work_team', label: '수행반', defaultOn: true },
  { key: 'maintenance_type', label: '정비유형', defaultOn: false },
  { key: 'action_text', label: '조치내용', defaultOn: false },
  { key: 'part_text', label: '부품명', defaultOn: false },
  { key: 'company_source', label: '등록업체', defaultOn: false },
];

export function formatDetailField(key, record) {
  if (key === 'maintenance_type') return TYPE_LABELS[record.maintenance_type] || record.maintenance_type;
  const value = record[key];
  return value === null || value === undefined || value === '' ? '-' : value;
}

// "TOP 10 집계" 섹션에서 고를 수 있는 집계 기준. dashboard.controller.js의
// REPORT_GROUP_BY_COLUMNS 화이트리스트와 key를 맞춰야 한다.
export const GROUP_BY_DEFS = [
  { key: 'equipment_name', label: '설비명' },
  { key: 'symptom_text', label: '현상' },
  { key: 'work_team', label: '수행반' },
  { key: 'work_name', label: '작업명' },
  { key: 'work_content', label: '작업내용' },
  { key: 'maintenance_type', label: '정비유형' },
  { key: 'equipment_line', label: '설비라인' },
];

export function groupByLabel(key) {
  return GROUP_BY_DEFS.find((g) => g.key === key)?.label || key;
}

export function formatGroupValue(groupBy, value) {
  if (groupBy === 'maintenance_type') return TYPE_LABELS[value] || value;
  return value;
}

// "정비 상세 내역" 섹션 상단에 쓰는 "대상 설비: ..." 문구. 화면 카드, Word, PDF가
// 같은 문구를 쓰도록 한 곳에 모아둔다.
export function buildScopeLine(detail) {
  const parts = [];
  if (detail.equipmentFilter?.length > 0) {
    parts.push(`설비: ${detail.equipmentFilter.map((e) => e.equipment_name).join(', ')}`);
  }
  if (detail.lineFilters?.length > 0) {
    parts.push(`설비라인: ${detail.lineFilters.join(', ')}`);
  }
  return parts.length > 0 ? `대상 ${parts.join(' · ')}` : '대상 설비: 전체';
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function docNumber(report) {
  return `MNT-${report.dateFrom.slice(0, 4)}-${report.dateFrom.slice(5, 7)}`;
}

function summaryRows(report, byType) {
  return [
    ['전체 정비 이력', report.totalRecords],
    ...Object.entries(byType).map(([type, count]) => [TYPE_LABELS[type] || type, count]),
    ['신규 발견 용어', report.newTermsCount],
    ['등록 업체 수', report.companyCount],
  ];
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------- Excel ----------------

export function exportReportExcel(report, byType, detail) {
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet([
    [COMPANY_NAME],
    [REPORT_TITLE],
    [],
    ['문서번호', docNumber(report)],
    ['보고기간', `${report.dateFrom} ~ ${report.dateTo}`],
    ['작성일', todayStr()],
    ['작성', `${SYSTEM_NAME} (자동생성)`],
    [],
    ['항목', '값'],
    ...summaryRows(report, byType),
  ]);
  summarySheet['!cols'] = [{ wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, '요약');

  const groupLabel = groupByLabel(report.groupBy);
  const groupSheet = XLSX.utils.aoa_to_sheet([
    [groupLabel, '건수'],
    ...report.topGroup.map((g) => [formatGroupValue(report.groupBy, g.group_value), g.count]),
  ]);
  groupSheet['!cols'] = [{ wch: 28 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, groupSheet, `${groupLabel} TOP10`);

  const partSheet = XLSX.utils.aoa_to_sheet([
    ['부품명', '사용 횟수'],
    ...report.topParts.map((p) => [p.canonical_text, p.count]),
  ]);
  partSheet['!cols'] = [{ wch: 22 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, partSheet, '부품 TOP10');

  if (detail && detail.fieldKeys.length > 0) {
    const headerLabels = detail.fieldKeys.map((k) => DETAIL_FIELD_DEFS.find((f) => f.key === k)?.label || k);
    const detailSheet = XLSX.utils.aoa_to_sheet([
      ['설비명', ...headerLabels],
      ...detail.records.map((r) => [r.equipment_name, ...detail.fieldKeys.map((k) => formatDetailField(k, r))]),
    ]);
    detailSheet['!cols'] = [{ wch: 22 }, ...headerLabels.map(() => ({ wch: 24 }))];
    XLSX.utils.book_append_sheet(wb, detailSheet, '상세 내역');
  }

  XLSX.writeFile(wb, `정비리포트_${report.dateFrom}_${report.dateTo}.xlsx`);
}

// ---------------- Word ----------------

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
};

function docxHeaderCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { fill: '4338CA' },
    borders: CELL_BORDER,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF' })] })],
  });
}

function docxCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: CELL_BORDER,
    children: [new Paragraph({ text: String(text) })],
  });
}

function docxTable(headerRow, rows) {
  const width = 100 / headerRow.length;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headerRow.map((h) => docxHeaderCell(h, width)) }),
      ...rows.map((row) => new TableRow({ children: row.map((c) => docxCell(c, width)) })),
    ],
  });
}

function docxInfoTable(report) {
  const cell = (text, bold) =>
    new TableCell({
      borders: CELL_BORDER,
      shading: bold ? { fill: 'F4F6F9' } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [cell('문서번호', true), cell(docNumber(report)), cell('작성일', true), cell(todayStr())] }),
      new TableRow({
        children: [
          cell('보고기간', true),
          cell(`${report.dateFrom} ~ ${report.dateTo}`),
          cell('작성', true),
          cell(`${SYSTEM_NAME} (자동생성)`),
        ],
      }),
    ],
  });
}

function docxApprovalTable() {
  const headerCell = (text) =>
    new TableCell({
      borders: CELL_BORDER,
      shading: { fill: 'F4F6F9' },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true })] })],
    });
  const blankCell = () =>
    new TableCell({
      borders: CELL_BORDER,
      children: [new Paragraph({ text: '' }), new Paragraph({ text: '' })],
    });
  return new Table({
    width: { size: 45, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.RIGHT,
    rows: [
      new TableRow({ children: [headerCell('담당'), headerCell('검토'), headerCell('승인')] }),
      new TableRow({ children: [blankCell(), blankCell(), blankCell()] }),
    ],
  });
}

export async function exportReportWord(report, byType, detail) {
  const children = [
    new Paragraph({ children: [new TextRun({ text: COMPANY_NAME, size: 20, color: '74809A' })] }),
    new Paragraph({ text: REPORT_TITLE, heading: HeadingLevel.HEADING1 }),
    new Paragraph({ text: '' }),
    docxInfoTable(report),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '1. 요약', heading: HeadingLevel.HEADING2 }),
    docxTable(
      ['항목', '값'],
      summaryRows(report, byType).map(([k, v]) => [k, v])
    ),
    new Paragraph({ text: '' }),
    new Paragraph({ text: `2. ${groupByLabel(report.groupBy)} TOP 10`, heading: HeadingLevel.HEADING2 }),
  ];

  if (report.topGroup.length > 0) {
    children.push(
      docxTable(
        [groupByLabel(report.groupBy), '건수'],
        report.topGroup.map((g) => [formatGroupValue(report.groupBy, g.group_value), g.count])
      )
    );
  } else {
    children.push(new Paragraph({ text: '이 기간에 해당하는 이력이 없습니다.' }));
  }

  children.push(new Paragraph({ text: '' }), new Paragraph({ text: '3. 자주 사용된 부품 TOP 10', heading: HeadingLevel.HEADING2 }));

  if (report.topParts.length > 0) {
    children.push(
      docxTable(
        ['부품명', '사용 횟수'],
        report.topParts.map((p) => [p.canonical_text, p.count])
      )
    );
  } else {
    children.push(new Paragraph({ text: '이 기간에 사용된 부품 기록이 없습니다.' }));
  }

  if (detail && detail.fieldKeys.length > 0) {
    children.push(new Paragraph({ text: '' }), new Paragraph({ text: '4. 정비 상세 내역', heading: HeadingLevel.HEADING2 }));
    const scopeLine = buildScopeLine(detail);
    children.push(new Paragraph({ text: `${scopeLine} · ${detail.records.length}건${detail.truncated ? ' (최대 건수 초과로 일부만 표시)' : ''}` }));
    const headerLabels = detail.fieldKeys.map((k) => DETAIL_FIELD_DEFS.find((f) => f.key === k)?.label || k);
    if (detail.records.length > 0) {
      children.push(
        docxTable(
          ['설비명', ...headerLabels],
          detail.records.map((r) => [r.equipment_name, ...detail.fieldKeys.map((k) => formatDetailField(k, r))])
        )
      );
    } else {
      children.push(new Paragraph({ text: '조건에 맞는 상세 내역이 없습니다.' }));
    }
  }

  children.push(new Paragraph({ text: '' }), new Paragraph({ text: '' }), docxApprovalTable());

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `정비리포트_${report.dateFrom}_${report.dateTo}.docx`);
}

// ---------------- PDF ----------------

let fontCachePromise = null;

function arrayBufferToBase64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadKoreanFonts() {
  if (!fontCachePromise) {
    fontCachePromise = Promise.all([
      fetch('/fonts/NanumGothic-Regular.ttf').then((r) => r.arrayBuffer()).then(arrayBufferToBase64),
      fetch('/fonts/NanumGothic-Bold.ttf').then((r) => r.arrayBuffer()).then(arrayBufferToBase64),
    ]);
  }
  return fontCachePromise;
}

async function setupKoreanFont(doc) {
  const [regular, bold] = await loadKoreanFonts();
  doc.addFileToVFS('NanumGothic-Regular.ttf', regular);
  doc.addFont('NanumGothic-Regular.ttf', 'NanumGothic', 'normal');
  doc.addFileToVFS('NanumGothic-Bold.ttf', bold);
  doc.addFont('NanumGothic-Bold.ttf', 'NanumGothic', 'bold');
  doc.setFont('NanumGothic', 'normal');
}

export async function exportReportPdf(report, byType, detail) {
  const doc = new jsPDF('p', 'mm', 'a4');
  await setupKoreanFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 18;

  doc.setFont('NanumGothic', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(116, 128, 154);
  doc.text(COMPANY_NAME, margin, y);
  y += 9;

  doc.setFont('NanumGothic', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(16, 24, 43);
  doc.text(REPORT_TITLE, margin, y);
  y += 6;

  doc.setDrawColor(210, 214, 224);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  doc.setFont('NanumGothic', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(65, 75, 95);
  doc.text(`문서번호: ${docNumber(report)}`, margin, y);
  doc.text(`작성일: ${todayStr()}`, pageWidth - margin, y, { align: 'right' });
  y += 5.5;
  doc.text(`보고기간: ${report.dateFrom} ~ ${report.dateTo}`, margin, y);
  doc.text(`작성: ${SYSTEM_NAME} (자동생성)`, pageWidth - margin, y, { align: 'right' });
  y += 9;

  function sectionTitle(text) {
    doc.setFont('NanumGothic', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(16, 24, 43);
    doc.text(text, margin, y);
    y += 5;
  }

  sectionTitle('1. 요약');
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['항목', '값']],
    body: summaryRows(report, byType).map(([k, v]) => [k, String(v)]),
    styles: { font: 'NanumGothic', fontSize: 9.5, textColor: [40, 46, 60] },
    headStyles: { font: 'NanumGothic', fontStyle: 'bold', fillColor: [67, 56, 202], textColor: 255 },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 9;

  sectionTitle(`2. ${groupByLabel(report.groupBy)} TOP 10`);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [[groupByLabel(report.groupBy), '건수']],
    body:
      report.topGroup.length > 0
        ? report.topGroup.map((g) => [String(formatGroupValue(report.groupBy, g.group_value)), String(g.count)])
        : [['이 기간에 해당하는 이력이 없습니다.', '']],
    styles: { font: 'NanumGothic', fontSize: 9.5, textColor: [40, 46, 60] },
    headStyles: { font: 'NanumGothic', fontStyle: 'bold', fillColor: [193, 54, 54], textColor: 255 },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 9;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  sectionTitle('3. 자주 사용된 부품 TOP 10');
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['부품명', '사용 횟수']],
    body:
      report.topParts.length > 0
        ? report.topParts.map((p) => [p.canonical_text, String(p.count)])
        : [['이 기간에 사용된 부품 기록이 없습니다.', '']],
    styles: { font: 'NanumGothic', fontSize: 9.5, textColor: [40, 46, 60] },
    headStyles: { font: 'NanumGothic', fontStyle: 'bold', fillColor: [14, 138, 95], textColor: 255 },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 9;

  if (detail && detail.fieldKeys.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    sectionTitle('4. 정비 상세 내역');
    doc.setFont('NanumGothic', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 108, 128);
    const scopeLine = buildScopeLine(detail);
    doc.text(`${scopeLine} · ${detail.records.length}건${detail.truncated ? ` (최대 ${detail.records.length}건까지 표시)` : ''}`, margin, y);
    y += 5;

    const headerLabels = detail.fieldKeys.map((k) => DETAIL_FIELD_DEFS.find((f) => f.key === k)?.label || k);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['설비명', ...headerLabels]],
      body:
        detail.records.length > 0
          ? detail.records.map((r) => [r.equipment_name, ...detail.fieldKeys.map((k) => String(formatDetailField(k, r)))])
          : [['조건에 맞는 상세 내역이 없습니다.', ...headerLabels.map(() => '')]],
      styles: { font: 'NanumGothic', fontSize: 8.5, textColor: [40, 46, 60] },
      headStyles: { font: 'NanumGothic', fontStyle: 'bold', fillColor: [59, 92, 168], textColor: 255 },
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 14;
  } else {
    y += 5;
  }

  const boxW = 28;
  const boxH = 18;
  if (y + boxH > 275) {
    doc.addPage();
    y = 20;
  }
  const startX = pageWidth - margin - boxW * 3;
  doc.setDrawColor(180, 186, 200);
  doc.setFont('NanumGothic', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 68, 88);
  ['담당', '검토', '승인'].forEach((label, i) => {
    const x = startX + i * boxW;
    doc.rect(x, y, boxW, boxH);
    doc.text(label, x + boxW / 2, y + 6, { align: 'center' });
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('NanumGothic', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 156, 170);
    doc.text(SYSTEM_NAME, margin, 290);
    doc.text(`${i} / ${pageCount}`, pageWidth - margin, 290, { align: 'right' });
  }

  doc.save(`정비리포트_${report.dateFrom}_${report.dateTo}.pdf`);
}
