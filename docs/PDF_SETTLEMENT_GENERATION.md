# 📄 PDF Settlement Generation - Complete Guide

## Overview

The TMS Pro application generates professional PDF settlement statements for drivers and dispatchers using **jsPDF** library. The PDFs are dynamically generated in the browser and include detailed load information, earnings, deductions, and year-to-date summaries.

---

## 🛠️ Technology Stack

### Library: jsPDF
- **Version**: 3.0.4
- **Documentation**: https://github.com/parallax/jsPDF
- **Type**: Client-side PDF generation (no server required)
- **Format**: Letter size (8.5" × 11"), Portrait orientation

### Key Features:
- ✅ Pure JavaScript - no server-side rendering needed
- ✅ Fast generation in the browser
- ✅ Customizable fonts, colors, and layouts
- ✅ Automatic page breaks for long content
- ✅ Professional table formatting

---

## 📁 File Structure

```
src/services/settlementPDF.ts
```

This file contains:
1. `generateDriverSettlementPDF()` - Driver settlement PDF generator
2. `generateDispatcherSettlementPDF()` - Dispatcher settlement PDF generator
3. `generateSettlementPDF()` - Main entry point (routes to appropriate generator)
4. Helper functions for formatting and calculations

---

## 🔄 How It Works

### 1. **Triggering PDF Generation**

**Location**: `src/pages/Settlements.tsx` (line ~847)

```typescript
generateSettlementPDF(settlement, payee, loads, settlements, company);
```

**When**: User clicks the "Print PDF" button (printer icon) next to a settlement in the table.

### 2. **Data Flow**

```
User clicks "Print PDF"
    ↓
generateSettlementPDF() is called
    ↓
Checks payee.employeeType
    ↓
Routes to appropriate generator:
  - 'dispatcher' → generateDispatcherSettlementPDF()
  - otherwise → generateDriverSettlementPDF()
    ↓
PDF is generated and downloaded
```

### 3. **Input Parameters**

```typescript
generateSettlementPDF(
  settlement: Settlement,      // The settlement object with all financial data
  payee: Employee,             // Driver or dispatcher receiving payment
  loads: Load[],               // All loads in the system (to find settlement loads)
  allSettlements: Settlement[], // All settlements (for YTD calculations)
  company: CompanySettings     // Company branding and contact info
)
```

---

## 📋 PDF Structure (Driver Settlement)

### Section 1: Header
- **Title**: "SETTLEMENT PAY" (right-aligned)
- **Company Info**: Name, address, contact details (right-aligned)
- **Font**: Helvetica Bold (title), Helvetica Normal (details)
- **Size**: 14pt (title), 7pt (details)

### Section 2: Payment Recipient
- **Blue header bar** with "PAYMENT FOR" text
- **Driver name** and unit number (if applicable)
- **Driver address** (if available)
- **Settlement number** and period (right-aligned)

### Section 3: Load Details Table
- **Columns**: Load #, Date, Route, Load Amount, Gross Pay
- **Features**:
  - Alternating row colors (gray/white)
  - Blue header row
  - Total row at bottom
- **Data Source**: `settlement.loads[]` array

### Section 4: Earnings Table
- **Columns**: Description, Amount
- **Rows**: Detention Fees, TONU Fee, Layover Fee
- **Features**: Only shows non-zero earnings
- **Total**: Sum of all accessorials

### Section 5: Other Earnings (Optional)
- **Columns**: Amount, Description
- **Shows**: Any additional earnings beyond base pay and accessorials
- **Total**: Sum of other earnings

### Section 6: Deductions Table
- **Owner Operators**: 15 columns (Insurance, IFTA, Cash Advance, Fuel, Trailer, Repairs, Parking, 2290, ELD, Tolls, IRP, UCR, Escrow, Occ. Acc, Other)
- **Company Drivers**: 5 columns (Cash Advance, Escrow, Occ. Acc, Uniform, Other)
- **Features**: Compact layout, blue header

### Section 7: Totals
- **Total Deductions**: Sum of all deductions
- **Net Amount Paid/Due**: Gross Pay - Total Deductions
- **Highlighted**: Larger font, bold, highlighted background

### Section 8: Year-to-Date (YTD)
- **Three columns**: YTD Earnings, YTD Deductions, YTD Net Pay
- **Calculation**: Sums all settlements for the current year for this payee
- **Data Source**: Filters `allSettlements[]` by year and payee ID

### Section 9: Footer
- **Thank you message**
- **Legal disclaimers**:
  - Negative values explanation
  - 1099 contractor notice
