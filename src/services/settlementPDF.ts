import { jsPDF } from 'jspdf';
import { Settlement, Employee, Load, CompanyProfile } from '../types';
import { formatDateOnly, yearFromDateOnly } from '../utils/dateOnly';
import { drawPdfLogo, loadLogoForPdf } from '../utils/pdfLogo';
import { getLoadRevenue } from './businessLogic';

/** =========================
 *  Helpers - Company Profile to PDF Info
 *  ========================= */

const getCompanyInfo = (profile: CompanyProfile) => ({
  name: (profile.companyName || '').toUpperCase(),
  legalName: (profile.legalName || '').toUpperCase(),
  address: (profile.address1 || '').toUpperCase(),
  address2: (profile.address2 || '').toUpperCase(),
  city: (profile.city || '').toUpperCase(),
  state: (profile.state || '').toUpperCase(),
  zip: profile.zip || '',
  country: profile.country || 'United States',
  website: profile.website || '',
  email: profile.email || '',
  phone: profile.phone || '',
  dotNumber: profile.dotNumber || '',
  mcNumber: profile.mcNumber || '',
  ein: profile.ein || '',
  logoUrl: profile.logoUrl,
  primaryColor: profile.primaryColor || '#1D4ED8',
  accentColor: profile.accentColor || '#0EA5E9',
  defaultFooterText: profile.defaultFooterText,
});

/** =========================
 *  Styling constants
 *  ========================= */

const FONT = 'helvetica' as const;

const FONT_SIZES = {
  title: 14,
  small: 7,
  body: 8,
  header: 9,
  tableHeader: 8,
  tableData: 7,
  totalsTitle: 10,
  totalsValue: 12,
};

const COLORS = {
  blue: [30, 144, 255] as [number, number, number],
  blueSoft: [232, 244, 252] as [number, number, number],
  grayRow: [245, 245, 245] as [number, number, number],
  border: [200, 200, 200] as [number, number, number],
  text: [0, 0, 0] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const formatCurrency = (amount: number): string => {
  if (amount < 0) return `($${Math.abs(amount).toFixed(2)})`;
  return `$${(amount || 0).toFixed(2)}`;
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  return formatDateOnly(dateStr, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateHeader = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  return formatDateOnly(dateStr, { month: 'short', day: '2-digit', year: 'numeric' });
};

/**
 * Calculate YTD from PAID settlements only (excludes draft/void)
 * Uses settlement status and paidAt for accurate YTD tracking
 */
const calculateYTD = (
  settlements: Settlement[],
  payeeId: string,
  year: number
): { earnings: number; deductions: number; netPay: number } => {
  // Filter: Only PAID settlements for this payee in the current year
  const paidSettlements = settlements.filter((s) => {
    // Match payee
    if (s.driverId !== payeeId && s.dispatcherId !== payeeId && s.payeeId !== payeeId) return false;
    
    // Must be PAID (exclude draft, void, undefined status)
    const status = s.status || 'draft';
    if (status !== 'paid') return false;
    
    // Must be in the current year (use paidAt if available, otherwise date/createdAt)
    const paymentDate = s.paidAt || s.date || s.createdAt || '';
    if (!paymentDate) return false;
    // Use local date parsing to avoid timezone shift bug
    const paymentYear = yearFromDateOnly(paymentDate);
    if (paymentYear !== year) return false;
    
    return true;
  });

  // Sum from PAID settlements only
  const earnings = paidSettlements.reduce((sum, s) => sum + (s.grossPay || 0), 0);
  const deductions = paidSettlements.reduce((sum, s) => sum + (s.totalDeductions || 0), 0);
  const netPay = paidSettlements.reduce((sum, s) => sum + (s.netPay || 0), 0);
  
  return { earnings, deductions, netPay };
};

/** =========================
 *  Drawing primitives
 *  ========================= */

type Box = { x: number; y: number; w: number; h: number };

const setBorder = (doc: jsPDF) => {
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.01); // visible & consistent
};

const setText = (doc: jsPDF) => {
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
};

const drawFilledBar = (doc: jsPDF, box: Box, rgb: [number, number, number]) => {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(box.x, box.y, box.w, box.h, 'F');
};

const drawBox = (doc: jsPDF, box: Box, fill?: [number, number, number]) => {
  setBorder(doc);
  if (fill) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(box.x, box.y, box.w, box.h, 'FD');
  } else {
    doc.rect(box.x, box.y, box.w, box.h);
  }
};

const drawText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  opts?: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; maxWidth?: number }
) => {
  doc.setFont(FONT, opts?.bold ? 'bold' : 'normal');
  doc.setFontSize(opts?.size ?? FONT_SIZES.body);
  // Avoid maxWidth wrap without matching row height — callers should truncate or use multi-line rows.
  doc.text(text || '', x, y, { align: opts?.align ?? 'left', maxWidth: opts?.maxWidth });
};

