/**
 * Firebase Cloud Functions Entry Point
 *
 * Server-side business logic for critical operations
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export load functions
export { deleteLoad, updateLoad } from './loads';

// Export invoice functions
export { deleteInvoice, generateInvoice } from './invoices';

// Export settlement functions
export { calculateSettlement, deleteSettlement } from './settlements';
