# Expert Review - Core Files to Share

**Purpose**: This document lists all core files that represent the TMS application's architecture, business logic, and key functionality.

---

## 📋 **ESSENTIAL FILES (Must Share)**

### 1. **Data Models & Types** (Foundation)
```
src/types.ts
```
**Why**: Defines all data structures (Load, Employee, Invoice, Settlement, etc.). This is the "schema" of your application.

---

### 2. **Core Business Logic** (Critical Calculations)
```
src/services/businessLogic.ts
```
**Why**: Centralized calculation logic for driver pay, settlements, revenue, etc. This is where all financial calculations happen.

---

### 3. **Main Application Context** (State Management)
```
src/context/TMSContext.tsx
```
**Why**: The heart of your application. Manages all data (loads, drivers, invoices, settlements) and CRUD operations. Shows how data flows through the app.

---

### 4. **Authentication & Authorization**
```
src/context/AuthContext.tsx
src/services/rbac.ts
```
**Why**: Shows security model, user authentication, and role-based access control.

---

### 5. **Invoice Numbering System**
```
src/services/invoiceService.ts
```
**Why**: Demonstrates how you handle unique, sequential invoice numbers (critical for accounting).

---

### 6. **Settlement PDF Generation**
```
src/services/settlementPDF.ts
```
**Why**: Shows how driver/dispatcher settlement statements are generated. This is a complex, business-critical feature.

---

## 📊 **IMPORTANT FILES (Should Share)**

### 7. **Workflow & Task System**
```
src/services/workflow/workflowEngine.ts
src/services/workflow/taskService.ts
src/services/workflow/workflowRules.ts
src/services/workflow/guardrails.ts
```
**Why**: Shows automated task generation, business rule enforcement, and workflow automation.

---

### 8. **Distance Calculation**
```
src/services/utils.ts
```
**Why**: Contains distance calculation logic (OSRM integration, Haversine, geocoding). Important for mileage tracking.

---

### 9. **Document Management**
```
src/services/documentService.ts
```
**Why**: Shows how documents (POD, BOL) are linked to loads and enforced for certain actions.

---

### 10. **Payment & AR Services**
```
src/services/paymentService.ts
```
**Why**: Handles invoice payments, aging reports, and AR calculations.

---

### 11. **Main App Entry Point**
```
src/App.tsx
```
**Why**: Shows routing, page structure, and how components are organized.

---

### 12. **Key Pages** (Pick 2-3 most important)
```
src/pages/Loads.tsx          # Core load management
src/pages/Settlements.tsx    # Settlement generation
src/pages/Reports.tsx        # Financial reporting
```
**Why**: Shows how the UI interacts with business logic. These are the most complex pages.

---

## 📁 **SUPPORTING FILES (Optional but Helpful)**

### 13. **Configuration Files**
```
package.json                 # Dependencies and scripts
tsconfig.json               # TypeScript configuration
vite.config.ts              # Build configuration
```

### 14. **Documentation** (Very Helpful)
```
docs/CORE_VALUES_AND_LOGIC.md           # Core business rules
docs/STRUCTURAL_REVIEW_RESPONSE.md      # System architecture review
docs/STATUS_AND_IMPLEMENTATION_PLAN.md  # Current status
```

### 15. **Tenant & Company Context**
```
src/context/TenantContext.tsx
src/context/CompanyContext.tsx
```
**Why**: Shows multi-tenant architecture and company branding.

---

## 🎯 **RECOMMENDED SHARING STRATEGY**

### **Option 1: Minimal (Quick Review)**
Share these 6 files:
1. `src/types.ts`
2. `src/services/businessLogic.ts`
3. `src/context/TMSContext.tsx`
4. `src/services/settlementPDF.ts`
5. `src/services/invoiceService.ts`
6. `docs/CORE_VALUES_AND_LOGIC.md`

### **Option 2: Comprehensive (Deep Review)**
Share all files from "Essential" + "Important" sections above (about 15-20 files).

### **Option 3: Full Codebase (Complete Review)**
Share the entire `src/` directory + `docs/` directory.

---

## 📝 **WHAT TO INCLUDE WITH FILES**

When sharing, also provide:

1. **Project Overview**:
   - "This is a Trucking Management System (TMS) for managing loads, drivers, settlements, and invoicing"
   - Multi-tenant architecture (subdomain-based)
   - Uses localStorage for data persistence (no backend database)

2. **Key Questions** (Tell expert what you want reviewed):
   - Architecture decisions
   - Business logic correctness
   - Performance concerns
   - Security issues
   - Scalability
   - Code quality

3. **Current Concerns** (If any):
   - Specific bugs or issues
   - Areas you're unsure about
   - Performance problems

---

## 🚫 **FILES TO EXCLUDE (Don't Share)**

- `node_modules/` (too large, not needed)
- `.git/` (version control, not needed)
- `dist/` or `build/` (compiled output)
- `legacy/` (old files)
- Environment files (`.env`, `.env.local`) - might contain secrets
- Test files (unless expert specifically asks)

---

## 📦 **HOW TO SHARE**

### **Method 1: Zip Archive**
```bash
# Create a zip with only essential files
zip -r tms-core-files.zip src/types.ts src/services/ src/context/ docs/CORE_VALUES_AND_LOGIC.md
```

### **Method 2: GitHub Gist**
Create a Gist with the key files listed above.

### **Method 3: GitHub Repository** (Best)
Create a private repo and share access. Expert can browse all files.

### **Method 4: Code Review Tool**
Use tools like:
- CodeRabbit
- Reviewpad
- GitHub Pull Request (if you have a repo)

---

## ✅ **CHECKLIST BEFORE SHARING**

- [ ] Removed any API keys or secrets
- [ ] Removed personal/sensitive data
- [ ] Included documentation files
- [ ] Organized files clearly
- [ ] Added a README explaining what the expert should focus on
- [ ] Listed specific questions you want answered

---

**END OF FILE LIST**


