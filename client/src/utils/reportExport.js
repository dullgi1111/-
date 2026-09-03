import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const TYPE_LABELS = {
  breakdown_repair: '고장수리',
  preventive_inspection: '예방점검',
  other: '기타',
  unknown: '미상',
};

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

export function exportReportExcel(report, byType) {
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['정비 리포트'],
    [`기간: ${report.dateFrom} ~ ${report.dateTo}`],
    [],
    ['항목', '값'],
    ...summaryRows(report, byType),
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, '요약');

  const eqSheet = XLSX.utils.aoa_to_sheet([
    ['설비명', '고장수리 건수'],
    ...report.topEquipment.map((e) => [e.equipment_name, e.breakdown_count]),
  ]);
  XLSX.utils.book_append_sheet(wb, eqSheet, '고장수리 TOP10 설비');

  const partSheet = XLSX.utils.aoa_to_sheet([
    ['부품명', '사용 횟수'],
    ...report.topParts.map((p) => [p.canonical_text, p.count]),
  ]);
  XLSX.utils.book_append_sheet(wb, partSheet, '부품 TOP10');

  XLSX.writeFile(wb, `정비리포트_${report.dateFrom}_${report.dateTo}.xlsx`);
}

function makeDocxTable(headerRow, rows) {
  const headerCells = headerRow.map(
    (text) =>
      new TableCell({
        width: { size: 100 / headerRow.length, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ text, bold: true })],
      })
  );
  const bodyRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              width: { size: 100 / headerRow.length, type: WidthType.PERCENTAGE },
              children: [new Paragraph(String(cell))],
            })
        ),
      })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells }), ...bodyRows],
  });
}

export async function exportReportWord(report, byType) {
  const children = [
    new Paragraph({ text: '정비 리포트', heading: HeadingLevel.HEADING1 }),
    new Paragraph({ text: `기간: ${report.dateFrom} ~ ${report.dateTo}` }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '요약', heading: HeadingLevel.HEADING2 }),
    makeDocxTable(
      ['항목', '값'],
      summaryRows(report, byType).map(([k, v]) => [k, v])
    ),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '고장수리 TOP10 설비', heading: HeadingLevel.HEADING2 }),
  ];

  if (report.topEquipment.length > 0) {
    children.push(
      makeDocxTable(
        ['설비명', '고장수리 건수'],
        report.topEquipment.map((e) => [e.equipment_name, e.breakdown_count])
      )
    );
  } else {
    children.push(new Paragraph({ text: '이 기간에 고장수리 이력이 없습니다.' }));
  }

  children.push(new Paragraph({ text: '' }), new Paragraph({ text: '자주 사용된 부품 TOP10', heading: HeadingLevel.HEADING2 }));

  if (report.topParts.length > 0) {
    children.push(
      makeDocxTable(
        ['부품명', '사용 횟수'],
        report.topParts.map((p) => [p.canonical_text, p.count])
      )
    );
  } else {
    children.push(new Paragraph({ text: '이 기간에 사용된 부품 기록이 없습니다.' }));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `정비리포트_${report.dateFrom}_${report.dateTo}.docx`);
}

export async function exportReportPdf(elementId, report) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const hiddenEls = el.querySelectorAll('.no-print');
  hiddenEls.forEach((e) => {
    e.dataset.prevDisplay = e.style.display;
    e.style.display = 'none';
  });

  const canvas = await html2canvas(el, { scale: 1.5, backgroundColor: '#ffffff' });

  hiddenEls.forEach((e) => {
    e.style.display = e.dataset.prevDisplay || '';
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.85);
  const pdf = new jsPDF('p', 'mm', 'a4', true);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

  pdf.save(`정비리포트_${report.dateFrom}_${report.dateTo}.pdf`);
}
