import { jsPDF } from 'jspdf';
import { Settlement, Employee, Load, FactoringCompany } from '../types';
import { CompanySettings } from '../context/CompanyContext';

// Helper function to get company info (will be passed from context)
const getCompanyInfo = (company: CompanySettings) => ({
  name: company.name.toUpperCase(),
  address: company.address?.toUpperCase() || '',
  city: company.city?.toUpperCase() || '',
  state: company.state?.toUpperCase() || '',
  zip: company.zip || '',
  country: company.country || 'United States',
  website: company.website || '',
  email: company.email || '',
  phone: company.phone || '',
  fax: '',
  dotNumber: company.dotNumber || ''
});

// Typography constants (very small fonts as requested)
const FONT_SIZES = {
  title: 12,
  sectionHeader: 7,
  tableHeader: 6,
  tableData: 6,
  label: 6,
  amount: 6,
  total: 7,
  footer: 6
};

// Colors (RGB arrays for jsPDF)
const COLORS = {
  headerBar: [30, 144, 255], // #1E90FF (Blue)
  tableHeader: [30, 144, 255], // #1E90FF (Blue)
  tableRowAlt: [245, 245, 245], // #F5F5F5
  totalsRow: [232, 244, 252], // #E8F4FC
  text: [0, 0, 0], // Black
  negative: [255, 0, 0], // Red
  white: [255, 255, 255]
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  if (amount < 0) {
    return `($${Math.abs(amount).toFixed(2)})`;
  }
  return `$${amount.toFixed(2)}`;
};

// Helper function to format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper function to format date for header
const formatDateHeader = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

// Calculate YTD totals
const calculateYTD = (
  settlements: Settlement[],
  payeeId: string,
  currentYear: number
): { earnings: number; deductions: number; netPay: number } => {
  const yearSettlements = settlements.filter(s => {
    if (s.driverId !== payeeId && s.dispatcherId !== payeeId) return false;
    const settlementYear = new Date(s.date || s.createdAt || '').getFullYear();
    return settlementYear === currentYear;
  });

  const earnings = yearSettlements.reduce((sum, s) => sum + (s.grossPay || 0), 0);
  const deductions = yearSettlements.reduce((sum, s) => sum + (s.totalDeductions || 0), 0);
  const netPay = earnings - deductions;

  return { earnings, deductions, netPay };
};