/** Fit text to a single line; append ellipsis when it would overflow the cell. */
const truncateToWidth = (
  doc: jsPDF,
  text: string,
  maxWidth: number,
  fontSize: number,
  bold = false
): string => {
  const value = text || '';
  if (!value || maxWidth <= 0) return value;
  doc.setFont(FONT, bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  if (doc.getTextWidth(value) <= maxWidth) return value;
  const ellipsis = '…';
  let truncated = value;
  while (truncated.length > 1 && doc.getTextWidth(truncated + ellipsis) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? truncated + ellipsis : ellipsis;
};

const drawLogoPlaceholder = (doc: jsPDF, x: number, y: number) => {
  const box: Box = { x, y, w: 0.9, h: 0.9 };
  drawBox(doc, box);
  drawText(doc, 'LOGO', x + box.w / 2, y + box.h / 2 + 0.02, {
    size: FONT_SIZES.body,
    bold: true,
    align: 'center',
  });
};

const drawSectionLabelBar = (doc: jsPDF, x: number, y: number, w: number, label: string) => {
  const bar: Box = { x, y, w, h: 0.22 };
  drawFilledBar(doc, bar, COLORS.blue);
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  drawText(doc, label.toUpperCase(), x + 0.08, y + 0.15, { size: FONT_SIZES.header, bold: true });
  setText(doc);
};

const drawTwoColumnPanels = (doc: jsPDF, x: number, y: number, w: number) => {
  const gap = 0.12;
  const panelW = (w - gap) / 2;
  const h = 0.75;
  const left: Box = { x, y, w: panelW, h };
  const right: Box = { x: x + panelW + gap, y, w: panelW, h };
  drawBox(doc, left);
  drawBox(doc, right);
  return { left, right, h };
};

const drawTableHeader = (doc: jsPDF, x: number, y: number, colWidths: number[], headers: string[]) => {
  const h = 0.20;
  doc.setFillColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(FONT_SIZES.tableHeader);

  let cx = x;
  for (let i = 0; i < headers.length; i++) {
    doc.rect(cx, y, colWidths[i], h, 'F');
    const label = truncateToWidth(doc, headers[i], colWidths[i] - 0.08, FONT_SIZES.tableHeader, true);
    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(FONT_SIZES.tableHeader);
    doc.text(label, cx + colWidths[i] / 2, y + 0.13, { align: 'center' });
    cx += colWidths[i];
  }
  setText(doc);
  setBorder(doc);
  // outer border + verticals
  doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), h);
  cx = x;
  for (let i = 0; i < colWidths.length; i++) {
    doc.line(cx, y, cx, y + h);
    cx += colWidths[i];
  }
  doc.line(x + colWidths.reduce((a, b) => a + b, 0), y, x + colWidths.reduce((a, b) => a + b, 0), y + h);
  return h;
};

const drawTableRow = (
  doc: jsPDF,
  x: number,
  y: number,
  colWidths: number[],
  values: string[],
  opts?: {
    altFill?: boolean;
    rightCols?: number[];
    /** Columns that may wrap to multiple lines (others are ellipsis-truncated to 1 line). */
    wrapCols?: number[];
    rowHeight?: number;
    maxLines?: number;
  }
) => {
  const fontSize = FONT_SIZES.tableData;
  const lineHeight = 0.11;
  const topPad = 0.04;
  const cellPadX = 0.06;
  const wrapCols = new Set(opts?.wrapCols || []);
  const maxLines = opts?.maxLines ?? 3;

  doc.setFont(FONT, 'normal');
  doc.setFontSize(fontSize);

  const cellLines = values.map((raw, i) => {
    const maxW = Math.max(0.05, colWidths[i] - cellPadX * 2);
    const value = raw || '';
    if (wrapCols.has(i)) {
      const lines = doc.splitTextToSize(value, maxW) as string[];
      return lines.slice(0, maxLines);
    }
    return [truncateToWidth(doc, value, maxW, fontSize, false)];
  });

  const lineCount = Math.max(1, ...cellLines.map(lines => lines.length));
  const h = opts?.rowHeight ?? Math.max(0.16, topPad * 2 + lineCount * lineHeight);

  if (opts?.altFill) {
    doc.setFillColor(COLORS.grayRow[0], COLORS.grayRow[1], COLORS.grayRow[2]);
    doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), h, 'F');
  }

  setBorder(doc);
  doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), h);

  let cx = x;
  for (let i = 0; i < colWidths.length; i++) {
    doc.line(cx, y, cx, y + h);
    const align = opts?.rightCols?.includes(i) ? 'right' : 'left';
    const tx = align === 'right' ? cx + colWidths[i] - cellPadX : cx + cellPadX;
    const lines = cellLines[i];
    lines.forEach((line, lineIdx) => {
      drawText(doc, line, tx, y + topPad + 0.08 + lineIdx * lineHeight, {
        size: fontSize,
        bold: false,
        align,
      });
    });
    cx += colWidths[i];
  }
  doc.line(cx, y, cx, y + h);
  return h;
};