- **Page number**: "PAGE 1 OF 1"

---

## 📋 PDF Structure (Dispatcher Settlement)

Similar structure but with:
- **Title**: "SETTLEMENT PAY (DISPATCHER)"
- **Loads Dispatched Table**: Shows commission details per load
- **Simpler Deductions**: Only 4 columns (Cash Advance, Escrow, Occ. Acc, Other)
- **Commission Focus**: Emphasizes commission type and rate per load

---

## 🎨 Design Constants

### Font Sizes
```typescript
const FONT_SIZES = {
  title: 14,        // Main title
  sectionHeader: 9, // Section headings
  tableHeader: 8,   // Table column headers
  tableData: 7,     // Table cell data
  label: 7,         // Labels
  amount: 7,         // Currency amounts
  total: 9,         // Total rows
  footer: 7         // Footer text
};
```

### Colors (RGB)
```typescript
const COLORS = {
  headerBar: [30, 144, 255],    // Blue (#1E90FF)
  tableHeader: [30, 144, 255],  // Blue
  tableRowAlt: [245, 245, 245], // Light gray (#F5F5F5)
  totalsRow: [232, 244, 252],   // Light blue (#E8F4FC)
  text: [0, 0, 0],              // Black
  negative: [255, 0, 0],        // Red
  white: [255, 255, 255],      // White
  border: [200, 200, 200]      // Light gray
};
```

### Page Layout
- **Page Size**: Letter (8.5" × 11")
- **Margins**: 0.5" on all sides
- **Content Width**: 7.5" (8.5" - 1" margins)
- **Line Height**: 0.18" (standard spacing)

---

## 🔧 Helper Functions

### `formatCurrency(amount: number): string`
- Formats numbers as currency: `$1,234.56`
- Handles negative values: `($123.45)`
- Always shows 2 decimal places

### `formatDate(dateStr: string): string`
- Converts ISO date strings to readable format
- Example: `"2025-01-15"` → `"Jan 15, 2025"`
- Handles invalid dates gracefully

### `formatDateHeader(dateStr: string): string`
- Similar to `formatDate` but with 2-digit day
- Example: `"Jan 02, 2025"`

### `calculateYTD(settlements, payeeId, year): object`
- Calculates year-to-date totals
- Filters settlements by:
  - Payee ID (driver or dispatcher)
  - Year (from settlement date)
- Returns: `{ earnings, deductions, netPay }`

### `drawTableBorders(doc, x, y, widths, height, drawVertical)`
- Draws table borders (horizontal and vertical lines)
- Reusable function for consistent table styling
- Parameters:
  - `doc`: jsPDF document instance
  - `x, y`: Starting position
  - `widths`: Array of column widths
  - `height`: Row height
  - `drawVertical`: Boolean for vertical lines

### `getCompanyInfo(company: CompanySettings): object`
- Extracts and formats company information
- Converts to uppercase for consistency
- Returns structured object with all company fields

---

## 📊 Data Mapping

### Settlement Object Structure
```typescript
interface Settlement {
  id: string;
  settlementNumber: string;
  type: 'driver' | 'dispatcher';
  driverId?: string;
  dispatcherId?: string;
  driverName: string;
  loadIds: string[];
  loads: Array<{
    loadId: string;
    basePay: number;
    detention: number;
    tonu: number;
    layover: number;
    dispatchFee?: number;
  }>;
  expenseIds: string[];
  grossPay: number;
  deductions: {
    insurance?: number;
    fuel?: number;
    cashAdvance?: number;
    // ... other deduction types
  };
  totalDeductions: number;
  netPay: number;
  totalMiles: number;
  status: 'pending' | 'processed' | 'paid';
  periodStart: string; // ISO date string
  periodEnd: string;   // ISO date string
  period: {
    start: string;
    end: string;
    display: string;
  };
  createdAt: string;
  otherEarnings?: Array<{
    amount: number;
    description?: string;
    type?: string;
  }>;
}
```

### Load Object (used for details)
```typescript
interface Load {
  id: string;
  loadNumber: string;
  driverId?: string;
  driverName?: string;
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  rate: number;
  grandTotal?: number;
  miles: number;
  pickupDate: string;
  deliveryDate: string;
  driverBasePay?: number;
  driverDetentionPay?: number;
  driverLayoverPay?: number;
  dispatcherCommissionAmount?: number;
  dispatcherCommissionType?: 'percentage' | 'flat_fee' | 'per_mile';
  dispatcherCommissionRate?: number;
}
```

---

## 🚀 How to Improve the PDF Output

