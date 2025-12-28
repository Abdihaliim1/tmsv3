# Workflow: What Happens When You Create a Load

**Date**: 2025-01-27

---

## CURRENT STATUS: ⚠️ NOT YET INTEGRATED

**Important**: The workflow rules are **defined** but **NOT YET HOOKED UP** to the `addLoad()` function.

**Current Behavior**: When you create a load, **NO tasks are created** because the workflow trigger is not called.

---

## WHAT SHOULD HAPPEN (When Integrated)

When you create a load, the following **3 tasks** should be automatically created:

### Task 1: Assign Driver
- **Title**: "Assign driver to load"
- **Priority**: High
- **Due**: 1 hour after load creation
- **Assigned to**: Dispatch team
- **Description**: "A new load has been created and needs a driver assignment."
- **Tags**: `load`, `dispatch`

### Task 2: Send Rate Confirmation
- **Title**: "Send rate confirmation"
- **Priority**: Medium
- **Due**: 2 hours after load creation
- **Assigned to**: Dispatch team
- **Description**: "Rate confirmation document needs to be sent to customer."
- **Tags**: `load`, `document`

### Task 3: Confirm Pickup Appointment
- **Title**: "Confirm pickup appointment"
- **Priority**: Medium
- **Due**: 4 hours after load creation
- **Assigned to**: Dispatch team
- **Description**: "Confirm pickup appointment time with shipper."
- **Tags**: `load`, `pickup`

---

## WORKFLOW RULE DEFINITION

The rule is defined in: `src/services/workflow/workflowRules.ts:15-54`

```typescript
{
  id: 'rule_load_created',
  name: 'Load Created - Initial Tasks',
  isEnabled: true,
  eventType: 'LOAD_CREATED',
  actions: [
    // Task 1: Assign driver (high priority, 1 hour)
    // Task 2: Send rate confirmation (medium priority, 2 hours)
    // Task 3: Confirm pickup appointment (medium priority, 4 hours)
  ]
}
```

---

## HOW TO INTEGRATE (What's Missing)

To make workflows actually run, you need to:

### Step 1: Import workflow trigger in TMSContext.tsx

```typescript
import { triggerLoadCreated } from '../services/workflow/workflowEngine';
```

### Step 2: Call trigger in addLoad() function

In `src/context/TMSContext.tsx`, after creating the load:

```typescript
const addLoad = (input: NewLoadInput) => {
  const newLoadId = Math.random().toString(36).substr(2, 9);
  const newLoad: Load = {
    ...input,
    id: newLoadId,
    loadNumber: `LD-2025-${(loads.length + 301).toString()}`,
  };

  // Update Loads State
  setLoads([newLoad, ...loads]);

  // ⬇️ ADD THIS: Trigger workflow
  triggerLoadCreated(newLoad.id, {
    loadNumber: newLoad.loadNumber,
    brokerName: newLoad.brokerName,
    customerName: newLoad.customerName,
    createdBy: 'current-user-id', // Get from auth context
  });

  // ... rest of existing logic
};
```

---

## OTHER WORKFLOW EVENTS (Also Not Integrated)

### When Load Status Changes to "Dispatched"

Should create:
1. **Confirm pickup (same day)** - High priority, due in 30 minutes
2. **Track in-transit update** - Medium priority, due in 24 hours

### When Load Status Changes to "Delivered"

Should create:
1. **Collect POD** - High priority, due in 1 hour, BLOCKED until POD uploaded
2. **Generate invoice** - Medium priority, due in 2 hours, BLOCKED until POD uploaded

---

## INTEGRATION STATUS

| Event | Status | Integrated? |
|-------|--------|-------------|
| Load Created | ⚠️ Rules defined | ❌ Not hooked up |
| Load Status → Dispatched | ⚠️ Rules defined | ❌ Not hooked up |
| Load Status → Delivered | ⚠️ Rules defined | ❌ Not hooked up |
| Invoice Created | ⚠️ Rules defined | ❌ Not hooked up |
| Invoice Overdue | ⚠️ Rules defined | ❌ Not hooked up |

---

## FILES TO MODIFY FOR INTEGRATION

1. **`src/context/TMSContext.tsx`**:
   - Import `triggerLoadCreated` from workflowEngine
   - Call it in `addLoad()` after creating load
   - Import `triggerLoadStatusChanged` from workflowEngine
   - Call it in `updateLoad()` when status changes
   - Import `triggerLoadDelivered` from workflowEngine
   - Call it when status becomes "delivered"

2. **Add tasks to TMSContext**:
   - Add `tasks` state (load from localStorage using taskService)
   - Add task CRUD functions to context
   - Expose tasks in context interface

---

## CURRENT WORKFLOW SYSTEM STATUS

**Foundation Complete**: ✅
- Task service with idempotency
- Workflow rules defined
- Workflow engine ready
- Guardrails implemented

**Integration Needed**: ❌
- Tasks not in TMSContext
- Triggers not called
- Tasks.tsx page not created
- TasksWidget not on Dashboard

---

**END OF DOCUMENTATION**