const drawTotalsBand = (doc: jsPDF, x: number, y: number, w: number, items: Array<{ label: string; value: string }>) => {
  // 4 equal cells max. If fewer, still spread equally.
  const cols = items.length;
  const cellW = w / cols;
  const h = 0.30;

  drawBox(doc, { x, y, w, h }, COLORS.blueSoft);

  let cx = x;
  for (let i = 0; i < cols; i++) {
    if (i > 0) {
      setBorder(doc);
      doc.line(cx, y, cx, y + h);
    }
    drawText(doc, items[i].label.toUpperCase(), cx + cellW / 2, y + 0.12, {
      size: FONT_SIZES.small,
      bold: true,
      align: 'center',
    });
    drawText(doc, items[i].value, cx + cellW / 2, y + 0.25, {
      size: FONT_SIZES.body,
      bold: true,
      align: 'center',
    });
    cx += cellW;
  }
  return h;
};

const drawSummaryBox = (doc: jsPDF, x: number, y: number, w: number, title: string, value: string) => {
  const h = 0.34;
  drawBox(doc, { x, y, w, h }, COLORS.blueSoft);
  drawText(doc, title.toUpperCase(), x + w / 2, y + 0.14, { size: FONT_SIZES.totalsTitle, bold: true, align: 'center' });
  drawText(doc, value, x + w / 2, y + 0.29, { size: FONT_SIZES.totalsValue, bold: true, align: 'center' });
  return h;
};

const ensurePageSpace = (doc: jsPDF, y: number, needed: number, margin: number) => {
  const pageHeight = 11;
  if (y + needed > pageHeight - margin) {
    doc.addPage();
    return margin;
  }
  return y;
};

// Generate Driver Settlement PDF
/** =========================
 *  MAIN: Driver settlement PDF
 *  ========================= */

