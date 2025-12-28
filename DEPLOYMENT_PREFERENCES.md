# 🚀 Deployment Preferences & Strategy

## Deployment Rules

### General Deployment
**When user says:** "deploy to the all", "deploy everything", "deploy all changes", etc.

**Action:**
- ✅ Deploy ALL changes to Google Cloud
- ✅ Update the entire application
- ✅ Include all features, fixes, and updates
- ✅ Full deployment to production

**Command:**
```bash
./deploy.sh
```

---

### Specific/Company-Specific Deployment
**When user says:** "deploy branding", "deploy for [company name]", "deploy [specific feature]", etc.

**Action:**
- ✅ Make changes specific to that company/tenant
- ✅ Use tenant-aware configuration
- ✅ Store settings per tenant (localStorage with tenant prefix)
- ✅ Only affect the specified company's instance
- ✅ Other tenants remain unchanged

**Examples:**
- "deploy branding" → Update company settings for current tenant only
- "deploy for atsfreight" → Tenant-specific changes for `atsfreight` tenant
- "deploy [feature] for [company]" → Company-specific feature deployment

---

## Multi-Tenant Architecture

### How It Works
- Each subdomain = separate tenant
- `atsfreight.asal.llc` → Tenant ID: `atsfreight`
- `company2.asal.llc` → Tenant ID: `company2`
- Data isolated per tenant

### Tenant-Specific Storage
```typescript
// Storage keys are tenant-aware
const storageKey = tenantId ? `tms_${tenantId}_${key}` : `tms_${key}`;
```

### Company Settings
- Stored per tenant in localStorage
- Each company has its own:
  - Company name
  - Address
  - Logo
  - Branding
  - Settings

---

## Deployment Scenarios

### Scenario 1: General Update
**Request:** "deploy to the all" or "deploy everything"

**What to do:**
1. Build the application
2. Deploy to Cloud Run
3. All tenants get the update
4. All companies see new features

**Example:**
```bash
# User: "deploy to the all"
# Action: Full deployment
./deploy.sh
```

---

### Scenario 2: Company-Specific Branding
**Request:** "deploy branding" or "update branding for atsfreight"

**What to do:**
1. Update company settings in the app
2. Settings stored per tenant
3. Only that company's branding changes
4. Other companies unaffected
5. No need to redeploy (client-side storage)

**Example:**
```typescript
// In CompanyContext.tsx
const saveCompanySettings = (settings: CompanySettings) => {
  const tenantId = getTenantFromSubdomain();
  const key = tenantId ? `tms_${tenantId}_companySettings` : 'tms_companySettings';
  localStorage.setItem(key, JSON.stringify(settings));
};
```

---

### Scenario 3: Feature for Specific Company
**Request:** "deploy [feature] for [company]"

**What to do:**
1. Check if feature should be tenant-specific
2. If yes: Use tenant-aware configuration
3. Store feature flags per tenant
4. Deploy code update (affects all, but feature enabled per tenant)

**Example:**
```typescript
// Feature flag per tenant
const isFeatureEnabled = (feature: string, tenantId: string | null): boolean => {
  const key = tenantId ? `tms_${tenantId}_feature_${feature}` : `tms_feature_${feature}`;
  return localStorage.getItem(key) === 'true';
};
```

---

## Code Deployment vs Configuration

### Code Deployment (General)
- **When:** User says "deploy to the all"
- **What:** Application code changes
- **How:** `./deploy.sh` → Cloud Run
- **Affects:** All tenants

### Configuration Changes (Company-Specific)
- **When:** User says "deploy branding" or company-specific requests
- **What:** Settings, branding, configuration
- **How:** Update in app → localStorage (tenant-aware)
- **Affects:** Only that tenant

---

## Best Practices

### 1. Always Check Request Type
- General deployment → Full deploy
- Specific/company request → Tenant-aware changes

### 2. Use Tenant Context
```typescript
const { tenantId } = useTenant();
// Use tenantId for tenant-specific operations
```

### 3. Storage Keys
```typescript
// Always prefix with tenant ID
const getStorageKey = (tenantId: string | null, key: string): string => {
  return tenantId ? `tms_${tenantId}_${key}` : `tms_${key}`;
};
```

### 4. Company Settings
- Stored per tenant
- Accessed via CompanyContext
- Isolated per subdomain

---

## Examples

### Example 1: General Deployment
**User:** "deploy to the all"

**Response:**
```bash
# Deploying all changes to Google Cloud...
./deploy.sh
# ✅ All tenants will receive the update
```

### Example 2: Branding Update
**User:** "deploy branding"

**Response:**
- Update company settings in Settings page
- Settings saved per tenant
- Only current tenant's branding changes
- No code deployment needed (client-side)

### Example 3: Feature for Company
**User:** "deploy new feature for atsfreight"

**Response:**
- Enable feature flag for `atsfreight` tenant
- Store in tenant-aware localStorage
- Feature visible only for that company
- Code deployment if needed for the feature itself

---

## Summary

| Request Type | Action | Deployment | Scope |
|-------------|--------|------------|-------|
| "deploy to the all" | Full deployment | `./deploy.sh` | All tenants |
| "deploy branding" | Company settings | Update in app | Current tenant only |
| "deploy [feature]" | Check if tenant-specific | Code + config | Per tenant if specified |
| "deploy for [company]" | Tenant-specific | Code + tenant config | That company only |

---

**Remember:** 
- General = Deploy everything to all
- Specific = Make it tenant-aware and company-specific