### 1. **Add Company Logo**
```typescript
// In the header section, after company name:
if (company.logoUrl) {
  const img = new Image();
  img.src = company.logoUrl;
  img.onload = () => {
    doc.addImage(img, 'PNG', margin, yPos, 1.5, 0.5);
    yPos += 0.6;
  };
}
```

### 2. **Improve Typography**
- **Add custom fonts**: Use `doc.addFont()` to load custom fonts
- **Better font sizes**: Adjust `FONT_SIZES` for better readability
- **Font weights**: Use `doc.setFont('helvetica', 'bold')` more strategically

### 3. **Enhanced Tables**
- **Auto-adjust column widths**: Calculate based on content
- **Better alignment**: Right-align numbers, left-align text
- **Row wrapping**: Handle long text in cells
- **Multi-line cells**: Use `maxWidth` parameter in `doc.text()`

### 4. **Add Charts/Graphs**
```typescript
// Use jsPDF plugins or canvas
import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // For better tables

// Or use canvas to draw charts, then embed
const canvas = document.createElement('canvas');
// Draw chart on canvas
const imgData = canvas.toDataURL('image/png');
doc.addImage(imgData, 'PNG', margin, yPos, 3, 2);
```

### 5. **Multi-Page Support**
Currently, the PDF handles page breaks for load tables, but you can improve:
- **Page numbers**: Update "PAGE 1 OF 1" to show actual page count
- **Headers/Footers**: Repeat on every page
- **Table continuation**: Show "continued..." on next page

### 6. **Better Color Scheme**
```typescript
// Use company brand colors
const COLORS = {
  primary: company.primaryColor || [30, 144, 255],
  secondary: company.secondaryColor || [245, 245, 245],
  // ...
};
```

### 7. **Add Signatures**
```typescript
// Add signature lines at the bottom
yPos += 0.3;
doc.line(margin, yPos, margin + 2, yPos); // Driver signature line
doc.text('Driver Signature', margin, yPos + 0.1);
doc.line(margin + 3, yPos, margin + 5, yPos); // Company signature line
doc.text('Company Representative', margin + 3, yPos + 0.1);
```

### 8. **QR Codes**
```typescript
// Add QR code for settlement verification
import QRCode from 'qrcode';
const qrData = await QRCode.toDataURL(settlement.id);
doc.addImage(qrData, 'PNG', pageWidth - margin - 0.5, yPos, 0.5, 0.5);
```

### 9. **Better Error Handling**
```typescript
try {
  generateSettlementPDF(...);
} catch (error) {
  console.error('PDF generation error:', error);
  alert('Error generating PDF. Please try again.');
  // Fallback: Show error details or retry
}
```

### 10. **Accessibility**
- **Alt text**: Not applicable for PDFs, but ensure text is readable
- **Color contrast**: Ensure text is readable on colored backgrounds
- **Font size**: Ensure minimum readable size (currently 7pt minimum)

---

## 🐛 Common Issues & Solutions

### Issue 1: Text Overflow
**Problem**: Long text in cells overflows or gets cut off.

**Solution**:
```typescript
// Use maxWidth parameter
doc.text(
  longText,
  xPos,
  yPos,
  { maxWidth: colWidth - 0.1, align: 'left' }
);
```

### Issue 2: Page Breaks in Wrong Places
**Problem**: Tables split awkwardly across pages.

**Solution**:
```typescript
// Check remaining space before drawing
const remainingSpace = pageHeight - yPos - margin;
if (remainingSpace < rowHeight * 2) {
  doc.addPage();
  yPos = margin;
}
```

### Issue 3: Missing Data
**Problem**: Some fields show "N/A" or "0.00" when they should have values.

**Solution**:
- Check data mapping in settlement creation
- Verify `settlement.loads[]` array is populated
- Ensure `loads[]` array passed to function contains all settlement loads

### Issue 4: Currency Formatting Issues
**Problem**: Negative numbers not showing correctly.

**Solution**: Already handled in `formatCurrency()`:
```typescript
if (amount < 0) {
  return `($${Math.abs(amount).toFixed(2)})`;
}
```

### Issue 5: Date Formatting
**Problem**: Dates showing as "Invalid Date" or "N/A".

**Solution**: Already handled with try-catch in `formatDate()`:
```typescript
try {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(...);
} catch {
  return 'N/A';
}
```

---

## 📝 Code Examples