export const generateDriverSettlementPDF = async (
  settlement: Settlement,
  driver: Employee,
  loads: Load[],
  allSettlements: Settlement[],
  companyProfile: CompanyProfile
): Promise<void> => {
  const COMPANY = getCompanyInfo(companyProfile);
  const logo = await loadLogoForPdf(COMPANY.logoUrl);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
  doc.setFont(FONT, 'normal');
  setText(doc);

  const margin = 0.5;
  const pageWidth = 8.5;
  const contentW = pageWidth - margin * 2;
  let y = margin;

  /** ====== HEADER ====== */
  // Title right aligned — keep clear of logo box on the left
  drawText(doc, 'SETTLEMENT STATEMENT', pageWidth - margin, y + 0.10, { size: FONT_SIZES.title, bold: true, align: 'right' });

  // Logo (if available) or placeholder left
  const logoSize = 0.9;
  let logoDrawn = false;
  if (logo) {
    logoDrawn = drawPdfLogo(doc, logo, margin, y, logoSize, logoSize);
  }
  if (!logoDrawn) {
    drawLogoPlaceholder(doc, margin, y);
  }

  // Company block right
  const rightX = pageWidth - margin;
  let cy = y + 0.30;

  drawText(doc, COMPANY.name, rightX, cy, { size: FONT_SIZES.body, bold: true, align: 'right' });
  cy += 0.16;
  // Build address lines
  const addressLines: string[] = [];
  if (COMPANY.address) addressLines.push(COMPANY.address);
  if (COMPANY.address2) addressLines.push(COMPANY.address2);
  const addr2 = `${COMPANY.city}${COMPANY.city && COMPANY.state ? ', ' : ''}${COMPANY.state} ${COMPANY.zip}`.trim();
  if (addr2) addressLines.push(addr2);
  if (COMPANY.country) addressLines.push(COMPANY.country);
  addressLines.forEach((line) => {
    drawText(doc, line, rightX, cy, { size: FONT_SIZES.body, bold: false, align: 'right' });
    cy += 0.16;
  });

  cy += 0.06;
  const contacts: string[] = [];
  if (COMPANY.phone) contacts.push(`Phone: ${COMPANY.phone}`);
  if (COMPANY.email) contacts.push(`Email: ${COMPANY.email}`);
  if (COMPANY.website) contacts.push(`Web: ${COMPANY.website}`);
  if (COMPANY.mcNumber) contacts.push(`MC: ${COMPANY.mcNumber}`);
  if (COMPANY.dotNumber) contacts.push(`DOT: ${COMPANY.dotNumber}`);
  if (COMPANY.ein) contacts.push(`EIN: ${COMPANY.ein}`);
  contacts.forEach((line) => {
    drawText(doc, line, rightX, cy, { size: FONT_SIZES.small, align: 'right' });
    cy += 0.14;
  });

  // Settlement type sits below the logo/company header so it never overlaps the logo box
  y = Math.max(y + logoSize + 0.12, cy + 0.08);
  const isOwnerOperator = (driver as any).employeeType === 'owner_operator' || (driver as any).type === 'OwnerOperator';
  const settlementTypeText = isOwnerOperator
    ? 'Settlement Type: Owner-Operator (Independent Contractor) | This document is not a payroll paystub'
    : 'Settlement Type: Company Driver | This document is not a payroll paystub';
  drawText(doc, settlementTypeText, margin, y, {
    size: FONT_SIZES.small,
    bold: false,
    align: 'left',
    maxWidth: contentW,
  });
  y += 0.22;

  /** ====== PAYMENT FOR BAR + PANELS ====== */
  y = ensurePageSpace(doc, y, 1.2, margin);

  drawSectionLabelBar(doc, margin, y, contentW, 'PAYMENT FOR');
  y += 0.28;

  const { left, right, h: panelsH } = drawTwoColumnPanels(doc, margin, y, contentW);

  // Left panel content
  const unitNumber = (driver as any).unitNumber || '';
  const unitText = unitNumber ? `, Unit #${unitNumber}` : '';
  drawText(doc, `${driver.firstName} ${driver.lastName}${unitText}`, left.x + 0.08, left.y + 0.18, {
    size: FONT_SIZES.body,
    bold: true,
  });

  const driverAddress = (driver as any).address || '';
  const driverCity = (driver as any).city || '';
  const driverState = (driver as any).state || '';
  const driverZip = (driver as any).zipCode || '';
  const fullAddress = [driverAddress, driverCity, driverState, driverZip].filter(Boolean).join(', ');

  if (fullAddress) {
    drawText(doc, fullAddress, left.x + 0.08, left.y + 0.35, { size: FONT_SIZES.body });
  }

  // Right panel content
  drawText(doc, `Settlement #: ${settlement.settlementNumber || 'N/A'}`, right.x + right.w - 0.08, right.y + 0.18, {
    size: FONT_SIZES.body,
    bold: true,
    align: 'right',
  });
  drawText(
    doc,
    `Period: ${formatDateHeader(settlement.periodStart || '')} - ${formatDateHeader(settlement.periodEnd || '')}`,
    right.x + right.w - 0.08,
    right.y + 0.35,
    { size: FONT_SIZES.body, align: 'right' }
  );

  y += panelsH + 0.22;

  /** ====== LOAD DETAILS TABLE ====== */
  y = ensurePageSpace(doc, y, 2.0, margin);

  const isDispatcher = settlement.type === 'dispatcher';

  drawText(doc, 'LOAD DETAILS', margin, y, { size: FONT_SIZES.header, bold: true });
  y += 0.12;

  const payShareLabel = isDispatcher ? 'DISPATCH COMMISSION' : 'DRIVER GROSS SHARE';
  const loadCols = ['LOAD #', 'DATE', 'ROUTE', 'COMPANY GROSS', payShareLabel];
  // Wider LOAD # so CORE-TEST-* style numbers fit; route may wrap with dynamic row height
  const loadW = [1.45, 0.95, 2.45, 1.15, 1.15];

  const headH = drawTableHeader(doc, margin, y, loadW, loadCols);
  y += headH;

  // Prefer immutable settlement.loads snapshot; hydrate display-only fields from live loads
  let settlementLoads = settlement.loads || [];

  if (settlementLoads.length === 0 && settlement.loadIds && settlement.loadIds.length > 0) {
    settlementLoads = settlement.loadIds.map(loadId => {
      const load = loads.find(l => l.id === loadId);
      return {
        loadId,
        loadNumber: load?.loadNumber,
        deliveryDate: load?.deliveryDate,
        pickupDate: load?.pickupDate,
        originCity: load?.originCity,
        originState: load?.originState,
        destCity: load?.destCity,
        destState: load?.destState,
        companyGross: load ? getLoadRevenue(load) : 0,
        miles: load?.miles || 0,
        // Legacy settlements without snapshots: use stored driver pay fields only — never recalculate
        basePay: isDispatcher
          ? (load?.dispatcherCommissionAmount || 0)
          : (load?.driverBasePay || load?.driverTotalGross || 0),
        detention: load?.driverDetentionPay || 0,
        tonu: load?.tonuFee || 0,
        layover: load?.driverLayoverPay || 0,
        dispatchFee: load?.dispatcherCommissionAmount || 0,
      };
    });
  }

  let totalLoadAmount = 0;
  let totalGrossPay = 0;

  settlementLoads.forEach((li, idx) => {
    const load = loads.find((l) => l.id === li.loadId);

    // Money from snapshot only — never recalculate from live employee rates
    const rowShare = isDispatcher
      ? (li.basePay || li.dispatchFee || 0)
      : (li.basePay || 0);
    const loadAmount =
      li.companyGross != null && li.companyGross > 0
        ? li.companyGross
        : load
          ? getLoadRevenue(load)
          : 0;

    totalLoadAmount += loadAmount;
    totalGrossPay += rowShare;

    const originCity = li.originCity || load?.originCity || '';
    const originState = li.originState || load?.originState || '';
    const destCity = li.destCity || load?.destCity || '';
    const destState = li.destState || load?.destState || '';
    const origin = `${originCity}${originState ? ', ' + originState : ''}`.trim();
    const dest = `${destCity}${destState ? ', ' + destState : ''}`.trim();
    const route = origin && dest ? `${origin} - ${dest}` : origin || dest || 'N/A';
    const loadNumber = li.loadNumber || load?.loadNumber || 'N/A';
    const dateRaw = li.deliveryDate || li.pickupDate || load?.deliveryDate || load?.pickupDate || '';

    y = ensurePageSpace(doc, y, 0.35, margin);

    const rowH = drawTableRow(
      doc,
      margin,
      y,
      loadW,
      [
        String(loadNumber),
        dateRaw ? formatDate(dateRaw) : 'N/A',
        route,
        formatCurrency(loadAmount),
        formatCurrency(rowShare),
      ],
      {
        altFill: idx % 2 === 0,
        rightCols: [3, 4],
        // Only ROUTE wraps; LOAD # / DATE / amounts stay single-line (ellipsis if needed)
        wrapCols: [2],
        maxLines: 2,
      }
    );
    y += rowH;
  });

  // Totals row (table-like)
  y += 0.06;
  y = ensurePageSpace(doc, y, 0.22, margin);

  // draw totals row band
  drawBox(doc, { x: margin, y, w: loadW.reduce((a, b) => a + b, 0), h: 0.20 }, COLORS.blueSoft);
  setBorder(doc);
  let cx = margin;
  for (let i = 0; i < loadW.length; i++) {
    if (i > 0) doc.line(cx, y, cx, y + 0.20);
    cx += loadW[i];
  }

  drawText(doc, 'TOTAL', margin + 0.06, y + 0.13, { size: FONT_SIZES.body, bold: true });
  // amounts aligned inside their cells
  const amtX = margin + loadW[0] + loadW[1] + loadW[2];
  drawText(doc, formatCurrency(totalLoadAmount), amtX + loadW[3] - 0.06, y + 0.13, { size: FONT_SIZES.body, bold: true, align: 'right' });
  drawText(doc, formatCurrency(totalGrossPay), amtX + loadW[3] + loadW[4] - 0.06, y + 0.13, { size: FONT_SIZES.body, bold: true, align: 'right' });

  y += 0.28;

  /** ====== PAY FORMULA BOX (from settlement snapshot totals — not live rates) ====== */
  y = ensurePageSpace(doc, y, 0.6, margin);

  const snapshotGross = settlement.grossPay ?? totalGrossPay;
  const snapshotMiles = settlement.totalMiles || settlementLoads.reduce((sum, sl) => sum + (sl.miles || 0), 0);
  let driverPayFormula = '';
  if (isDispatcher) {
    driverPayFormula = `Company Gross: ${formatCurrency(totalLoadAmount)} | Dispatcher Commission: ${formatCurrency(snapshotGross)} | Loads: ${settlementLoads.length}`;
  } else if (settlement.payType === 'per_mile' && settlement.payRateSnapshot != null) {
    driverPayFormula = `Total Miles: ${snapshotMiles.toLocaleString()} | Rate: $${settlement.payRateSnapshot.toFixed(2)}/mi | Gross Share: ${formatCurrency(snapshotGross)}`;
  } else if (settlement.payType === 'percentage' && settlement.payRateSnapshot != null) {
    const pct = settlement.payRateSnapshot > 1 ? settlement.payRateSnapshot : settlement.payRateSnapshot * 100;
    driverPayFormula = `Company Gross: ${formatCurrency(totalLoadAmount)} | Rate: ${pct.toFixed(1)}% | Gross Share: ${formatCurrency(snapshotGross)}`;
  } else if (totalLoadAmount > 0 && snapshotGross > 0) {
    driverPayFormula = `Company Gross: ${formatCurrency(totalLoadAmount)} | Gross Share: ${formatCurrency(snapshotGross)} | Loads: ${settlementLoads.length}`;
  }

  if (driverPayFormula) {
    const formulaBoxH = 0.40;
    drawBox(doc, { x: margin, y, w: contentW, h: formulaBoxH }, COLORS.blueSoft);
    drawText(doc, isDispatcher ? 'DISPATCHER PAY CALCULATION' : 'DRIVER PAY CALCULATION', margin + contentW / 2, y + 0.12, {
      size: FONT_SIZES.small,
      bold: true,
      align: 'center',
    });
    drawText(doc, driverPayFormula, margin + contentW / 2, y + 0.28, {
      size: FONT_SIZES.body,
      bold: false,
      align: 'center',
      maxWidth: contentW - 0.2,
    });
    y += formulaBoxH + 0.18;
  }

  /** ====== EARNINGS (same logic but boxed table) ====== */
  y = ensurePageSpace(doc, y, 1.3, margin);

  drawText(doc, 'EARNINGS', margin, y, { size: FONT_SIZES.header, bold: true });
  y += 0.12;

  const totalDetention = settlementLoads.reduce((sum, l) => sum + ((l as any).detention || 0), 0);
  const totalTonu = settlementLoads.reduce((sum, l) => sum + ((l as any).tonu || 0), 0);
  const totalLayover = settlementLoads.reduce((sum, l) => sum + ((l as any).layover || 0), 0);
  const totalEarnings = totalDetention + totalTonu + totalLayover;

  const earnCols = ['DESCRIPTION', 'AMOUNT'];
  const earnW = [contentW * 0.65, contentW * 0.35];

  const earnHeadH = drawTableHeader(doc, margin, y, earnW, earnCols);
  y += earnHeadH;

  const earnRows = [
    { desc: 'DETENTION FEES', amt: totalDetention },
    { desc: 'TONU FEE', amt: totalTonu },
    { desc: 'LAYOVER FEE', amt: totalLayover },
  ].filter((r) => r.amt > 0);

  if (earnRows.length === 0) {
    drawTableRow(doc, margin, y, earnW, ['N/A', '$0.00'], { altFill: true, rightCols: [1], rowHeight: 0.16 });
    y += 0.16;
  } else {
    earnRows.forEach((r, idx) => {
      drawTableRow(doc, margin, y, earnW, [r.desc, formatCurrency(r.amt)], { altFill: idx % 2 === 0, rightCols: [1], rowHeight: 0.16 });
      y += 0.16;
    });
  }

  // Total earnings row
  y += 0.06;
  drawBox(doc, { x: margin, y, w: earnW[0] + earnW[1], h: 0.20 }, COLORS.blueSoft);
  setBorder(doc);
  doc.line(margin + earnW[0], y, margin + earnW[0], y + 0.20);
  drawText(doc, 'TOTAL EARNINGS', margin + 0.06, y + 0.13, { size: FONT_SIZES.body, bold: true });
  drawText(doc, formatCurrency(totalEarnings), margin + earnW[0] + earnW[1] - 0.06, y + 0.13, {
    size: FONT_SIZES.body,
    bold: true,
    align: 'right',
  });
  y += 0.28;

  const adjustedGrossPay = totalGrossPay + totalEarnings;

  /** ====== OTHER EARNINGS (optional section) ====== */
  const otherEarnings = settlement.otherEarnings || [];
  const totalOtherEarnings = otherEarnings.reduce((sum, e) => sum + (e.amount || 0), 0);

  if (totalOtherEarnings > 0 || otherEarnings.length > 0) {
    y = ensurePageSpace(doc, y, 1.6, margin);

    drawText(doc, 'OTHER EARNINGS', margin, y, { size: FONT_SIZES.header, bold: true });
    y += 0.12;

    const oeW = [contentW * 0.35, contentW * 0.65];
    const oeHeadH = drawTableHeader(doc, margin, y, oeW, ['AMOUNT', 'DESCRIPTION']);
    y += oeHeadH;

    if (otherEarnings.length === 0) {
      drawTableRow(doc, margin, y, oeW, ['$0.00', 'N/A'], { altFill: true, rightCols: [0], rowHeight: 0.16 });
      y += 0.16;
    } else {
      otherEarnings.forEach((e, idx) => {
        drawTableRow(
          doc,
          margin,
          y,
          oeW,
          [formatCurrency(e.amount || 0), e.description || e.type || 'Other'],
          { altFill: idx % 2 === 0, rightCols: [0], rowHeight: 0.16 }
        );
        y += 0.16;
      });
    }

    y += 0.06;
    drawBox(doc, { x: margin, y, w: oeW[0] + oeW[1], h: 0.20 }, COLORS.blueSoft);
    setBorder(doc);
    doc.line(margin + oeW[0], y, margin + oeW[0], y + 0.20);
    drawText(doc, 'TOTAL OTHER EARNINGS', margin + 0.06, y + 0.13, { size: FONT_SIZES.body, bold: true });
    drawText(doc, formatCurrency(totalOtherEarnings), margin + oeW[0] + oeW[1] - 0.06, y + 0.13, {
      size: FONT_SIZES.body,
      bold: true,
      align: 'right',
    });
    y += 0.28;
  }

  /** ====== DEDUCTIONS MATRIX ====== */
  y = ensurePageSpace(doc, y, 1.0, margin);

  drawText(doc, 'DEDUCTIONS', margin, y, { size: FONT_SIZES.header, bold: true });
  y += 0.12;

  const isOODriver = (driver as any).employeeType === 'owner_operator' || (driver as any).type === 'OwnerOperator';
  const deductions = settlement.deductions || {};

  if (isOODriver) {
    const cols = ['INSUR.', 'IFTA', 'CASH', 'FUEL', 'TRAIL.', 'REP.', 'PARK.', '2290', 'ELD', 'TOLL', 'IRP', 'UCR', 'ESCROW', 'OCC.AC', 'OTHER'];
    const w = contentW / cols.length;

    // header
    const headerH = drawTableHeader(doc, margin, y, Array(cols.length).fill(w), cols);
    y += headerH;

    // values
    const values = [
      formatCurrency(deductions.insurance || 0),
      formatCurrency(deductions.ifta || 0),
      formatCurrency(deductions.cashAdvance || 0),
      formatCurrency(deductions.fuel || 0),
      formatCurrency(deductions.trailer || 0),
      formatCurrency(deductions.repairs || 0),
      formatCurrency(deductions.parking || 0),
      formatCurrency(deductions.form2290 || 0),
      formatCurrency(deductions.eld || 0),
      formatCurrency(deductions.toll || 0),
      formatCurrency(deductions.irp || 0),
      formatCurrency(deductions.ucr || 0),
      formatCurrency(deductions.escrow || 0),
      formatCurrency(deductions.occupationalAccident || 0),
      formatCurrency(deductions.other || 0),
    ];

    // row (center-ish for tight look)
    const hRow = 0.18;
    drawBox(doc, { x: margin, y, w: contentW, h: hRow });
    setBorder(doc);
    let cx2 = margin;
    for (let i = 0; i < cols.length; i++) {
      if (i > 0) doc.line(cx2, y, cx2, y + hRow);
      drawText(doc, values[i], cx2 + w / 2, y + 0.12, { size: FONT_SIZES.tableData, align: 'center' });
      cx2 += w;
    }
    doc.line(margin + contentW, y, margin + contentW, y + hRow);
    y += hRow + 0.22;
  } else {
    const cols = ['CASH', 'ESCROW', 'OCC.ACC', 'UNIFORM', 'OTHER'];
    const w = contentW / cols.length;

    const headerH = drawTableHeader(doc, margin, y, Array(cols.length).fill(w), cols);
    y += headerH;

    const values = [
      formatCurrency(deductions.cashAdvance || 0),
      formatCurrency(deductions.escrow || 0),
      formatCurrency(deductions.occupationalAccident || 0),
      formatCurrency(0), // Uniform deduction not in type definition
      formatCurrency(deductions.other || 0),
    ];

    const hRow = 0.18;
    drawBox(doc, { x: margin, y, w: contentW, h: hRow });
    setBorder(doc);
    let cx2 = margin;
    for (let i = 0; i < cols.length; i++) {
      if (i > 0) doc.line(cx2, y, cx2, y + hRow);
      drawText(doc, values[i], cx2 + w / 2, y + 0.12, { size: FONT_SIZES.tableData, align: 'center' });
      cx2 += w;
    }
    doc.line(margin + contentW, y, margin + contentW, y + hRow);
    y += hRow + 0.22;
  }

  /** ====== SUMMARY BOXES — use immutable settlement totals ====== */
  const grossPay = settlement.grossPay ?? (adjustedGrossPay + totalOtherEarnings);
  const totalDeductions = settlement.totalDeductions || 0;
  const netPay = settlement.netPay != null ? settlement.netPay : Math.max(0, grossPay - totalDeductions);

  y = ensurePageSpace(doc, y, 0.9, margin);

  // Totals band with corrected terminology
  const bandH = drawTotalsBand(doc, margin, y, contentW, [
    { label: 'TOTAL COMPANY GROSS', value: formatCurrency(totalLoadAmount) },
    { label: isDispatcher ? 'DISPATCH COMMISSION' : 'DRIVER GROSS SHARE', value: formatCurrency(totalGrossPay) },
    { label: 'ACCESSORIALS', value: formatCurrency(totalEarnings + totalOtherEarnings) },
    { label: 'GROSS SETTLEMENT', value: formatCurrency(grossPay) },
  ]);
  y += bandH + 0.18;

  // Centered summary boxes
  const boxW = contentW * 0.70;
  const boxX = margin + (contentW - boxW) / 2;

  y = ensurePageSpace(doc, y, 0.9, margin);
  y += drawSummaryBox(doc, boxX, y, boxW, 'TOTAL DEDUCTIONS', formatCurrency(totalDeductions)) + 0.16;

  y = ensurePageSpace(doc, y, 0.9, margin);
  y += drawSummaryBox(doc, boxX, y, boxW, 'NET SETTLEMENT AMOUNT', formatCurrency(netPay)) + 0.18;

  /** ====== YTD ====== */
  y = ensurePageSpace(doc, y, 0.7, margin);

  drawSectionLabelBar(doc, margin, y, contentW, 'YTD SUMMARY');
  y += 0.28;

  const currentYear = new Date().getFullYear();
  const ytdPayeeId = settlement.driverId || settlement.dispatcherId || settlement.payeeId || '';
  const ytd = calculateYTD(allSettlements, ytdPayeeId, currentYear);

  const ytdCols = [
    isDispatcher ? 'YTD DISPATCH GROSS' : 'YTD DRIVER GROSS',
    'YTD DEDUCTIONS',
    'YTD NET SETTLEMENTS PAID',
  ];
  const ytdW = contentW / 3;
  const ytdH = 0.30;

  // header row
  drawBox(doc, { x: margin, y, w: contentW, h: ytdH }, COLORS.blueSoft);
  setBorder(doc);
  doc.line(margin + ytdW, y, margin + ytdW, y + ytdH);
  doc.line(margin + ytdW * 2, y, margin + ytdW * 2, y + ytdH);

  for (let i = 0; i < 3; i++) {
    drawText(doc, ytdCols[i], margin + ytdW * (i + 0.5), y + 0.12, { size: FONT_SIZES.small, bold: true, align: 'center' });
  }

  drawText(doc, formatCurrency(ytd.earnings), margin + ytdW * 0.5, y + 0.25, { size: FONT_SIZES.body, bold: true, align: 'center' });
  drawText(doc, formatCurrency(ytd.deductions), margin + ytdW * 1.5, y + 0.25, { size: FONT_SIZES.body, bold: true, align: 'center' });
  drawText(doc, formatCurrency(ytd.netPay), margin + ytdW * 2.5, y + 0.25, { size: FONT_SIZES.body, bold: true, align: 'center' });

  y += ytdH + 0.22;

  /** ====== FOOTER ====== */
  const pageHeight = 11;

  // Use custom footer text if provided, otherwise default
  const footerText = COMPANY.defaultFooterText || 'Thank You For Your Business';
  drawText(doc, footerText, margin + contentW / 2, pageHeight - margin - 0.50, {
    size: FONT_SIZES.body,
    bold: false,
    align: 'center',
  });

  // Compliance disclaimers
  const paymentMethodText = settlement.paymentMethod 
    ? `Payment Method: ${settlement.paymentMethod}${settlement.checkNumber ? ` | Check #: ${settlement.checkNumber}` : ''}`
    : '';
  
  if (paymentMethodText) {
    drawText(
      doc,
      paymentMethodText,
      margin + contentW / 2,
      pageHeight - margin - 0.35,
      { size: FONT_SIZES.small, align: 'center', maxWidth: contentW }
    );
  }
  
  drawText(
    doc,
    '* This is an independent contractor settlement statement. All payments are made to 1099 Independent Contractors. No tax withholdings are applied.',
    margin + contentW / 2,
    pageHeight - margin - 0.21,
    { size: FONT_SIZES.small, align: 'center', maxWidth: contentW }
  );
  
  drawText(
    doc,
    '* Period Covered: ' + formatDateHeader(settlement.periodStart || '') + ' through ' + formatDateHeader(settlement.periodEnd || ''),
    margin + contentW / 2,
    pageHeight - margin - 0.07,
    { size: FONT_SIZES.small, align: 'center', maxWidth: contentW }
  );

  drawText(doc, 'PAGE 1 OF 1', pageWidth - margin, pageHeight - margin, {
    size: FONT_SIZES.small,
    align: 'right',
  });

  const filename = `Settlement-${settlement.settlementNumber || settlement.id}-${driver.firstName}-${driver.lastName}.pdf`;
  doc.save(filename);
};

export const generateDispatcherSettlementPDF = async (
  settlement: Settlement,
  dispatcher: Employee,
  loads: Load[],
  allSettlements: Settlement[],
  companyProfile: CompanyProfile
): Promise<void> => {
  // Same layout; settlement.type === 'dispatcher' switches labels/columns to commission
  await generateDriverSettlementPDF(
    { ...settlement, type: 'dispatcher' },
    dispatcher,
    loads,
    allSettlements,
    companyProfile
  );
};

export const generateSettlementPDF = async (
  settlement: Settlement,
  payee: Employee,
  loads: Load[],
  allSettlements: Settlement[],
  companyProfile: CompanyProfile
): Promise<void> => {
  if (settlement.type === 'dispatcher' || (payee as any).employeeType === 'dispatcher') {
    await generateDispatcherSettlementPDF(settlement, payee, loads, allSettlements, companyProfile);
  } else {
    await generateDriverSettlementPDF(settlement, payee, loads, allSettlements, companyProfile);
  }
};
