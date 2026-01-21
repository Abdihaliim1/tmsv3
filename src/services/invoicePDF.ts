import { jsPDF } from 'jspdf';
import { Invoice, Load, CompanyProfile, FactoringCompany } from '../types';

/** =========================
 *  Helpers
 *  ========================= */

const getCompanyInfo = (profile: CompanyProfile) => ({
  name: (profile.companyName || 'TMS Pro').toUpperCase(),
  legalName: (profile.legalName || '').toUpperCase(),
  address: (profile.address1 || '').toUpperCase(),
  address2: (profile.address2 || '').toUpperCase(),
  city: (profile.city || '').toUpperCase(),
  state: (profile.state || '').toUpperCase(),
  zip: profile.zip || '',
  website: profile.website || '',
  email: profile.email || '',
  phone: profile.phone || '',
  dotNumber: profile.dotNumber || '',
  mcNumber: profile.mcNumber || '',
  primaryColor: profile.primaryColor || '#1D4ED8',
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

const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Get broker name from invoice or loads
const getBrokerName = (invoice: Invoice, loads: Load[]): string => {
  // First check invoice's broker name
  if (invoice.brokerName) return invoice.brokerName;
  
  // Then check associated loads for broker
  const invoiceLoads = loads.filter(load => 
    load.invoiceId === invoice.id || 
    invoice.loadIds?.includes(load.id) ||
    invoice.loadId === load.id
  );
  
  for (const load of invoiceLoads) {
    if (load.brokerName) return load.brokerName;
  }
  
  // Fallback to customerName (legacy) or default
  return invoice.customerName || 'Broker';
};

/**
 * Generate Invoice PDF - TruckingOffice Style
 * Includes Remit-To address for factored invoices
 */
export function generateInvoicePDF(
  invoice: Invoice,
  loads: Load[],
  companyProfile: CompanyProfile,
  factoringCompany?: FactoringCompany
): void {
  const doc = new jsPDF('p', 'mm', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  const company = getCompanyInfo(companyProfile);
  const brokerName = getBrokerName(invoice, loads);
  
  // Get loads associated with this invoice
  const invoiceLoads = loads.filter(load => 
    load.invoiceId === invoice.id || 
    invoice.loadIds?.includes(load.id) ||
    invoice.loadId === load.id
  );
  
  let y = margin;
  
  // ==========================================
  // HEADER SECTION
  // ==========================================
  
  // Company Logo/Name Area (left side)
  doc.setFillColor(...COLORS.primary);
  doc.rect(margin, y, 60, 25, 'F');
  
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
  
  // Invoice Title (right side)
  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(FONT_SIZES.title);
  doc.text('INVOICE', pageWidth - margin, y + 8, { align: 'right' });
  
  doc.setFont(FONT, 'normal');
  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(...COLORS.gray);
  doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, y + 15, { align: 'right' });
  
  // Status badge
  const statusColors: Record<string, [number, number, number]> = {
    paid: COLORS.success,
    pending: COLORS.warning,
    overdue: [220, 38, 38],
  };
  const statusColor = statusColors[invoice.status] || COLORS.gray;
  const statusText = invoice.status.toUpperCase();
  const statusWidth = doc.getTextWidth(statusText) + 6;
  
  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - margin - statusWidth, y + 18, statusWidth, 6, 1, 1, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(7);
  doc.text(statusText, pageWidth - margin - statusWidth / 2, y + 22, { align: 'center' });
  
  y += 35;
  
  // ==========================================
  // COMPANY & BROKER INFO
  // ==========================================
  
  // Divider line
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  
  // From (Company)
  const col1X = margin;
  const col2X = pageWidth / 2 + 10;
  
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
  
  // Bill To (Broker)
  let y2 = y - (company.address ? 17 : 13);

  doc.setTextColor(...COLORS.gray);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(8);
  doc.text('BILL TO:', col2X, y2);

  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(FONT_SIZES.body);
  y2 += 5;
  doc.text(brokerName, col2X, y2);

  // Remit-To Section (TruckingOffice style - for factored invoices)
  if (invoice.isFactored && factoringCompany) {
    y2 += 8;
    doc.setFillColor(255, 251, 235); // Amber-50 equivalent
    doc.roundedRect(col2X - 5, y2 - 3, 85, 22, 2, 2, 'F');
    doc.setDrawColor(251, 191, 36); // Amber border
    doc.setLineWidth(0.3);
    doc.roundedRect(col2X - 5, y2 - 3, 85, 22, 2, 2, 'S');

    doc.setTextColor(180, 83, 9); // Amber-700
    doc.setFont(FONT, 'bold');
    doc.setFontSize(7);
    doc.text('REMIT PAYMENT TO:', col2X, y2 + 2);

    doc.setTextColor(...COLORS.text);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.text(factoringCompany.name, col2X, y2 + 7);

    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    let remitY = y2 + 11;
    if (factoringCompany.address) {
      doc.text(factoringCompany.address, col2X, remitY);
      remitY += 3.5;
    }
    if (factoringCompany.city || factoringCompany.state || factoringCompany.zipCode) {
      doc.text(`${factoringCompany.city || ''}, ${factoringCompany.state || ''} ${factoringCompany.zipCode || ''}`, col2X, remitY);
    }
    y2 += 25;
  }

  // Invoice Details Box (right side)
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
  doc.setTextColor(...COLORS.primary);
  doc.text(formatCurrency(invoice.amount), col2X + 70, y2 + 19, { align: 'right' });
  
  y = Math.max(y, y2 + 30) + 10;
  
  // ==========================================
  // LOADS TABLE
  // ==========================================
  
  doc.setFillColor(...COLORS.primary);
  doc.rect(margin, y, contentWidth, 8, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(FONT_SIZES.tableHeader);
  
  // Updated headers - use Broker Load # and improve route display
  const tableHeaders = ['Broker Load #', 'Origin', 'Destination', 'Pickup', 'Amount'];
  const colWidths = [35, 40, 40, 30, 35];
  let xPos = margin + 3;
  
  tableHeaders.forEach((header, i) => {
    doc.text(header, xPos, y + 5.5);
    xPos += colWidths[i];
  });
  
  y += 8;
  
  // Table rows
  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(FONT_SIZES.tableData);
  
  let totalAmount = 0;
  
  if (invoiceLoads.length > 0) {
    invoiceLoads.forEach((load, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(...COLORS.headerBg);
        doc.rect(margin, y, contentWidth, 8, 'F');
      }
      
      xPos = margin + 3;
      
      // Use broker reference number first, then PO number, then our load number as fallback
      const brokerLoadNum = load.brokerReference || load.poNumber || load.loadNumber || 'N/A';
      doc.setFont(FONT, 'bold');
      doc.text(brokerLoadNum, xPos, y + 5.5);
      doc.setFont(FONT, 'normal');
      xPos += colWidths[0];
      
      // Origin - City, ST format
      const origin = `${load.originCity || ''}, ${load.originState || ''}`.trim();
      doc.text(origin || 'N/A', xPos, y + 5.5);
      xPos += colWidths[1];
      
      // Destination - City, ST format
      const dest = `${load.destCity || ''}, ${load.destState || ''}`.trim();
      doc.text(dest || 'N/A', xPos, y + 5.5);
      xPos += colWidths[2];
      
      // Pickup date
      doc.text(formatDate(load.pickupDate), xPos, y + 5.5);
      xPos += colWidths[3];
      
      // Amount
      const loadAmount = load.grandTotal || load.rate || 0;
      totalAmount += loadAmount;
      doc.setFont(FONT, 'bold');
      doc.text(formatCurrency(loadAmount), xPos, y + 5.5);
      doc.setFont(FONT, 'normal');
      
      y += 8;
    });
  } else {
    // No loads linked - show single line item
    doc.setFillColor(...COLORS.headerBg);
    doc.rect(margin, y, contentWidth, 8, 'F');
    
    xPos = margin + 3;
    doc.text('Service', xPos, y + 5.5);
    xPos += colWidths[0];
    doc.text(brokerName, xPos, y + 5.5);
    xPos += colWidths[1];
    doc.text('-', xPos, y + 5.5);
    xPos += colWidths[2];
    doc.text(formatDate(invoice.date), xPos, y + 5.5);
    xPos += colWidths[3];
    doc.text(formatCurrency(invoice.amount), xPos, y + 5.5);
    
    totalAmount = invoice.amount;
    y += 8;
  }
  
  // Table border
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  const tableHeight = invoiceLoads.length > 0 ? invoiceLoads.length * 8 : 8;
  doc.rect(margin, y - tableHeight, contentWidth, tableHeight);
  
  y += 10;
  
  // ==========================================
  // TOTALS SECTION
  // ==========================================
  
  const totalsX = pageWidth - margin - 80;
  
  // Subtotal
  doc.setTextColor(...COLORS.gray);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(FONT_SIZES.body);
  doc.text('Subtotal:', totalsX, y);
  doc.setTextColor(...COLORS.text);
  doc.text(formatCurrency(totalAmount || invoice.amount), pageWidth - margin, y, { align: 'right' });
  y += 6;
  
  // If there are any deductions/adjustments
  if (invoice.factoringFee && invoice.factoringFee > 0) {
    doc.setTextColor(...COLORS.gray);
    doc.text('Factoring Fee:', totalsX, y);
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatCurrency(invoice.factoringFee)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;
  }
  
  // Total Due
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(totalsX - 5, y - 2, 85, 10, 2, 2, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL DUE:', totalsX, y + 5);
  doc.text(formatCurrency(invoice.amount), pageWidth - margin, y + 5, { align: 'right' });
  
  y += 20;
  
  // ==========================================
  // PAYMENT INFO / NOTES
  // ==========================================
  
  if (invoice.status === 'paid') {
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
  
  // Notes section
  if (invoice.notes) {
    doc.setTextColor(...COLORS.gray);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.text('NOTES:', margin, y);
    
    doc.setFont(FONT, 'normal');
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(9);
    
    const noteLines = doc.splitTextToSize(invoice.notes, contentWidth);
    y += 5;
    noteLines.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 4;
    });
  }
  
  // Payment Terms
  y += 5;
  doc.setTextColor(...COLORS.gray);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  doc.text('Payment Terms: Net 30 days from invoice date. Please include invoice number with payment.', margin, y);
  
  // ==========================================
  // FOOTER
  // ==========================================
  
  const footerY = pageHeight - 20;
  
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setTextColor(...COLORS.gray);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
  
  doc.setFontSize(7);
  doc.text(`${company.name} • ${company.phone || ''} • ${company.email || ''}`, pageWidth / 2, footerY + 5, { align: 'center' });
  
  // Save the PDF
  doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
}

/**
 * Print invoice using browser print dialog (quick print)
 */
export function printInvoiceQuick(
  invoice: Invoice,
  loads: Load[],
  companyProfile: CompanyProfile
): void {
  // Generate PDF and open in new window for printing
  const doc = new jsPDF('p', 'mm', 'letter');
  
  // Use same generation logic but output to blob URL
  generateInvoicePDFToDoc(doc, invoice, loads, companyProfile);
  
  // Create blob and open in new tab
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

// Helper function to generate PDF content to a doc object
function generateInvoicePDFToDoc(
  doc: jsPDF,
  invoice: Invoice,
  loads: Load[],
  companyProfile: CompanyProfile
): void {
  // Same logic as generateInvoicePDF but without saving
  // (This is used for print preview)
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  
  const company = getCompanyInfo(companyProfile);
  const brokerName = getBrokerName(invoice, loads);
  
  const invoiceLoads = loads.filter(load => 
    load.invoiceId === invoice.id || 
    invoice.loadIds?.includes(load.id) ||
    invoice.loadId === load.id
  );
  
  let y = margin;
  
  // Header
  doc.setFillColor(...COLORS.primary);
  doc.rect(margin, y, 60, 25, 'F');
  
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
  
  doc.setTextColor(...COLORS.text);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(FONT_SIZES.title);
  doc.text('INVOICE', pageWidth - margin, y + 8, { align: 'right' });
  
  doc.setFont(FONT, 'normal');
  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(...COLORS.gray);
  doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, y + 15, { align: 'right' });
  
  y += 35;
  
  // Content (simplified for print)
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
  doc.text(`Status: ${invoice.status.toUpperCase()}`, margin, y);
  
  y += 15;
  
  // Loads
  if (invoiceLoads.length > 0) {
    doc.setFont(FONT, 'bold');
    doc.text('Loads:', margin, y);
    doc.setFont(FONT, 'normal');
    y += 6;
    
    invoiceLoads.forEach(load => {
      const brokerLoadNum = load.brokerReference || load.poNumber || load.loadNumber || 'N/A';
      doc.text(`${brokerLoadNum}: ${load.originCity}, ${load.originState} → ${load.destCity}, ${load.destState} - ${formatCurrency(load.grandTotal || load.rate || 0)}`, margin, y);
      y += 5;
    });
  }
  
  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
}