### Example 1: Adding a Custom Section
```typescript
// After Section 8 (YTD), before Footer:
doc.setFontSize(FONT_SIZES.sectionHeader);
doc.setFont('helvetica', 'bold');
doc.text('NOTES', margin, yPos);
yPos += 0.15;

doc.setFontSize(FONT_SIZES.tableData);
doc.setFont('helvetica', 'normal');
const notes = settlement.notes || 'No additional notes.';
doc.text(notes, margin, yPos, { maxWidth: contentWidth });
yPos += 0.3;
```

### Example 2: Custom Table with Auto-sizing
```typescript
const tableData = [
  ['Item 1', '$100.00'],
  ['Item 2', '$200.00'],
  ['Total', '$300.00']
];

const colWidths = [contentWidth * 0.7, contentWidth * 0.3];
const rowHeight = 0.15;

tableData.forEach((row, idx) => {
  const rowY = yPos;
  
  // Alternate row color
  if (idx % 2 === 0) {
    doc.setFillColor(...COLORS.tableRowAlt);
    doc.rect(margin, rowY, contentWidth, rowHeight, 'F');
  }
  
  // Draw borders
  drawTableBorders(doc, margin, rowY, colWidths, rowHeight);
  
  // Add text
  doc.text(row[0], margin + 0.05, rowY + 0.1, { align: 'left' });
  doc.text(row[1], margin + colWidths[0] + colWidths[1] - 0.05, rowY + 0.1, { align: 'right' });
  
  yPos += rowHeight;
});
```

### Example 3: Conditional Sections
```typescript
// Only show section if data exists
if (settlement.otherEarnings && settlement.otherEarnings.length > 0) {
  doc.setFontSize(FONT_SIZES.sectionHeader);
  doc.setFont('helvetica', 'bold');
  doc.text('OTHER EARNINGS', margin, yPos);
  yPos += 0.15;
  
  // ... render other earnings table
}
```

---

## 🔍 Debugging Tips

### 1. **Check Browser Console**
- Look for errors when clicking "Print PDF"
- Check if all required data is present

### 2. **Log Data Before Generation**
```typescript
console.log('Settlement:', settlement);
console.log('Payee:', payee);
console.log('Loads:', loads);
console.log('Company:', company);
```

### 3. **Test with Sample Data**
```typescript
const testSettlement = {
  settlementNumber: 'ST-2025-1001',
  grossPay: 5000,
  totalDeductions: 500,
  netPay: 4500,
  // ... other fields
};

generateSettlementPDF(testSettlement, testDriver, testLoads, [], testCompany);
```

### 4. **Inspect Generated PDF**
- Open PDF in browser or PDF viewer
- Check if all sections render correctly
- Verify calculations are accurate

---

## 📚 Additional Resources

### jsPDF Documentation
- **Official Docs**: https://github.com/parallax/jsPDF
- **API Reference**: https://github.com/parallax/jsPDF/blob/master/docs/jsPDF.html
- **Examples**: https://github.com/parallax/jsPDF/tree/master/examples

### Related Plugins
- **jsPDF-AutoTable**: Better table generation
  - https://github.com/simonbengtsson/jsPDF-AutoTable
- **jsPDF HTML**: Render HTML to PDF
  - https://github.com/eKoopmans/html2pdf.js

### Design Inspiration
- Look at professional settlement statements from other TMS systems
- Consider IRS 1099 form layout for reference
- Review trucking industry standard settlement formats

---

## ✅ Checklist for PDF Improvements

When improving the PDF, consider:

- [ ] **Visual Design**
  - [ ] Company logo
  - [ ] Brand colors
  - [ ] Better typography
  - [ ] Consistent spacing

- [ ] **Content**
  - [ ] All required fields present
  - [ ] Accurate calculations
  - [ ] Clear labels
  - [ ] Helpful footnotes

- [ ] **Functionality**
  - [ ] Multi-page support
  - [ ] Page numbers
  - [ ] Table continuation
  - [ ] Error handling

- [ ] **User Experience**
  - [ ] Fast generation
  - [ ] Clear filename
  - [ ] Download works
  - [ ] Print-friendly

- [ ] **Compliance**
  - [ ] Legal disclaimers
  - [ ] Tax information
  - [ ] Required fields
  - [ ] Audit trail

---

## 🎯 Next Steps

1. **Review current PDF output** - Generate a sample and review
2. **Identify improvements** - What's missing or could be better?
3. **Prioritize changes** - What's most important?
4. **Implement improvements** - Make changes incrementally
5. **Test thoroughly** - Generate PDFs with various data scenarios
6. **Get feedback** - Ask users what they need

---

**Need help?** Check the code in `src/services/settlementPDF.ts` or ask for specific improvements!


