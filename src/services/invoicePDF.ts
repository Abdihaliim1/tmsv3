import { jsPDF } from 'jspdf';
import { Invoice, Load, CompanyProfile, FactoringCompany } from '../types';
import { formatDateOnly } from '../utils/dateOnly';
import { drawPdfLogo, loadLogoForPdf } from '../utils/pdfLogo';

/** =========================
 *  Helpers
 *  ========================= */

const getCompanyInfo = (profile?: CompanyProfile | null) => ({
  name: (profile?.companyName || 'TMS Pro').toUpperCase(),
  legalName: (profile?.legalName || '').toUpperCase(),
  address: (profile?.address1 || '').toUpperCase(),
  address2: (profile?.address2 || '').toUpperCase(),
  city: (profile?.city || '').toUpperCase(),
  state: (profile?.state || '').toUpperCase(),
  zip: profile?.zip || '',
  website: profile?.website || '',
  email: profile?.email || '',
  phone: profile?.phone || '',
  dotNumber: profile?.dotNumber || '',
  mcNumber: profile?.mcNumber || '',
  primaryColor: profile?.primaryColor || '#1D4ED8',
  logoUrl: profile?.logoUrl,
});

const FONT = 'helvetica' as const;

const FONT_SIZES = {
  title: 16,
  subtitle: 12,
  body: 10,
  small: 8,
  tableHeader: 8,
  tableData: 8,
};

const COLORS = {
  primary: [29, 78, 216] as [number, number, number],
  headerBg: [241, 245, 249] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  gray: [100, 116, 139] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
};

