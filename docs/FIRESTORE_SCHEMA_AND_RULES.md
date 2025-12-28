# Firestore Schema & Security Rules for Company Profile

## 📋 **FIRESTORE SCHEMA**

### Path Structure
```
tenants/{tenantId}/settings/companyProfile
```

### Document Structure
```typescript
{
  tenantId: string;                    // Required: Tenant identifier
  companyName: string;                  // Required: Company name
  legalName?: string;                   // Optional: Legal entity name
  tagline?: string;                     // Optional: Company tagline
  address1: string;                     // Required: Street address
  address2?: string;                    // Optional: Address line 2
  city: string;                         // Required: City
  state: string;                        // Required: State/Province
  zip: string;                          // Required: ZIP/Postal code
  country?: string;                     // Optional: Country (default: "United States")
  phone?: string;                       // Optional: Phone number
  email?: string;                       // Optional: Email address
  website?: string;                     // Optional: Website URL
  mcNumber?: string;                    // Optional: MC number
  dotNumber?: string;                   // Optional: DOT number
  ein?: string;                         // Optional: EIN/Tax ID
  logoUrl?: string;                     // Optional: Firebase Storage URL
  primaryColor?: string;                // Optional: Primary theme color (hex)
  accentColor?: string;                 // Optional: Accent theme color (hex)
  invoicePrefix?: string;               // Optional: Invoice prefix (default: "INV")
  settlementPrefix?: string;           // Optional: Settlement prefix (default: "SET")
  defaultFooterText?: string;           // Optional: Custom footer text for PDFs
  updatedAt: string;                    // Required: ISO timestamp
  createdAt?: string;                  // Optional: ISO timestamp
  isSetupComplete?: boolean;            // Optional: Setup wizard completion flag
}
```

---

## 🔒 **SECURITY RULES**

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function: Check if user belongs to tenant
    function isTenantUser(tenantId) {
      return request.auth != null && 
        request.auth.token.tenantId == tenantId;
    }
    
    // Company Profile - tenant-scoped read/write
    match /tenants/{tenantId}/settings/companyProfile {
      // Allow read if user belongs to tenant
      allow read: if isTenantUser(tenantId);
      
      // Allow write if:
      // 1. User belongs to tenant
      // 2. tenantId in document matches path tenantId
      // 3. Required fields are present
      allow create: if isTenantUser(tenantId) &&
        request.resource.data.tenantId == tenantId &&
        request.resource.data.keys().hasAll(['companyName', 'address1', 'city', 'state', 'zip', 'updatedAt']);
      
      allow update: if isTenantUser(tenantId) &&
        request.resource.data.tenantId == tenantId &&
        request.resource.data.tenantId == resource.data.tenantId; // Prevent tenantId change
      
      allow delete: if false; // Prevent deletion (use soft delete if needed)
    }
    
    // Logo Storage - tenant-scoped
    match /tenants/{tenantId}/logo/{logoId} {
      allow read: if request.auth != null;
      allow write: if isTenantUser(tenantId);
    }
  }
}
```

---

## 📦 **FIREBASE STORAGE RULES**

### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Helper function: Check tenant access
    function isTenantUser(tenantId) {
      return request.auth != null && 
        request.auth.token.tenantId == tenantId;
    }
    
    // Company logos - tenant-scoped
    match /tenants/{tenantId}/logo/{logoId} {
      // Allow read: anyone authenticated
      allow read: if request.auth != null;
      
      // Allow write: only tenant users
      allow write: if isTenantUser(tenantId) &&
        request.resource.size < 2 * 1024 * 1024 && // 2MB limit
        request.resource.contentType.matches('image/(png|jpeg|jpg|svg\\+xml)');
      
      // Allow delete: only tenant users
      allow delete: if isTenantUser(tenantId);
    }
  }
}
```

---

## 🔄 **MIGRATION FROM LOCALSTORAGE TO FIRESTORE**

### Step 1: Add Firestore Functions

**File**: `src/services/companyProfileService.ts` (create new)

```typescript
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { CompanyProfile } from '../types';

export async function loadCompanyProfileFromFirestore(
  tenantId: string
): Promise<CompanyProfile | null> {
  try {
    const profileRef = doc(db, `tenants/${tenantId}/settings/companyProfile`);
    const snapshot = await getDoc(profileRef);
    
    if (snapshot.exists()) {
      return snapshot.data() as CompanyProfile;
    }
    return null;
  } catch (error) {
    console.error('Error loading company profile from Firestore:', error);
    return null;
  }
}

export async function saveCompanyProfileToFirestore(
  tenantId: string,
  profile: CompanyProfile
): Promise<boolean> {
  try {
    const profileRef = doc(db, `tenants/${tenantId}/settings/companyProfile`);
    await setDoc(profileRef, profile, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving company profile to Firestore:', error);
    return false;
  }
}
```

### Step 2: Update CompanyContext

**In `src/context/CompanyContext.tsx`**:

```typescript
// Add Firestore import
import { loadCompanyProfileFromFirestore, saveCompanyProfileToFirestore } from '../services/companyProfileService';

// Update loadCompanyProfile function
const loadCompanyProfile = async () => {
  try {
    setIsLoading(true);
    
    // Try Firestore first
    if (tenantId) {
      const firestoreProfile = await loadCompanyProfileFromFirestore(tenantId);
      if (firestoreProfile) {
        setCompanyProfile(firestoreProfile);
        // Also cache in localStorage for offline
        localStorage.setItem(storageKey, JSON.stringify(firestoreProfile));
        setIsLoading(false);
        return;
      }
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      setCompanyProfile({ ...getDefaultCompanyProfile(tenantId), ...parsed });
    } else {
      setCompanyProfile(getDefaultCompanyProfile(tenantId));
    }
    
    setIsLoading(false);
  } catch (error) {
    console.error('Error loading company profile:', error);
    setCompanyProfile(getDefaultCompanyProfile(tenantId));
    setIsLoading(false);
  }
};

// Update updateCompanyProfile function
const updateCompanyProfile = async (updates: Partial<CompanyProfile>) => {
  const updated: CompanyProfile = {
    ...companyProfile,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setCompanyProfile(updated);
  
  // Save to localStorage (for offline)
  localStorage.setItem(storageKey, JSON.stringify(updated));
  
  // Save to Firestore (if tenantId available)
  if (tenantId) {
    await saveCompanyProfileToFirestore(tenantId, updated);
  }
};
```

---

## 📝 **FIRESTORE INDEXES**

No indexes required for company profile queries (single document per tenant).

---

## ✅ **VALIDATION RULES**

### Required Fields
- `tenantId` (must match path)
- `companyName`
- `address1`
- `city`
- `state`
- `zip`
- `updatedAt`

### Optional Fields
- All other fields are optional

### Format Validation
- `primaryColor` and `accentColor`: Must be valid hex color (e.g., `#1D4ED8`)
- `email`: Should be valid email format (client-side validation)
- `website`: Should be valid URL (client-side validation)
- `logoUrl`: Should be valid URL (Firebase Storage or external)

---

**END OF FIRESTORE SCHEMA DOCUMENT**


