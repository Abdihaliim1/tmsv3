/**
 * Smart Alerts Engine
 * 
 * Rule-based alert system for TMS operations.
 * Generates alerts for:
 * - Missing documents (POD, BOL, Rate Con)
 * - Invoice overdue
 * - Low margin loads
 * - Accessorial receipts missing
 * - Broker restrictions
 */

import { Load, Invoice, DocumentType, TmsDocument } from '../types';
import { getMissingDocuments, getLatestDocument } from './documentService';
import { LoadStatus } from '../types';
import { parseDateOnlyLocal } from '../utils/dateOnly';

export type AlertType = 
  | 'MISSING_POD'
  | 'MISSING_BOL'
  | 'MISSING_RATE_CON'
  | 'INVOICE_OVERDUE'
  | 'INVOICE_NOT_CREATED'
  | 'LOW_MARGIN'
  | 'MISSING_ACCESSORIAL_RECEIPT'
  | 'BROKER_RESTRICTED'
  | 'DOCUMENT_EXPIRING'
  | 'DOCUMENT_EXPIRED';

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  entityType: 'load' | 'invoice' | 'settlement' | 'truck';
  entityId: string;
  entityName?: string; // e.g., load number, invoice number
  createdAt: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  actionUrl?: string; // URL to fix the issue
}

/**
 * Generate alerts for a load
 */