const formatCurrency = (amount: number): string => {
  return `$${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Local date-only formatting — avoids Jul 31 → Jul 30 UTC shift. */
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'N/A';
  return formatDateOnly(dateStr, { month: 'short', day: 'numeric', year: 'numeric' });
};

const getBrokerName = (invoice: Invoice, loads: Load[]): string => {
  if (invoice.brokerName) return invoice.brokerName;

  const invoiceLoads = loads.filter(load =>
    load.invoiceId === invoice.id ||
    invoice.loadIds?.includes(load.id) ||
    invoice.loadId === load.id
  );

  for (const load of invoiceLoads) {
    if (load.brokerName) return load.brokerName;
  }

  return invoice.customerName || 'Broker';
};

const truncateText = (doc: jsPDF, text: string, maxWidth: number): string => {
  const value = text || '';
  if (!value || maxWidth <= 0) return value;
  if (doc.getTextWidth(value) <= maxWidth) return value;
  const ellipsis = '…';
  let truncated = value;
  while (truncated.length > 1 && doc.getTextWidth(truncated + ellipsis) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? truncated + ellipsis : ellipsis;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return COLORS.primary;
  const n = parseInt(cleaned, 16);
  if (Number.isNaN(n)) return COLORS.primary;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Generate Invoice PDF - TruckingOffice Style
 * Includes Remit-To address for factored invoices
 */
export async function generateInvoicePDF(
  invoice: Invoice,
  loads: Load[],
  companyProfile?: CompanyProfile | null,
  factoringCompany?: FactoringCompany
): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const footerReserve = 28;
  const primary = hexToRgb(companyProfile?.primaryColor || '#1D4ED8');

  const company = getCompanyInfo(companyProfile);
  const brokerName = getBrokerName(invoice, loads);
  const logo = await loadLogoForPdf(company.logoUrl);

  const invoiceLoads = loads.filter(load =>
    load.invoiceId === invoice.id ||
    invoice.loadIds?.includes(load.id) ||
    invoice.loadId === load.id
  );

  let y = margin;
  let pageNum = 1;

  const drawFooter = () => {
    const footerY = pageHeight - 18;
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setTextColor(...COLORS.gray);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });

    doc.setFontSize(7);
    doc.text(
      `${company.name} • ${company.phone || ''} • ${company.email || ''}`,
      pageWidth / 2,
      footerY + 5,
      { align: 'center' }
    );
    doc.text(`Page ${pageNum}`, pageWidth - margin, footerY + 5, { align: 'right' });
  };

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - footerReserve) return;
    drawFooter();
    doc.addPage();
    pageNum += 1;
    y = margin;
    // Continuation header
    doc.setTextColor(...COLORS.text);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(10);
    doc.text(`INVOICE # ${invoice.invoiceNumber} (continued)`, margin, y);
    y += 8;
  };

  // ==========================================
  // HEADER SECTION
  // ==========================================
  const logoBoxW = 60;
  const logoBoxH = 25;
  let logoDrawn = false;
  if (logo) {
    logoDrawn = drawPdfLogo(doc, logo, margin, y, logoBoxW, logoBoxH);
  }
  if (!logoDrawn) {
    doc.setFillColor(...primary);
    doc.rect(margin, y, logoBoxW, logoBoxH, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(14);
    doc.text(company.name || 'TMS PRO', margin + 5, y + 10);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    if (company.mcNumber) {
      doc.text(`MC# ${company.mcNumber}`, margin + 5, y + 16);
    }
    if (company.dotNumber) {
      doc.text(`DOT# ${company.dotNumber}`, margin + 5, y + 20);
    }
  } else {
    // MC/DOT under logo when image is present
    doc.setTextColor(...COLORS.gray);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    const metaY = y + logoBoxH + 4;
    const metaParts = [
      company.mcNumber ? `MC# ${company.mcNumber}` : '',
      company.dotNumber ? `DOT# ${company.dotNumber}` : '',
    ].filter(Boolean);
    if (metaParts.length) {
      doc.text(metaParts.join('  •  '), margin, metaY);
    }
  }

  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(FONT_SIZES.title);
  doc.text('INVOICE', pageWidth - margin, y + 8, { align: 'right' });

  doc.setFont(FONT, 'normal');
  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(...COLORS.gray);
  doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, y + 15, { align: 'right' });

  const statusColors: Record<string, [number, number, number]> = {
    paid: COLORS.success,
    pending: COLORS.warning,
    overdue: [220, 38, 38],
    partial: COLORS.primary,
    draft: COLORS.gray,
  };
  const statusColor = statusColors[invoice.status] || COLORS.gray;
  const statusText = invoice.paperworkHold
    ? 'PAPERWORK HOLD'
    : String(invoice.status || 'pending').toUpperCase();
  const statusWidth = Math.min(doc.getTextWidth(statusText) + 6, 45);

  doc.setFillColor(...(invoice.paperworkHold ? [234, 88, 12] as [number, number, number] : statusColor));
  doc.roundedRect(pageWidth - margin - statusWidth, y + 18, statusWidth, 6, 1, 1, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(6.5);
  doc.text(statusText, pageWidth - margin - statusWidth / 2, y + 22, { align: 'center' });

  y += logoDrawn ? 36 : 35;

  // ==========================================
  // COMPANY & BROKER INFO
  // ==========================================
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const col1X = margin;
  const col2X = pageWidth / 2 + 10;
  const fromStartY = y;

  doc.setTextColor(...COLORS.gray);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(8);
  doc.text('FROM:', col1X, y);

  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(FONT_SIZES.body);
  y += 5;
  doc.text(company.name, col1X, y);
  y += 4;
  if (company.address) {
    doc.text(company.address, col1X, y);
    y += 4;
  }
  if (company.city || company.state || company.zip) {
    doc.text(`${company.city}, ${company.state} ${company.zip}`, col1X, y);
    y += 4;
  }
  if (company.phone) {
    doc.text(`Phone: ${company.phone}`, col1X, y);
    y += 4;
  }
  if (company.email) {
    doc.text(`Email: ${company.email}`, col1X, y);
  }
  const fromEndY = y;

  let y2 = fromStartY;
  doc.setTextColor(...COLORS.gray);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(8);
  doc.text('BILL TO:', col2X, y2);

  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(FONT_SIZES.body);
  y2 += 5;
  doc.text(truncateText(doc, brokerName, 80), col2X, y2);

  if (invoice.isFactored && factoringCompany) {
    y2 += 8;
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(col2X - 5, y2 - 3, 85, 22, 2, 2, 'F');
    doc.setDrawColor(251, 191, 36);
    doc.setLineWidth(0.3);
    doc.roundedRect(col2X - 5, y2 - 3, 85, 22, 2, 2, 'S');

    doc.setTextColor(180, 83, 9);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(7);
    doc.text('REMIT PAYMENT TO:', col2X, y2 + 2);

    doc.setTextColor(...COLORS.text);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.text(truncateText(doc, factoringCompany.name, 75), col2X, y2 + 7);

    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    let remitY = y2 + 11;
    if (factoringCompany.address) {
      doc.text(truncateText(doc, factoringCompany.address, 75), col2X, remitY);
      remitY += 3.5;
    }
    if (factoringCompany.city || factoringCompany.state || factoringCompany.zipCode) {
      doc.text(
        `${factoringCompany.city || ''}, ${factoringCompany.state || ''} ${factoringCompany.zipCode || ''}`.trim(),
        col2X,
        remitY
      );
    }
    y2 += 25;
  }

  y2 += 10;
  doc.setFillColor(...COLORS.headerBg);
  doc.roundedRect(col2X - 5, y2, 85, 25, 2, 2, 'F');

  doc.setTextColor(...COLORS.gray);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.text('Invoice Date:', col2X, y2 + 6);
  doc.text('Due Date:', col2X, y2 + 12);
  doc.text('Amount Due:', col2X, y2 + 18);

  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'bold');
  doc.text(formatDate(invoice.date), col2X + 70, y2 + 6, { align: 'right' });
  doc.text(formatDate(invoice.dueDate), col2X + 70, y2 + 12, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.text(formatCurrency(invoice.amount), col2X + 70, y2 + 19, { align: 'right' });

  y = Math.max(fromEndY, y2 + 30) + 10;

  // ==========================================
  // LOADS TABLE
  // ==========================================
  const tableHeaders = ['Broker Load #', 'Origin', 'Destination', 'Pickup', 'Amount'];
  const colWidths = [40, 38, 38, 28, 36];
  const rowMinH = 8;

  const drawTableHeader = () => {
    ensureSpace(10);
    doc.setFillColor(...primary);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(FONT_SIZES.tableHeader);
    let xPos = margin + 3;
    tableHeaders.forEach((header, i) => {
      doc.text(header, xPos, y + 5.5);
      xPos += colWidths[i];
    });
    y += 8;
  };

  drawTableHeader();

  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(FONT_SIZES.tableData);

  let totalAmount = 0;

  const drawRow = (
    cells: [string, string, string, string, string],
    amount: number,
    idx: number
  ) => {
    // Measure wrap for load # only (first column)
    doc.setFont(FONT, 'bold');
    doc.setFontSize(FONT_SIZES.tableData);
    const loadLines = doc.splitTextToSize(cells[0], colWidths[0] - 4) as string[];
    const rowH = Math.max(rowMinH, loadLines.length * 3.6 + 3);

    ensureSpace(rowH + 2);
    // If we just started a new page, redraw header
    if (y === margin + 8 || (pageNum > 1 && y <= margin + 10)) {
      // continuation header already drawn; table header if near top after continue
    }

    if (idx % 2 === 0) {
      doc.setFillColor(...COLORS.headerBg);
      doc.rect(margin, y, contentWidth, rowH, 'F');
    }

    let xPos = margin + 3;
    doc.setTextColor(...COLORS.text);
    doc.setFont(FONT, 'bold');
    loadLines.forEach((line: string, li: number) => {
      doc.text(line, xPos, y + 4.5 + li * 3.6);
    });
    doc.setFont(FONT, 'normal');
    xPos += colWidths[0];

    doc.text(truncateText(doc, cells[1], colWidths[1] - 2), xPos, y + 5);
    xPos += colWidths[1];
    doc.text(truncateText(doc, cells[2], colWidths[2] - 2), xPos, y + 5);
    xPos += colWidths[2];
    doc.text(truncateText(doc, cells[3], colWidths[3] - 2), xPos, y + 5);
    xPos += colWidths[3];
    doc.setFont(FONT, 'bold');
    doc.text(formatCurrency(amount), xPos, y + 5);
    doc.setFont(FONT, 'normal');

    // Row border
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, rowH);

    y += rowH;
    totalAmount += amount;
  };

  if (invoiceLoads.length > 0) {
    invoiceLoads.forEach((load, idx) => {
      // Re-draw table header when a page break left us near the top without one
      if (y > pageHeight - footerReserve - rowMinH) {
        ensureSpace(rowMinH + 10);
      }
      // After page break from ensureSpace inside drawRow, if we're right after continue header, add table header
      const brokerLoadNum = load.brokerReference || load.poNumber || load.loadNumber || 'N/A';
      const origin = `${load.originCity || ''}, ${load.originState || ''}`.replace(/^,\s*|,\s*$/g, '').trim() || 'N/A';
      const dest = `${load.destCity || ''}, ${load.destState || ''}`.replace(/^,\s*|,\s*$/g, '').trim() || 'N/A';
      const loadAmount = load.grandTotal || load.rate || 0;

      // If ensureSpace will page-break mid-row, drawTableHeader on new page
      const probeLines = doc.splitTextToSize(brokerLoadNum, colWidths[0] - 4) as string[];
      const probeH = Math.max(rowMinH, probeLines.length * 3.6 + 3);
      if (y + probeH > pageHeight - footerReserve) {
        drawFooter();
        doc.addPage();
        pageNum += 1;
        y = margin;
        doc.setTextColor(...COLORS.text);
        doc.setFont(FONT, 'bold');
        doc.setFontSize(10);
        doc.text(`INVOICE # ${invoice.invoiceNumber} (continued)`, margin, y);
        y += 8;
        drawTableHeader();
      }

      drawRow(
        [brokerLoadNum, origin, dest, formatDate(load.pickupDate), formatCurrency(loadAmount)],
        loadAmount,
        idx
      );
    });
  } else {
    drawRow(
      ['Service', brokerName, '-', formatDate(invoice.date), formatCurrency(invoice.amount)],
      invoice.amount,
      0
    );
  }

  // ==========================================
  // TOTALS SECTION
  // ==========================================
  ensureSpace(40);
  y += 6;
  const totalsX = pageWidth - margin - 80;

  doc.setTextColor(...COLORS.gray);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(FONT_SIZES.body);
  doc.text('Subtotal:', totalsX, y);
  doc.setTextColor(...COLORS.text);
  doc.text(formatCurrency(totalAmount || invoice.amount), pageWidth - margin, y, { align: 'right' });
  y += 6;

  if (invoice.factoringFee && invoice.factoringFee > 0) {
    doc.setTextColor(...COLORS.gray);
    doc.text('Factoring Fee:', totalsX, y);
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatCurrency(invoice.factoringFee)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;
  }

  doc.setFillColor(...primary);
  doc.roundedRect(totalsX - 5, y - 2, 85, 10, 2, 2, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL DUE:', totalsX, y + 5);
  doc.text(formatCurrency(invoice.amount), pageWidth - margin, y + 5, { align: 'right' });
  y += 16;

  if (invoice.paperworkHold) {
    ensureSpace(14);
    doc.setFillColor(255, 237, 213);
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
    doc.setTextColor(154, 52, 18);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.text('PAPERWORK HOLD — POD/BOL documents were missing at invoice creation.', margin + 3, y + 6.5);
    y += 14;
  }

  if (invoice.status === 'paid') {
    ensureSpace(16);
    doc.setFillColor(...COLORS.success);
    doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(10);
    doc.text('✓ PAID', margin + 5, y + 8);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    const paidInfo = invoice.paidAt ? `on ${formatDate(invoice.paidAt)}` : '';
    const paymentRef = invoice.paymentReference ? ` • Ref: ${invoice.paymentReference}` : '';
    doc.text(`${paidInfo}${paymentRef}`, margin + 25, y + 8);
    y += 20;
  }

  if (invoice.notes) {
    ensureSpace(20);
    doc.setTextColor(...COLORS.gray);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.text('NOTES:', margin, y);
    doc.setFont(FONT, 'normal');
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(invoice.notes, contentWidth) as string[];
    y += 5;
    noteLines.forEach((line: string) => {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 4;
    });
  }

  ensureSpace(10);
  y += 5;
  doc.setTextColor(...COLORS.gray);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  doc.text('Payment Terms: Net 30 days from invoice date. Please include invoice number with payment.', margin, y);

  drawFooter();
  doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
}