// Generate Driver Settlement PDF
export const generateDriverSettlementPDF = (
  settlement: Settlement,
  driver: Employee,
  loads: Load[],
  allSettlements: Settlement[],
  company: CompanySettings
): void => {
  const COMPANY_INFO = getCompanyInfo(company);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter'
  });

  // Set margins (0.5" all sides)
  const margin = 0.5;
  let yPos = margin;
  const pageWidth = 8.5;
  const pageHeight = 11;
  const contentWidth = pageWidth - (margin * 2);

  // Set font to Arial
  doc.setFont('helvetica');

  // ============================================
  // SECTION 1: HEADER
  // ============================================
  
  // Title (right-aligned)
  doc.setFontSize(FONT_SIZES.title);
  doc.setFont('helvetica', 'bold');
  doc.text('SETTLEMENT PAY', pageWidth - margin, yPos, { align: 'right' });
  yPos += 0.3;

  // Company logo placeholder (left side)
  // TODO: Add actual logo image if available
  doc.setFontSize(FONT_SIZES.label);
  doc.setFont('helvetica', 'normal');
  doc.text('[COMPANY LOGO]', margin, yPos);
  
  // Company info (right side)
  const companyX = pageWidth - margin;
  doc.text(COMPANY_INFO.name, companyX, yPos, { align: 'right' });
  yPos += 0.15;
  doc.text(COMPANY_INFO.address, companyX, yPos, { align: 'right' });
  yPos += 0.15;
  doc.text(`${COMPANY_INFO.city}, ${COMPANY_INFO.state} ${COMPANY_INFO.zip}`, companyX, yPos, { align: 'right' });
  yPos += 0.15;
  doc.text(COMPANY_INFO.country, companyX, yPos, { align: 'right' });
  yPos += 0.2;
  doc.text(`Website: ${COMPANY_INFO.website}`, companyX, yPos, { align: 'right' });
  yPos += 0.15;
  doc.text(`Email: ${COMPANY_INFO.email}`, companyX, yPos, { align: 'right' });
  yPos += 0.15;
  doc.text(`Phone: ${COMPANY_INFO.phone}`, companyX, yPos, { align: 'right' });
  yPos += 0.15;
  doc.text(`Fax: ${COMPANY_INFO.fax}`, companyX, yPos, { align: 'right' });
  yPos += 0.3;

  // ============================================
  // SECTION 2: PAYMENT RECIPIENT
  // ============================================
  
  // Blue header bar
  doc.setFillColor(COLORS.headerBar[0], COLORS.headerBar[1], COLORS.headerBar[2]);
  doc.rect(margin, yPos, contentWidth, 0.2, 'F');
  
  doc.setFontSize(FONT_SIZES.sectionHeader);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.text('PAYMENT FOR', margin + 0.05, yPos + 0.13);
  yPos += 0.25;

  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFontSize(FONT_SIZES.tableData);
  doc.setFont('helvetica', 'normal');
  
  const unitNumber = (driver as any).unitNumber || '';
  const unitText = unitNumber ? `, Unit No#${unitNumber}` : '';
  doc.text(`${driver.firstName} ${driver.lastName}${unitText}`, margin, yPos);
  yPos += 0.15;
  
  const driverAddress = (driver as any).address || '';
  const driverCity = (driver as any).city || '';
  const driverState = (driver as any).state || '';
  const driverZip = (driver as any).zipCode || '';
  const fullAddress = [driverAddress, driverCity, driverState, driverZip].filter(Boolean).join(', ');
  if (fullAddress) {
    doc.text(fullAddress, margin, yPos);
    yPos += 0.15;
  }

  // Invoice info (right side)
  const invoiceX = pageWidth - margin;
  doc.text(`Invoice No:    ${settlement.settlementNumber || 'N/A'}`, invoiceX, yPos - 0.15, { align: 'right' });
  doc.text(`From Date:     ${formatDateHeader(settlement.periodStart || '')}`, invoiceX, yPos, { align: 'right' });
  doc.text(`To Date:       ${formatDateHeader(settlement.periodEnd || '')}`, invoiceX, yPos + 0.15, { align: 'right' });
  yPos += 0.3;

  // ============================================
  // SECTION 3: LOAD DETAILS TABLE
  // ============================================
  
  // Table header - New design: LOAD #, DATE, ROUTE, LOAD AMOUNT, GROSS PAY
  doc.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  const tableHeaderY = yPos;
  const colWidths = [1.2, 1.0, 2.5, 1.3, 1.3];
  const colHeaders = ['LOAD #', 'DATE', 'ROUTE', 'LOAD AMOUNT', 'GROSS PAY'];
  
  let xPos = margin;
  doc.setFontSize(FONT_SIZES.tableHeader);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  
  colHeaders.forEach((header, idx) => {
    doc.rect(xPos, tableHeaderY, colWidths[idx], 0.15, 'F');
    doc.text(header, xPos + colWidths[idx] / 2, tableHeaderY + 0.1, { align: 'center' });
    xPos += colWidths[idx];
  });
  
  yPos += 0.15;
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFontSize(FONT_SIZES.tableData);
  doc.setFont('helvetica', 'normal');

  // Table rows
  const settlementLoads = settlement.loads || [];
  let totalLoadAmount = 0;
  let totalGrossPay = 0;
  
  settlementLoads.forEach((loadItem, idx) => {
    const load = loads.find(l => l.id === loadItem.loadId);
    if (!load) return;

    // Alternate row color
    if (idx % 2 === 0) {
      doc.setFillColor(COLORS.tableRowAlt[0], COLORS.tableRowAlt[1], COLORS.tableRowAlt[2]);
      xPos = margin;
      colWidths.forEach(w => {
        doc.rect(xPos, yPos, w, 0.12, 'F');
        xPos += w;
      });
    }

    const loadAmount = load.rate || load.grandTotal || 0;
    const grossPay = loadItem.basePay || load.driverBasePay || 0;
    totalLoadAmount += loadAmount;
    totalGrossPay += grossPay;

    xPos = margin;
    const rowData = [
      load.loadNumber || 'N/A',
      load.deliveryDate ? formatDate(load.deliveryDate) : (load.pickupDate ? formatDate(load.pickupDate) : 'N/A'),
      `${load.originCity || ''}, ${load.originState || ''} → ${load.destCity || ''}, ${load.destState || ''}`,
      formatCurrency(loadAmount),
      formatCurrency(grossPay)
    ];

    rowData.forEach((text, colIdx) => {
      const align = colIdx <= 2 ? 'left' : 'right';
      doc.text(text, xPos + (align === 'right' ? colWidths[colIdx] - 0.03 : 0.03), yPos + 0.08, { align });
      xPos += colWidths[colIdx];
    });

    yPos += 0.12;
    
    // Check if we need a new page
    if (yPos > pageHeight - margin - 1) {
      doc.addPage();
      yPos = margin;
    }
  });
  
  // Total row
  yPos += 0.05;
  doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
  xPos = margin;
  colWidths.forEach(w => {
    doc.rect(xPos, yPos, w, 0.12, 'F');
    xPos += w;
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZES.total);
  xPos = margin;
  doc.text('TOTAL', xPos + 0.03, yPos + 0.08, { align: 'left' });
  xPos += colWidths[0] + colWidths[1] + colWidths[2];
  doc.text(formatCurrency(totalLoadAmount), xPos + colWidths[3] - 0.03, yPos + 0.08, { align: 'right' });
  xPos += colWidths[3];
  doc.text(formatCurrency(totalGrossPay), xPos + colWidths[4] - 0.03, yPos + 0.08, { align: 'right' });
  yPos += 0.15;

  // ============================================
  // SECTION 4: EARNINGS TABLE
  // ============================================
  
  yPos += 0.1;
  doc.setFontSize(FONT_SIZES.sectionHeader);
  doc.setFont('helvetica', 'bold');
  doc.text('EARNINGS', margin, yPos);
  yPos += 0.12;
  
  // Earnings table header
  doc.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  const earningsHeaderY = yPos;
  const earningsColWidths = [2.0, 1.5];
  const earningsHeaders = ['DESCRIPTION', 'AMOUNT'];
  
  xPos = margin;
  earningsHeaders.forEach((header, idx) => {
    doc.rect(xPos, earningsHeaderY, earningsColWidths[idx], 0.12, 'F');
    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.setFontSize(FONT_SIZES.tableHeader);
    doc.text(header, xPos + earningsColWidths[idx] / 2, earningsHeaderY + 0.08, { align: 'center' });
    xPos += earningsColWidths[idx];
  });
  
  yPos += 0.12;
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFontSize(FONT_SIZES.tableData);
  doc.setFont('helvetica', 'normal');
  
  // Calculate earnings totals
  const totalDetention = settlementLoads.reduce((sum, l) => sum + (l.detention || 0), 0);
  const totalTonu = settlementLoads.reduce((sum, l) => sum + (l.tonu || 0), 0);
  const totalLayover = settlementLoads.reduce((sum, l) => sum + (l.layover || 0), 0);
  const totalEarnings = totalDetention + totalTonu + totalLayover;
  
  // Earnings rows
  const earningsRows = [
    { desc: 'DETENTION FEES', amount: totalDetention },
    { desc: 'TONU FEE', amount: totalTonu },
    { desc: 'LAYOVER FEE', amount: totalLayover }
  ];
  
  earningsRows.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(COLORS.tableRowAlt[0], COLORS.tableRowAlt[1], COLORS.tableRowAlt[2]);
      xPos = margin;
      earningsColWidths.forEach(w => {
        doc.rect(xPos, yPos, w, 0.1, 'F');
        xPos += w;
      });
    }
    
    xPos = margin;
    doc.text(row.desc, xPos + 0.03, yPos + 0.07, { align: 'left' });
    xPos += earningsColWidths[0];
    doc.text(formatCurrency(row.amount), xPos + earningsColWidths[1] - 0.03, yPos + 0.07, { align: 'right' });
    yPos += 0.1;
  });
  
  // Total earnings row
  doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
  xPos = margin;
  earningsColWidths.forEach(w => {
    doc.rect(xPos, yPos, w, 0.12, 'F');
    xPos += w;
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZES.total);
  doc.text('TOTAL EARNINGS', margin + 0.03, yPos + 0.08, { align: 'left' });
  doc.text(formatCurrency(totalEarnings), margin + earningsColWidths[0] + earningsColWidths[1] - 0.03, yPos + 0.08, { align: 'right' });
  yPos += 0.15;
  
  // Add earnings to gross pay
  const adjustedGrossPay = totalGrossPay + totalEarnings;

  // ============================================
  // SECTION 5: OTHER EARNINGS
  // ============================================
  
  const otherEarnings = settlement.otherEarnings || [];
  if (otherEarnings.length > 0 || true) { // Always show section
    yPos += 0.1;
    doc.setFontSize(FONT_SIZES.sectionHeader);
    doc.setFont('helvetica', 'bold');
    doc.text('OTHER EARNINGS', margin, yPos);
    yPos += 0.15;

    // Table
    doc.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
    doc.rect(margin, yPos, contentWidth / 2, 0.2, 'F');
    doc.rect(margin + contentWidth / 2, yPos, contentWidth / 2, 0.2, 'F');
    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.setFontSize(FONT_SIZES.tableHeader);
    doc.text('OTHER EARNING AMT', margin + contentWidth / 4, yPos + 0.13, { align: 'center' });
    doc.text('OTHER EARNING TYPE / NAME', margin + contentWidth * 3 / 4, yPos + 0.13, { align: 'center' });
    yPos += 0.2;
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.setFontSize(FONT_SIZES.tableData);

    const totalOtherEarnings = otherEarnings.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    if (otherEarnings.length === 0) {
      doc.text('$0.00', margin + contentWidth / 4, yPos + 0.11, { align: 'center' });
      doc.text('', margin + contentWidth * 3 / 4, yPos + 0.11, { align: 'center' });
      yPos += 0.16;
    } else {
      otherEarnings.forEach((earning) => {
        doc.text(formatCurrency(earning.amount || 0), margin + contentWidth / 4, yPos + 0.11, { align: 'center' });
        doc.text(earning.description || earning.type || 'Other', margin + contentWidth * 3 / 4, yPos + 0.11, { align: 'center' });
        yPos += 0.16;
      });
    }

    // Total
    doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
    doc.rect(margin, yPos, contentWidth, 0.2, 'F');
    doc.setFontSize(FONT_SIZES.total);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL OTHER EARNING AMT', margin + contentWidth / 2, yPos + 0.13, { align: 'center' });
    doc.text(formatCurrency(totalOtherEarnings), margin + contentWidth / 2, yPos + 0.25, { align: 'center' });
    yPos += 0.3;
  }

  // ============================================
  // SECTION 6: DEDUCTIONS TABLE
  // ============================================
  
  yPos += 0.1;
  doc.setFontSize(FONT_SIZES.sectionHeader);
  doc.setFont('helvetica', 'bold');
  doc.text('DEDUCTIONS', margin, yPos);
  yPos += 0.15;

  const isOwnerOperator = driver.employeeType === 'owner_operator';
  const deductions = settlement.deductions || {};
  
  if (isOwnerOperator) {
    // Owner Operator deductions (15 columns)
    const ooDeductionCols = ['INSUR.', 'IFTA', 'CASH', 'FUEL', 'TRAIL.', 'REP.', 'PARK.', '2290', 'ELD', 'TOLL', 'IRP', 'UCR', 'ESCROW', 'OCC.AC', 'OTHER'];
    const ooDeductionWidth = contentWidth / 15;
    
    doc.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
    xPos = margin;
    ooDeductionCols.forEach((header) => {
      doc.rect(xPos, yPos, ooDeductionWidth, 0.2, 'F');
      doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
      doc.setFontSize(FONT_SIZES.tableHeader);
      doc.text(header, xPos + ooDeductionWidth / 2, yPos + 0.13, { align: 'center' });
      xPos += ooDeductionWidth;
    });
    yPos += 0.2;
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.setFontSize(FONT_SIZES.tableData);

    const ooValues = [
      formatCurrency(deductions.insurance || 0),
      formatCurrency(deductions.ifta || 0),
      formatCurrency(deductions.cashAdvance || 0),
      formatCurrency(deductions.fuel || 0),
      formatCurrency(deductions.trailer || 0),
      formatCurrency(deductions.repairs || 0),
      formatCurrency(deductions.parking || 0),
      formatCurrency(deductions.form2290 || 0),
      formatCurrency(deductions.eld || 0),
      formatCurrency(deductions.tolls || 0),
      formatCurrency(deductions.irp || 0),
      formatCurrency(deductions.ucr || 0),
      formatCurrency(deductions.escrow || 0),
      formatCurrency(deductions.occAcc || 0),
      formatCurrency(deductions.other || 0)
    ];

    xPos = margin;
    ooValues.forEach((value) => {
      doc.text(value, xPos + ooDeductionWidth / 2, yPos + 0.11, { align: 'center' });
      xPos += ooDeductionWidth;
    });
  } else {
    // Company Driver deductions (5 columns)
    const cdDeductionCols = ['CASH', 'ESCROW', 'OCC.ACC', 'UNIFORM', 'OTHER'];
    const cdDeductionWidth = contentWidth / 5;
    
    doc.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
    xPos = margin;
    cdDeductionCols.forEach((header) => {
      doc.rect(xPos, yPos, cdDeductionWidth, 0.2, 'F');
      doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
      doc.setFontSize(FONT_SIZES.tableHeader);
      doc.text(header, xPos + cdDeductionWidth / 2, yPos + 0.13, { align: 'center' });
      xPos += cdDeductionWidth;
    });
    yPos += 0.2;
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.setFontSize(FONT_SIZES.tableData);

    const cdValues = [
      formatCurrency(deductions.cashAdvance || 0),
      formatCurrency(deductions.escrow || 0),
      formatCurrency(deductions.occAcc || 0),
      formatCurrency(deductions.uniform || 0),
      formatCurrency(deductions.other || 0)
    ];

    xPos = margin;
    cdValues.forEach((value) => {
      doc.text(value, xPos + cdDeductionWidth / 2, yPos + 0.11, { align: 'center' });
      xPos += cdDeductionWidth;
    });
  }

  yPos += 0.3;

  // ============================================
  // SECTION 7: TOTALS
  // ============================================
  
  // Use adjustedGrossPay (base pay + earnings) instead of totalAGI
  const grossPay = adjustedGrossPay + (settlement.otherEarnings || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalDeductions = settlement.totalDeductions || 0;
  const netPay = grossPay - totalDeductions;

  doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
  doc.rect(margin, yPos, contentWidth, 0.25, 'F');
  doc.setFontSize(FONT_SIZES.total);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DEDUCTIONS', margin + contentWidth / 2, yPos + 0.12, { align: 'center' });
  doc.text(formatCurrency(totalDeductions), margin + contentWidth / 2, yPos + 0.22, { align: 'center' });
  yPos += 0.3;

  doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
  doc.rect(margin, yPos, contentWidth, 0.25, 'F');
  doc.text('NET AMOUNT PAID / DUE', margin + contentWidth / 2, yPos + 0.12, { align: 'center' });
  doc.text(formatCurrency(netPay), margin + contentWidth / 2, yPos + 0.22, { align: 'center' });
  yPos += 0.4;

  // ============================================
  // SECTION 8: YEAR-TO-DATE
  // ============================================
  
  const currentYear = new Date().getFullYear();
  const ytd = calculateYTD(allSettlements, settlement.driverId || '', currentYear);

  const ytdWidth = contentWidth / 3;
  doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
  doc.rect(margin, yPos, ytdWidth, 0.25, 'F');
  doc.rect(margin + ytdWidth, yPos, ytdWidth, 0.25, 'F');
  doc.rect(margin + ytdWidth * 2, yPos, ytdWidth, 0.25, 'F');
  
  doc.setFontSize(FONT_SIZES.total);
  doc.setFont('helvetica', 'bold');
  doc.text('TOT. YEAR TO DATE', margin + ytdWidth / 2, yPos + 0.08, { align: 'center' });
  doc.text('TOT. YEAR TO DATE', margin + ytdWidth * 1.5, yPos + 0.08, { align: 'center' });
  doc.text('TOT. YEAR TO DATE', margin + ytdWidth * 2.5, yPos + 0.08, { align: 'center' });
  
  doc.text('EARNING', margin + ytdWidth / 2, yPos + 0.15, { align: 'center' });
  doc.text('DEDUCTIONS', margin + ytdWidth * 1.5, yPos + 0.15, { align: 'center' });
  doc.text('NET PAY', margin + ytdWidth * 2.5, yPos + 0.15, { align: 'center' });
  
  doc.text(formatCurrency(ytd.earnings), margin + ytdWidth / 2, yPos + 0.22, { align: 'center' });
  doc.text(formatCurrency(ytd.deductions), margin + ytdWidth * 1.5, yPos + 0.22, { align: 'center' });
  doc.text(formatCurrency(ytd.netPay), margin + ytdWidth * 2.5, yPos + 0.22, { align: 'center' });
  yPos += 0.4;

  // ============================================
  // SECTION 9: FOOTER
  // ============================================
  
  doc.setFontSize(FONT_SIZES.footer);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank You For Your Business', margin + contentWidth / 2, yPos, { align: 'center' });
  yPos += 0.2;
  doc.text('* Negative Values In Net Amount Paid Will Be Used As Cash Advance In Next Coming Payment! * A Negative Amount Will Appear In ( ).', margin + contentWidth / 2, yPos, { align: 'center', maxWidth: contentWidth });
  yPos += 0.15;
  doc.text('* All payments are made to 1099 Independent Contractors. No tax withholdings are applied.', margin + contentWidth / 2, yPos, { align: 'center', maxWidth: contentWidth });
  yPos += 0.2;
  doc.text('PAGE 1 OF 1', pageWidth - margin, pageHeight - margin, { align: 'right' });

  // Save PDF
  const filename = `Settlement-${settlement.settlementNumber || settlement.id}-${driver.firstName}-${driver.lastName}.pdf`;
  doc.save(filename);
};

// Generate Dispatcher Settlement PDF
export const generateDispatcherSettlementPDF = (
  settlement: Settlement,
  dispatcher: Employee,
  loads: Load[],
  allSettlements: Settlement[],
  company: CompanySettings
): void => {
  const COMPANY_INFO = getCompanyInfo(company);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter'
  });

  const margin = 0.5;
  let yPos = margin;
  const pageWidth = 8.5;
  const pageHeight = 11;
  const contentWidth = pageWidth - (margin * 2);

  doc.setFont('helvetica');

  // Header (same as driver)
  doc.setFontSize(FONT_SIZES.title);
  doc.setFont('helvetica', 'bold');
  doc.text('SETTLEMENT PAY', pageWidth - margin, yPos, { align: 'right' });
  doc.text('(DISPATCHER)', pageWidth - margin, yPos + 0.15, { align: 'right' });
  yPos += 0.3;

  doc.setFontSize(FONT_SIZES.label);
  doc.setFont('helvetica', 'normal');
  doc.text('[COMPANY LOGO]', margin, yPos);
  
  const companyX = pageWidth - margin;
  doc.text(COMPANY_INFO.name, companyX, yPos, { align: 'right' });
  yPos += 0.15;
  doc.text(COMPANY_INFO.address, companyX, yPos, { align: 'right' });
  yPos += 0.15;
  doc.text(`${COMPANY_INFO.city}, ${COMPANY_INFO.state} ${COMPANY_INFO.zip}`, companyX, yPos, { align: 'right' });
  yPos += 0.3;

  // Payment For
  doc.setFillColor(COLORS.headerBar[0], COLORS.headerBar[1], COLORS.headerBar[2]);
  doc.rect(margin, yPos, contentWidth, 0.2, 'F');
  doc.setFontSize(FONT_SIZES.sectionHeader);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.text('PAYMENT FOR', margin + 0.05, yPos + 0.13);
  yPos += 0.25;

  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFontSize(FONT_SIZES.tableData);
  doc.setFont('helvetica', 'normal');
  doc.text(`${dispatcher.firstName} ${dispatcher.lastName}`, margin, yPos);
  yPos += 0.15;
  
  const dispatcherAddress = (dispatcher as any).address || '';
  if (dispatcherAddress) {
    doc.text(dispatcherAddress, margin, yPos);
    yPos += 0.15;
  }

  doc.text(`Invoice No: DSP-${settlement.settlementNumber || 'N/A'}`, companyX, yPos - 0.15, { align: 'right' });
  doc.text(`From Date:  ${formatDateHeader(settlement.periodStart || '')}`, companyX, yPos, { align: 'right' });
  doc.text(`To Date:    ${formatDateHeader(settlement.periodEnd || '')}`, companyX, yPos + 0.15, { align: 'right' });
  yPos += 0.3;

  // Loads Dispatched Table
  doc.setFontSize(FONT_SIZES.sectionHeader);
  doc.setFont('helvetica', 'bold');
  doc.text('LOADS DISPATCHED', margin, yPos);
  yPos += 0.15;

  const dispatchCols = ['LOAD NO#', 'DRIVER', 'LOAD RATE', 'COMM. TYPE', 'COMM. RATE', 'COMMISSION'];
  const dispatchWidths = [1.42, 1.42, 1.42, 1.42, 1.42, 1.42];

  doc.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  let xPos = margin;
  dispatchCols.forEach((header, idx) => {
    doc.rect(xPos, yPos, dispatchWidths[idx], 0.2, 'F');
    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.setFontSize(FONT_SIZES.tableHeader);
    doc.text(header, xPos + dispatchWidths[idx] / 2, yPos + 0.13, { align: 'center' });
    xPos += dispatchWidths[idx];
  });
  yPos += 0.2;
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFontSize(FONT_SIZES.tableData);

  const settlementLoads = settlement.loads || [];
  let totalCommission = 0;
  let totalLoadValue = 0;

  settlementLoads.forEach((loadItem, idx) => {
    const load = loads.find(l => l.id === loadItem.loadId);
    if (!load) return;

    if (idx % 2 === 0) {
      doc.setFillColor(COLORS.tableRowAlt[0], COLORS.tableRowAlt[1], COLORS.tableRowAlt[2]);
      xPos = margin;
      dispatchWidths.forEach(w => {
        doc.rect(xPos, yPos, w, 0.16, 'F');
        xPos += w;
      });
    }

    const commission = load.dispatcherCommissionAmount || 0;
    totalCommission += commission;
    totalLoadValue += load.grandTotal || load.rate || 0;

    const commType = load.dispatcherCommissionType === 'percentage' ? 'Percentage' : 
                     load.dispatcherCommissionType === 'flat_fee' ? 'Flat' : 
                     load.dispatcherCommissionType === 'per_mile' ? 'Per Mile' : 'N/A';
    const commRate = load.dispatcherCommissionType === 'percentage' ? `${load.dispatcherCommissionRate || 0}%` :
                     load.dispatcherCommissionType === 'flat_fee' ? formatCurrency(load.dispatcherCommissionRate || 0) :
                     load.dispatcherCommissionType === 'per_mile' ? `$${load.dispatcherCommissionRate || 0}/mi` : 'N/A';

    xPos = margin;
    const rowData = [
      load.loadNumber || 'N/A',
      load.driverName || 'N/A',
      formatCurrency(load.grandTotal || load.rate || 0),
      commType,
      commRate,
      formatCurrency(commission)
    ];

    rowData.forEach((text, colIdx) => {
      const align = colIdx === 0 || colIdx === 1 ? 'left' : 'center';
      doc.text(text, xPos + (align === 'center' ? dispatchWidths[colIdx] / 2 : 0.05), yPos + 0.11, { align });
      xPos += dispatchWidths[colIdx];
    });

    yPos += 0.16;
  });

  // Totals
  yPos += 0.1;
  doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
  const totalWidth = contentWidth / 3;
  doc.rect(margin, yPos, totalWidth, 0.2, 'F');
  doc.rect(margin + totalWidth, yPos, totalWidth, 0.2, 'F');
  doc.rect(margin + totalWidth * 2, yPos, totalWidth, 0.2, 'F');
  
  doc.setFontSize(FONT_SIZES.total);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL LOADS', margin + totalWidth / 2, yPos + 0.1, { align: 'center' });
  doc.text('TOTAL LOAD VALUE', margin + totalWidth * 1.5, yPos + 0.1, { align: 'center' });
  doc.text('TOTAL COMMISSION', margin + totalWidth * 2.5, yPos + 0.1, { align: 'center' });
  
  doc.text(settlementLoads.length.toString(), margin + totalWidth / 2, yPos + 0.18, { align: 'center' });
  doc.text(formatCurrency(totalLoadValue), margin + totalWidth * 1.5, yPos + 0.18, { align: 'center' });
  doc.text(formatCurrency(totalCommission), margin + totalWidth * 2.5, yPos + 0.18, { align: 'center' });
  yPos += 0.3;

  // Other Earnings (same as driver)
  const otherEarnings = settlement.otherEarnings || [];
  const totalOtherEarnings = otherEarnings.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  doc.setFontSize(FONT_SIZES.sectionHeader);
  doc.setFont('helvetica', 'bold');
  doc.text('OTHER EARNINGS', margin, yPos);
  yPos += 0.15;

  doc.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  doc.rect(margin, yPos, contentWidth / 2, 0.2, 'F');
  doc.rect(margin + contentWidth / 2, yPos, contentWidth / 2, 0.2, 'F');
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFontSize(FONT_SIZES.tableHeader);
  doc.text('OTHER EARNING AMT', margin + contentWidth / 4, yPos + 0.13, { align: 'center' });
  doc.text('OTHER EARNING TYPE / NAME', margin + contentWidth * 3 / 4, yPos + 0.13, { align: 'center' });
  yPos += 0.2;
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFontSize(FONT_SIZES.tableData);

  if (otherEarnings.length === 0) {
    doc.text('$0.00', margin + contentWidth / 4, yPos + 0.11, { align: 'center' });
    yPos += 0.16;
  } else {
    otherEarnings.forEach((earning) => {
      doc.text(formatCurrency(earning.amount || 0), margin + contentWidth / 4, yPos + 0.11, { align: 'center' });
      doc.text(earning.description || earning.type || 'Other', margin + contentWidth * 3 / 4, yPos + 0.11, { align: 'center' });
      yPos += 0.16;
    });
  }

  doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
  doc.rect(margin, yPos, contentWidth, 0.2, 'F');
  doc.setFontSize(FONT_SIZES.total);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL OTHER EARNING AMT:', margin + contentWidth / 2, yPos + 0.13, { align: 'center' });
  doc.text(formatCurrency(totalOtherEarnings), margin + contentWidth / 2, yPos + 0.25, { align: 'center' });
  yPos += 0.3;

  // Deductions (simpler for dispatchers)
  doc.setFontSize(FONT_SIZES.sectionHeader);
  doc.setFont('helvetica', 'bold');
  doc.text('DEDUCTIONS', margin, yPos);
  yPos += 0.15;

  const deductionCols = ['CASH ADVANCE', 'ESCROW', 'OCC. ACC', 'OTHER'];
  const deductionWidth = contentWidth / 4;
  const deductions = settlement.deductions || {};

  doc.setFillColor(COLORS.tableHeader[0], COLORS.tableHeader[1], COLORS.tableHeader[2]);
  xPos = margin;
  deductionCols.forEach((header) => {
    doc.rect(xPos, yPos, deductionWidth, 0.2, 'F');
    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.setFontSize(FONT_SIZES.tableHeader);
    doc.text(header, xPos + deductionWidth / 2, yPos + 0.13, { align: 'center' });
    xPos += deductionWidth;
  });
  yPos += 0.2;
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFontSize(FONT_SIZES.tableData);

  const dispDeductionValues = [
    formatCurrency(deductions.cashAdvance || 0),
    formatCurrency(deductions.escrow || 0),
    formatCurrency(deductions.occAcc || 0),
    formatCurrency(deductions.other || 0)
  ];

  xPos = margin;
  dispDeductionValues.forEach((value) => {
    doc.text(value, xPos + deductionWidth / 2, yPos + 0.11, { align: 'center' });
    xPos += deductionWidth;
  });
  yPos += 0.3;

  // Totals
  const grossPay = totalCommission + totalOtherEarnings;
  const totalDeductions = settlement.totalDeductions || 0;
  const netPay = grossPay - totalDeductions;

  doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
  doc.rect(margin, yPos, contentWidth, 0.25, 'F');
  doc.setFontSize(FONT_SIZES.total);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DEDUCTIONS:', margin + contentWidth / 2, yPos + 0.12, { align: 'center' });
  doc.text(formatCurrency(totalDeductions), margin + contentWidth / 2, yPos + 0.22, { align: 'center' });
  yPos += 0.3;

  doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
  doc.rect(margin, yPos, contentWidth, 0.25, 'F');
  doc.text('NET AMOUNT PAID / DUE:', margin + contentWidth / 2, yPos + 0.12, { align: 'center' });
  doc.text(formatCurrency(netPay), margin + contentWidth / 2, yPos + 0.22, { align: 'center' });
  yPos += 0.4;

  // YTD
  const currentYear = new Date().getFullYear();
  const ytd = calculateYTD(allSettlements, settlement.dispatcherId || '', currentYear);

  const ytdWidth = contentWidth / 3;
  doc.setFillColor(COLORS.totalsRow[0], COLORS.totalsRow[1], COLORS.totalsRow[2]);
  doc.rect(margin, yPos, ytdWidth, 0.25, 'F');
  doc.rect(margin + ytdWidth, yPos, ytdWidth, 0.25, 'F');
  doc.rect(margin + ytdWidth * 2, yPos, ytdWidth, 0.25, 'F');
  
  doc.setFontSize(FONT_SIZES.total);
  doc.setFont('helvetica', 'bold');
  doc.text('YTD EARNINGS', margin + ytdWidth / 2, yPos + 0.12, { align: 'center' });
  doc.text('YTD DEDUCTIONS', margin + ytdWidth * 1.5, yPos + 0.12, { align: 'center' });
  doc.text('YTD NET PAY', margin + ytdWidth * 2.5, yPos + 0.12, { align: 'center' });
  
  doc.text(formatCurrency(ytd.earnings), margin + ytdWidth / 2, yPos + 0.22, { align: 'center' });
  doc.text(formatCurrency(ytd.deductions), margin + ytdWidth * 1.5, yPos + 0.22, { align: 'center' });
  doc.text(formatCurrency(ytd.netPay), margin + ytdWidth * 2.5, yPos + 0.22, { align: 'center' });
  yPos += 0.4;

  // Footer
  doc.setFontSize(FONT_SIZES.footer);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank You For Your Business', margin + contentWidth / 2, yPos, { align: 'center' });
  yPos += 0.2;
  doc.text('* All payments are made to 1099 Independent Contractors.', margin + contentWidth / 2, yPos, { align: 'center', maxWidth: contentWidth });
  yPos += 0.2;
  doc.text('PAGE 1 OF 1', pageWidth - margin, pageHeight - margin, { align: 'right' });

  const filename = `Settlement-Dispatcher-${settlement.settlementNumber || settlement.id}-${dispatcher.firstName}-${dispatcher.lastName}.pdf`;
  doc.save(filename);
};

// Main export function that determines which PDF to generate
export const generateSettlementPDF = (
  settlement: Settlement,
  payee: Employee,
  loads: Load[],
  allSettlements: Settlement[],
  company: CompanySettings
): void => {
  if (payee.employeeType === 'dispatcher') {
    generateDispatcherSettlementPDF(settlement, payee, loads, allSettlements, company);
  } else {
    generateDriverSettlementPDF(settlement, payee, loads, allSettlements, company);
  }
};