export function generateLoadAlerts(load: Load): Alert[] {
  const alerts: Alert[] = [];
  const documents = load.documents || [];
  const now = new Date();

  // Missing POD for delivered loads
  if (load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed) {
    const hasPOD = documents.some(d => d.type === 'POD');
    if (!hasPOD) {
      alerts.push({
        id: `alert-${load.id}-missing-pod`,
        type: 'MISSING_POD',
        severity: 'critical',
        title: 'Missing Proof of Delivery',
        message: `Load ${load.loadNumber} was delivered but POD is missing.`,
        entityType: 'load',
        entityId: load.id,
        entityName: load.loadNumber,
        createdAt: new Date().toISOString(),
        actionUrl: `/loads/${load.id}?action=upload-pod`,
      });
    }
  }

  // Missing BOL
  const hasBOL = documents.some(d => d.type === 'BOL');
  if (!hasBOL) {
    alerts.push({
      id: `alert-${load.id}-missing-bol`,
      type: 'MISSING_BOL',
      severity: 'warning',
      title: 'Missing Bill of Lading',
      message: `Load ${load.loadNumber} is missing BOL.`,
      entityType: 'load',
      entityId: load.id,
      entityName: load.loadNumber,
      createdAt: new Date().toISOString(),
      actionUrl: `/loads/${load.id}?action=upload-bol`,
    });
  }

  // Missing Rate Confirmation
  const hasRateCon = documents.some(d => d.type === 'RATE_CON');
  if (!hasRateCon) {
    alerts.push({
      id: `alert-${load.id}-missing-rate-con`,
      type: 'MISSING_RATE_CON',
      severity: 'warning',
      title: 'Missing Rate Confirmation',
      message: `Load ${load.loadNumber} is missing Rate Confirmation.`,
      entityType: 'load',
      entityId: load.id,
      entityName: load.loadNumber,
      createdAt: new Date().toISOString(),
      actionUrl: `/loads/${load.id}?action=upload-rate-con`,
    });
  }

  // Invoice not created after delivery
  if (load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed) {
    const daysSinceDelivery = load.deliveryDate 
      ? Math.floor((now.getTime() - parseDateOnlyLocal(load.deliveryDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    if (!load.invoiceId && daysSinceDelivery > 3) {
      alerts.push({
        id: `alert-${load.id}-invoice-not-created`,
        type: 'INVOICE_NOT_CREATED',
        severity: 'warning',
        title: 'Invoice Not Created',
        message: `Load ${load.loadNumber} was delivered ${daysSinceDelivery} days ago but invoice hasn't been created.`,
        entityType: 'load',
        entityId: load.id,
        entityName: load.loadNumber,
        createdAt: new Date().toISOString(),
        actionUrl: `/invoices?action=create&loadId=${load.id}`,
      });
    }
  }

  // Low margin load
  if (load.rate && load.miles && load.driverBasePay) {
    const revenue = load.rate;
    const driverPay = load.driverBasePay;
    const margin = revenue - driverPay;
    const marginPercent = (margin / revenue) * 100;
    
    if (marginPercent < 10 && marginPercent > 0) {
      alerts.push({
        id: `alert-${load.id}-low-margin`,
        type: 'LOW_MARGIN',
        severity: 'warning',
        title: 'Low Margin Load',
        message: `Load ${load.loadNumber} has a low margin (${marginPercent.toFixed(1)}%).`,
        entityType: 'load',
        entityId: load.id,
        entityName: load.loadNumber,
        createdAt: new Date().toISOString(),
        actionUrl: `/loads/${load.id}`,
      });
    } else if (marginPercent <= 0) {
      alerts.push({
        id: `alert-${load.id}-negative-margin`,
        type: 'LOW_MARGIN',
        severity: 'critical',
        title: 'Negative Margin Load',
        message: `Load ${load.loadNumber} has a negative margin.`,
        entityType: 'load',
        entityId: load.id,
        entityName: load.loadNumber,
        createdAt: new Date().toISOString(),
        actionUrl: `/loads/${load.id}`,
      });
    }
  }

  // Missing accessorial receipts
  if (load.hasDetention && load.detentionAmount) {
    const hasDetentionReceipt = documents.some(d => 
      d.type === 'RECEIPT' && d.tags?.includes('detention')
    );
    if (!hasDetentionReceipt) {
      alerts.push({
        id: `alert-${load.id}-missing-detention-receipt`,
        type: 'MISSING_ACCESSORIAL_RECEIPT',
        severity: 'info',
        title: 'Missing Detention Receipt',
        message: `Load ${load.loadNumber} has detention charges but no receipt uploaded.`,
        entityType: 'load',
        entityId: load.id,
        entityName: load.loadNumber,
        createdAt: new Date().toISOString(),
        actionUrl: `/loads/${load.id}?action=upload-receipt`,
      });
    }
  }

  if (load.hasLayover && load.layoverAmount) {
    const hasLayoverReceipt = documents.some(d => 
      d.type === 'RECEIPT' && d.tags?.includes('layover')
    );
    if (!hasLayoverReceipt) {
      alerts.push({
        id: `alert-${load.id}-missing-layover-receipt`,
        type: 'MISSING_ACCESSORIAL_RECEIPT',
        severity: 'info',
        title: 'Missing Layover Receipt',
        message: `Load ${load.loadNumber} has layover charges but no receipt uploaded.`,
        entityType: 'load',
        entityId: load.id,
        entityName: load.loadNumber,
        createdAt: new Date().toISOString(),
        actionUrl: `/loads/${load.id}?action=upload-receipt`,
      });
    }
  }

  // Document expiration alerts
  documents.forEach(doc => {
    if (doc.expiresAt) {
      // Use local date parsing to avoid timezone shift bug
      const expiryDate = parseDateOnlyLocal(doc.expiresAt);
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        alerts.push({
          id: `alert-${load.id}-doc-expired-${doc.id}`,
          type: 'DOCUMENT_EXPIRED',
          severity: 'critical',
          title: 'Document Expired',
          message: `${doc.type} document for load ${load.loadNumber} expired ${Math.abs(daysUntilExpiry)} days ago.`,
          entityType: 'load',
          entityId: load.id,
          entityName: load.loadNumber,
          createdAt: new Date().toISOString(),
          actionUrl: `/loads/${load.id}?action=view-documents`,
        });
      } else if (daysUntilExpiry <= 30) {
        alerts.push({
          id: `alert-${load.id}-doc-expiring-${doc.id}`,
          type: 'DOCUMENT_EXPIRING',
          severity: 'warning',
          title: 'Document Expiring Soon',
          message: `${doc.type} document for load ${load.loadNumber} expires in ${daysUntilExpiry} days.`,
          entityType: 'load',
          entityId: load.id,
          entityName: load.loadNumber,
          createdAt: new Date().toISOString(),
          actionUrl: `/loads/${load.id}?action=view-documents`,
        });
      }
    }
  });

  return alerts;
}

/**
 * Generate alerts for an invoice
 */
export function generateInvoiceAlerts(invoice: Invoice): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();

  // Invoice overdue
  if (invoice.status === 'pending' && invoice.dueDate) {
    // Use local date parsing to avoid timezone shift bug
    const dueDate = parseDateOnlyLocal(invoice.dueDate);
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysOverdue > 0) {
      alerts.push({
        id: `alert-${invoice.id}-overdue`,
        type: 'INVOICE_OVERDUE',
        severity: 'critical',
        title: 'Invoice Overdue',
        message: `Invoice ${invoice.invoiceNumber} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue.`,
        entityType: 'invoice',
        entityId: invoice.id,
        entityName: invoice.invoiceNumber,
        createdAt: new Date().toISOString(),
        actionUrl: `/invoices/${invoice.id}`,
      });
    }
  }

  // Missing receipt for paid invoice
  if (invoice.status === 'paid') {
    const documents = (invoice as any).documents || [];
    const hasReceipt = documents.some((d: TmsDocument) => d.type === 'RECEIPT');
    if (!hasReceipt) {
      alerts.push({
        id: `alert-${invoice.id}-missing-receipt`,
        type: 'MISSING_ACCESSORIAL_RECEIPT',
        severity: 'info',
        title: 'Missing Payment Receipt',
        message: `Invoice ${invoice.invoiceNumber} is marked as paid but no receipt uploaded.`,
        entityType: 'invoice',
        entityId: invoice.id,
        entityName: invoice.invoiceNumber,
        createdAt: new Date().toISOString(),
        actionUrl: `/invoices/${invoice.id}?action=upload-receipt`,
      });
    }
  }

  return alerts;
}

/**
 * Generate all alerts for dashboard
 */
export function generateAllAlerts(
  loads: Load[],
  invoices: Invoice[]
): Alert[] {
  const alerts: Alert[] = [];

  // Generate load alerts
  loads.forEach(load => {
    alerts.push(...generateLoadAlerts(load));
  });

  // Generate invoice alerts
  invoices.forEach(invoice => {
    alerts.push(...generateInvoiceAlerts(invoice));
  });

  // Sort by severity (critical first) and date (newest first)
  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Get alert count by severity
 */
export function getAlertCounts(alerts: Alert[]): {
  critical: number;
  warning: number;
  info: number;
  total: number;
} {
  return {
    critical: alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length,
    warning: alerts.filter(a => a.severity === 'warning' && !a.acknowledged).length,
    info: alerts.filter(a => a.severity === 'info' && !a.acknowledged).length,
    total: alerts.filter(a => !a.acknowledged).length,
  };
}