/**
 * Print invoice using browser print dialog (quick print)
 */
export async function printInvoiceQuick(
  invoice: Invoice,
  loads: Load[],
  companyProfile?: CompanyProfile | null
): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'letter');
  await generateInvoicePDFToDoc(doc, invoice, loads, companyProfile);

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

async function generateInvoicePDFToDoc(
  doc: jsPDF,
  invoice: Invoice,
  loads: Load[],
  companyProfile?: CompanyProfile | null
): Promise<void> {
  // Lightweight print path — reuses the full generator by cloning via temp save avoidance.
  // Keep a compact summary for quick print when the full layout isn't needed.
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const company = getCompanyInfo(companyProfile);
  const brokerName = getBrokerName(invoice, loads);
  const logo = await loadLogoForPdf(company.logoUrl);
  const primary = hexToRgb(company.primaryColor);

  const invoiceLoads = loads.filter(load =>
    load.invoiceId === invoice.id ||
    invoice.loadIds?.includes(load.id) ||
    invoice.loadId === load.id
  );

  let y = margin;
  if (!logo || !drawPdfLogo(doc, logo, margin, y, 40, 18)) {
    doc.setFillColor(...primary);
    doc.rect(margin, y, 50, 18, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(12);
    doc.text(company.name || 'TMS PRO', margin + 4, y + 11);
  }

  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(FONT_SIZES.title);
  doc.text('INVOICE', pageWidth - margin, y + 8, { align: 'right' });
  doc.setFont(FONT, 'normal');
  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(...COLORS.gray);
  doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, y + 15, { align: 'right' });
  y += 28;

  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(FONT_SIZES.body);
  doc.text(`Broker: ${brokerName}`, margin, y);
  y += 6;
  doc.text(`Invoice Date: ${formatDate(invoice.date)}`, margin, y);
  y += 6;
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, margin, y);
  y += 6;
  doc.text(`Amount: ${formatCurrency(invoice.amount)}`, margin, y);
  y += 6;
  doc.text(`Status: ${String(invoice.status || '').toUpperCase()}`, margin, y);
  y += 12;

  if (invoiceLoads.length > 0) {
    doc.setFont(FONT, 'bold');
    doc.text('Loads:', margin, y);
    doc.setFont(FONT, 'normal');
    y += 6;
    invoiceLoads.forEach(load => {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = margin;
      }
      const brokerLoadNum = load.brokerReference || load.poNumber || load.loadNumber || 'N/A';
      const line = `${brokerLoadNum}: ${load.originCity}, ${load.originState} → ${load.destCity}, ${load.destState} - ${formatCurrency(load.grandTotal || load.rate || 0)}`;
      const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2) as string[];
      wrapped.forEach((w: string) => {
        doc.text(w, margin, y);
        y += 5;
      });
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 15, { align: 'center' });
}
