/**
 * Unit Tests for Alerts Service
 */

import { describe, it, expect } from 'vitest';
import {
  generateLoadAlerts,
  generateInvoiceAlerts,
  generateAllAlerts,
  getAlertCounts,
  Alert,
} from '../alertsService';
import { Load, Invoice, LoadStatus } from '../../types';

describe('Alerts Service', () => {
  describe('generateLoadAlerts', () => {
    it('should generate missing POD alert for delivered load', () => {
      const load: Load = {
        id: 'load-1',
        loadNumber: 'LD-2025-1001',
        status: LoadStatus.Delivered,
        deliveryDate: new Date().toISOString().split('T')[0],
        documents: [],
        originCity: 'Columbus',
        originState: 'OH',
        destCity: 'Chicago',
        destState: 'IL',
        rate: 1000,
        miles: 500,
        pickupDate: new Date().toISOString().split('T')[0],
      };

      const alerts = generateLoadAlerts(load);
      const podAlert = alerts.find(a => a.type === 'MISSING_POD');

      expect(podAlert).toBeDefined();
      expect(podAlert?.severity).toBe('critical');
      expect(podAlert?.entityId).toBe('load-1');
    });

    it('should not generate POD alert if POD exists', () => {
      const load: Load = {
        id: 'load-1',
        loadNumber: 'LD-2025-1001',
        status: LoadStatus.Delivered,
        deliveryDate: new Date().toISOString().split('T')[0],
        documents: [
          {
            id: 'doc-1',
            type: 'POD',
            entityType: 'load',
            entityId: 'load-1',
            fileName: 'pod.pdf',
            fileType: 'application/pdf',
            fileSize: 1000,
            storagePath: 'path',
            url: 'url',
            uploadedBy: 'user',
            uploadedAt: new Date().toISOString(),
            verified: false,
            version: 1,
          },
        ],
        originCity: 'Columbus',
        originState: 'OH',
        destCity: 'Chicago',
        destState: 'IL',
        rate: 1000,
        miles: 500,
        pickupDate: new Date().toISOString().split('T')[0],
      };

      const alerts = generateLoadAlerts(load);
      const podAlert = alerts.find(a => a.type === 'MISSING_POD');

      expect(podAlert).toBeUndefined();
    });

    it('should generate low margin alert', () => {
      const load: Load = {
        id: 'load-1',
        loadNumber: 'LD-2025-1001',
        status: LoadStatus.Delivered,
        rate: 1000,
        miles: 500,
        driverBasePay: 950, // 95% of rate = 5% margin
        originCity: 'Columbus',
        originState: 'OH',
        destCity: 'Chicago',
        destState: 'IL',
        pickupDate: new Date().toISOString().split('T')[0],
        deliveryDate: new Date().toISOString().split('T')[0],
        documents: [],
      };

      const alerts = generateLoadAlerts(load);
      const marginAlert = alerts.find(a => a.type === 'LOW_MARGIN');

      expect(marginAlert).toBeDefined();
      expect(marginAlert?.severity).toBe('warning');
    });

    it('should generate negative margin alert as critical', () => {
      const load: Load = {
        id: 'load-1',
        loadNumber: 'LD-2025-1001',
        status: LoadStatus.Delivered,
        rate: 1000,
        miles: 500,
        driverBasePay: 1100, // More than rate = negative margin
        originCity: 'Columbus',
        originState: 'OH',
        destCity: 'Chicago',
        destState: 'IL',
        pickupDate: new Date().toISOString().split('T')[0],
        deliveryDate: new Date().toISOString().split('T')[0],
        documents: [],
      };

      const alerts = generateLoadAlerts(load);
      const marginAlert = alerts.find(a => a.type === 'LOW_MARGIN');

      expect(marginAlert).toBeDefined();
      expect(marginAlert?.severity).toBe('critical');
    });
  });

  describe('generateInvoiceAlerts', () => {
    it('should generate overdue alert for past due invoice', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

      const invoice: Invoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-2025-1001',
        status: 'pending',
        amount: 1000,
        date: new Date().toISOString().split('T')[0],
        dueDate: pastDate.toISOString().split('T')[0],
        loadIds: [],
      };

      const alerts = generateInvoiceAlerts(invoice);
      const overdueAlert = alerts.find(a => a.type === 'INVOICE_OVERDUE');

      expect(overdueAlert).toBeDefined();
      expect(overdueAlert?.severity).toBe('critical');
    });

    it('should not generate overdue alert for paid invoice', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const invoice: Invoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-2025-1001',
        status: 'paid',
        amount: 1000,
        date: new Date().toISOString().split('T')[0],
        dueDate: pastDate.toISOString().split('T')[0],
        loadIds: [],
      };

      const alerts = generateInvoiceAlerts(invoice);
      const overdueAlert = alerts.find(a => a.type === 'INVOICE_OVERDUE');

      expect(overdueAlert).toBeUndefined();
    });
  });

  describe('getAlertCounts', () => {
    it('should count alerts by severity', () => {
      const alerts: Alert[] = [
        {
          id: '1',
          type: 'MISSING_POD',
          severity: 'critical',
          title: 'Test',
          message: 'Test',
          entityType: 'load',
          entityId: '1',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'MISSING_BOL',
          severity: 'warning',
          title: 'Test',
          message: 'Test',
          entityType: 'load',
          entityId: '2',
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          type: 'MISSING_RATE_CON',
          severity: 'info',
          title: 'Test',
          message: 'Test',
          entityType: 'load',
          entityId: '3',
          createdAt: new Date().toISOString(),
        },
      ];

      const counts = getAlertCounts(alerts);

      expect(counts.critical).toBe(1);
      expect(counts.warning).toBe(1);
      expect(counts.info).toBe(1);
      expect(counts.total).toBe(3);
    });

    it('should exclude acknowledged alerts', () => {
      const alerts: Alert[] = [
        {
          id: '1',
          type: 'MISSING_POD',
          severity: 'critical',
          title: 'Test',
          message: 'Test',
          entityType: 'load',
          entityId: '1',
          createdAt: new Date().toISOString(),
          acknowledged: true,
        },
        {
          id: '2',
          type: 'MISSING_BOL',
          severity: 'warning',
          title: 'Test',
          message: 'Test',
          entityType: 'load',
          entityId: '2',
          createdAt: new Date().toISOString(),
        },
      ];

      const counts = getAlertCounts(alerts);

      expect(counts.critical).toBe(0);
      expect(counts.warning).toBe(1);
      expect(counts.total).toBe(1);
    });
  });
});


