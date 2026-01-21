import { jsPDF } from 'jspdf';
import { Settlement, Employee, Load, FactoringCompany, CompanyProfile } from '../types';
import { yearFromDateOnly } from '../utils/dateOnly';
import { calculateDriverPay } from './businessLogic';

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
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateHeader = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
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
  doc.text(text || '', x, y, { align: opts?.align ?? 'left', maxWidth: opts?.maxWidth });
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
    doc.text(headers[i], cx + colWidths[i] / 2, y + 0.13, { align: 'center' });
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
  opts?: { altFill?: boolean; rightCols?: number[]; rowHeight?: number }
) => {
  const h = opts?.rowHeight ?? 0.16;

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
    const pad = 0.06;
    const tx = align === 'right' ? cx + colWidths[i] - pad : cx + pad;
    drawText(doc, values[i] || '', tx, y + 0.11, {
      size: FONT_SIZES.tableData,
      bold: false,
      align,
      maxWidth: colWidths[i] - 0.12,
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

export const generateDriverSettlementPDF = (
  settlement: Settlement,
  driver: Employee,
  loads: Load[],
  allSettlements: Settlement[],
  companyProfile: CompanyProfile
): void => {
  const COMPANY = getCompanyInfo(companyProfile);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
  doc.setFont(FONT, 'normal');
  setText(doc);

  const margin = 0.5;
  const pageWidth = 8.5;
  const contentW = pageWidth - margin * 2;
  let y = margin;

  /** ====== HEADER ====== */
  // Title right aligned
  drawText(doc, 'SETTLEMENT STATEMENT', pageWidth - margin, y + 0.10, { size: FONT_SIZES.title, bold: true, align: 'right' });
  
  // Compliance disclaimer - Settlement type notice
  const isOwnerOperator = (driver as any).employeeType === 'owner_operator' || (driver as any).type === 'OwnerOperator';
  const settlementTypeText = isOwnerOperator 
    ? 'Settlement Type: Owner-Operator (Independent Contractor) | This document is not a payroll paystub'
    : 'Settlement Type: Company Driver | This document is not a payroll paystub';
  drawText(doc, settlementTypeText, margin, y + 0.25, { 
    size: FONT_SIZES.small, 
    bold: false, 
    align: 'left',
    maxWidth: contentW 
  });

  // Logo (if available) or placeholder left
  if (COMPANY.logoUrl) {
    try {
      // Try to add logo image (base64 or URL)
      // Note: jsPDF requires image to be loaded first
      // For now, we'll use placeholder but structure is ready for image loading
      // TODO: Implement async image loading for logoUrl
      drawLogoPlaceholder(doc, margin, y);
    } catch (error) {
      console.warn('Could not load logo, using placeholder:', error);
      drawLogoPlaceholder(doc, margin, y);
    }
  } else {
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

  y += 1.05;

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

  drawText(doc, 'LOAD DETAILS', margin, y, { size: FONT_SIZES.header, bold: true });
  y += 0.12;

  const loadCols = ['LOAD #', 'DATE', 'ROUTE', 'COMPANY GROSS', 'DRIVER GROSS SHARE'];
  const loadW = [1.05, 1.05, 2.75, 1.15, 1.15];

  const headH = drawTableHeader(doc, margin, y, loadW, loadCols);
  y += headH;

  // Handle both new format (settlement.loads) and legacy format (settlement.loadIds)
  let settlementLoads = settlement.loads || [];

  // Fallback: if loads array is empty but loadIds exists, build loads array from loadIds
  if (settlementLoads.length === 0 && settlement.loadIds && settlement.loadIds.length > 0) {
    settlementLoads = settlement.loadIds.map(loadId => {
      const load = loads.find(l => l.id === loadId);
      return {
        loadId,
        basePay: (load as any)?.driverBasePay || 0,
        detention: (load as any)?.driverDetentionPay || 0,
        tonu: (load as any)?.tonuFee || 0,
        layover: (load as any)?.driverLayoverPay || 0,
        dispatchFee: (load as any)?.dispatcherCommissionAmount || 0
      };
    });
  }

  let totalLoadAmount = 0;
  let totalGrossPay = 0;

  settlementLoads.forEach((li, idx) => {
    const load = loads.find((l) => l.id === li.loadId);
    if (!load) return;

    const loadAmount = load.rate || load.grandTotal || 0;
    // Calculate driver pay: use basePay from settlement, then driverBasePay from load, then calculate dynamically
    let grossPay = li.basePay || (load as any).driverBasePay || 0;
    if (grossPay === 0 && driver) {
      grossPay = calculateDriverPay(load, driver);
    }
    totalLoadAmount += loadAmount;
    totalGrossPay += grossPay;

    const origin = `${load.originCity || ''}${load.originState ? ', ' + load.originState : ''}`.trim();
    const dest = `${load.destCity || ''}${load.destState ? ', ' + load.destState : ''}`.trim();
    // Fix font rendering: Use simple dash instead of arrow to avoid encoding issues
    const route = origin && dest ? `${origin} - ${dest}` : origin || dest || 'N/A';

    y = ensurePageSpace(doc, y, 0.25, margin);

    drawTableRow(
      doc,
      margin,
      y,
      loadW,
      [
        load.loadNumber || 'N/A',
        load.deliveryDate ? formatDate(load.deliveryDate) : load.pickupDate ? formatDate(load.pickupDate) : 'N/A',
        route,
        formatCurrency(loadAmount),
        formatCurrency(grossPay),
      ],
      { altFill: idx % 2 === 0, rightCols: [3, 4] }
    );
    y += 0.16;
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

  /** ====== DRIVER PAY FORMULA BOX ====== */
  // Calculate and display driver pay formula AFTER totals are calculated
  y = ensurePageSpace(doc, y, 0.6, margin);
  
  let driverPayFormula = '';
  if (driver.payment) {
    if (driver.payment.type === 'percentage' && driver.payment.percentage !== undefined) {
      const pct = (driver.payment.percentage * 100).toFixed(1);
      driverPayFormula = `Company Gross: ${formatCurrency(totalLoadAmount)} | Driver Percentage: ${pct}% | Driver Gross Share: ${formatCurrency(totalGrossPay)}`;
    } else if (driver.payment.type === 'per_mile' && driver.payment.perMileRate !== undefined) {
      const totalMiles = settlementLoads.reduce((sum, sl) => {
        const load = loads.find(l => l.id === sl.loadId);
        return sum + (load?.miles || 0);
      }, 0);
      driverPayFormula = `Total Miles: ${totalMiles.toLocaleString()} | Rate per Mile: ${formatCurrency(driver.payment.perMileRate)} | Driver Gross Share: ${formatCurrency(totalGrossPay)}`;
    } else if (driver.payment.type === 'flat_rate' && driver.payment.flatRate !== undefined) {
      driverPayFormula = `Flat Rate per Load: ${formatCurrency(driver.payment.flatRate)} | Number of Loads: ${settlementLoads.length} | Driver Gross Share: ${formatCurrency(totalGrossPay)}`;
    }
  }
  
  // If no formula, show basic calculation
  if (!driverPayFormula && totalLoadAmount > 0 && totalGrossPay > 0) {
    const impliedPct = ((totalGrossPay / totalLoadAmount) * 100).toFixed(1);
    driverPayFormula = `Company Gross: ${formatCurrency(totalLoadAmount)} | Driver Gross Share: ${formatCurrency(totalGrossPay)} (${impliedPct}%)`;
  }
  
  if (driverPayFormula) {
    const formulaBoxH = 0.40;
    drawBox(doc, { x: margin, y, w: contentW, h: formulaBoxH }, COLORS.blueSoft);
    drawText(doc, 'DRIVER PAY CALCULATION', margin + contentW / 2, y + 0.12, {
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

  /** ====== SUMMARY BOXES ====== */
  const grossPay = adjustedGrossPay + totalOtherEarnings;
  const totalDeductions = settlement.totalDeductions || 0;
  const netPay = grossPay - totalDeductions;

  y = ensurePageSpace(doc, y, 0.9, margin);

  // Totals band with corrected terminology
  const bandH = drawTotalsBand(doc, margin, y, contentW, [
    { label: 'TOTAL COMPANY GROSS', value: formatCurrency(totalLoadAmount) },
    { label: 'DRIVER GROSS SHARE', value: formatCurrency(totalGrossPay) },
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
  const ytd = calculateYTD(allSettlements, settlement.driverId || '', currentYear);

  const ytdCols = ['YTD DRIVER GROSS', 'YTD DEDUCTIONS', 'YTD NET SETTLEMENTS PAID'];
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

// Generate Dispatcher Settlement PDF (similar improvements)
// NOTE: Temporarily using driver function - dispatcher function needs to be updated with new constants
export const generateDispatcherSettlementPDF = (
  settlement: Settlement,
  dispatcher: Employee,
  loads: Load[],
  allSettlements: Settlement[],
  companyProfile: CompanyProfile
): void => {
  // For now, use driver function with dispatcher data
  // TODO: Create dedicated dispatcher template using new drawing primitives
  generateDriverSettlementPDF(settlement, dispatcher, loads, allSettlements, companyProfile);
};

export const generateSettlementPDF = (
  settlement: Settlement,
  payee: Employee,
  loads: Load[],
  allSettlements: Settlement[],
  companyProfile: CompanyProfile
): void => {
  if ((payee as any).employeeType === 'dispatcher') {
    // TODO: Apply same template helpers to dispatcher output (same look, different table columns)
    // For now you can keep your current dispatcher version, or ask me and I'll convert it fully.
    // Temporarily route to driver function to avoid errors
    generateDriverSettlementPDF(settlement, payee, loads, allSettlements, companyProfile);
  } else {
    generateDriverSettlementPDF(settlement, payee, loads, allSettlements, companyProfile);
  }
};
