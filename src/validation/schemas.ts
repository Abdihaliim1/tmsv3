/**
 * Runtime Validation Schemas with Zod
 * 
 * Provides type-safe validation and automatic sanitization for all entity types.
 * 
 * Features:
 * - Type-safe validation
 * - Automatic sanitization of string fields
 * - Transform functions for data normalization
 * - Error messages for user feedback
 */

import { z } from "zod";
import { sanitizeText } from "../security/sanitize";

/**
 * Helper: Sanitize string field
 */
const sanitizeString = (val: string | undefined) => {
  if (!val) return val;
  return sanitizeText(val);
};

/**
 * Load Status Enum
 */
export const LoadStatusEnum = z.enum([
  "CREATED",
  "BOOKED",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "INVOICED",
  "PAID",
  "COMPLETED",
  "CANCELLED",
]);

/**
 * Load Schema
 */
export const LoadSchema = z.object({
  id: z.string().min(1),
  loadNumber: z.string().min(1),
  status: LoadStatusEnum,
  brokerId: z.string().min(1, "Broker is required"),
  brokerName: z.string().optional(),
  customerName: z.string().optional().transform(sanitizeString),
  driverId: z.string().optional(),
  driverName: z.string().optional().transform(sanitizeString),
  originCity: z.string().min(1, "Origin city is required").transform(sanitizeString),
  originState: z.string().length(2, "State must be 2 characters").transform(sanitizeString),
  destCity: z.string().min(1, "Destination city is required").transform(sanitizeString),
  destState: z.string().length(2, "State must be 2 characters").transform(sanitizeString),
  rate: z.number().min(0, "Rate must be positive"),
  miles: z.number().min(1, "Miles must be at least 1"),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  notes: z.string().optional().transform(sanitizeString),
  createdAt: z.string().optional(),
  createdBy: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * Invoice Schema
 */
export const InvoiceSchema = z.object({
  id: z.string().min(1),
  invoiceNumber: z.string().min(1),
  loadIds: z.array(z.string()).min(1, "At least one load is required"),
  customerName: z.string().optional().transform(sanitizeString),
  amount: z.number().min(0, "Amount must be positive"),
  status: z.enum(["pending", "paid", "overdue", "cancelled"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  notes: z.string().optional().transform(sanitizeString),
});

/**
 * Settlement Schema
 */
export const SettlementSchema = z.object({
  id: z.string().min(1),
  settlementNumber: z.string().min(1),
  driverId: z.string().min(1, "Driver is required"),
  driverName: z.string().min(1),
  grossPay: z.number().min(0),
  totalDeductions: z.number().min(0),
  netPay: z.number(),
  status: z.enum(["pending", "paid", "cancelled"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  notes: z.string().optional().transform(sanitizeString),
});

/**
 * Driver Schema
 */
export const DriverSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1, "First name is required").transform(sanitizeString),
  lastName: z.string().min(1, "Last name is required").transform(sanitizeString),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().optional().transform(sanitizeString),
  licenseNumber: z.string().optional().transform(sanitizeString),
  licenseState: z.string().length(2, "State must be 2 characters").optional(),
  employeeType: z.enum(["driver", "dispatcher", "admin", "owner", "other"]),
  status: z.enum(["active", "inactive", "terminated"]),
  notes: z.string().optional().transform(sanitizeString),
});

/**
 * Truck Schema
 */
export const TruckSchema = z.object({
  id: z.string().min(1),
  unitNumber: z.string().min(1, "Unit number is required").transform(sanitizeString),
  make: z.string().optional().transform(sanitizeString),
  model: z.string().optional().transform(sanitizeString),
  year: z.number().int().min(1900).max(2100).optional(),
  vin: z.string().optional().transform(sanitizeString),
  licensePlate: z.string().optional().transform(sanitizeString),
  licenseState: z.string().length(2, "State must be 2 characters").optional(),
  status: z.enum(["active", "inactive", "maintenance", "retired"]),
  notes: z.string().optional().transform(sanitizeString),
});

/**
 * Expense Schema
 */
export const ExpenseSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1, "Category is required"),
  amount: z.number().min(0, "Amount must be positive"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  description: z.string().optional().transform(sanitizeString),
  loadId: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  notes: z.string().optional().transform(sanitizeString),
});

/**
 * Validate and sanitize data using a schema
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and sanitized data
 * @throws ZodError if validation fails
 */
export function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe validation that returns errors instead of throwing
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Object with success flag and data/errors
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

/**
 * Get user-friendly error messages from Zod error
 * 
 * @param error - Zod error
 * @returns Array of error messages
 */
export function getValidationErrors(error: z.ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}


