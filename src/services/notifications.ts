import { Employee, Truck, Trailer } from '../types';
import { parseDateOnlyLocal } from '../utils/dateOnly';

export type NotificationType = 'critical' | 'warning' | 'info';
export type NotificationCategory = 'cdl' | 'medical' | 'truck_registration' | 'trailer_registration' | 'truck_insurance' | 'trailer_insurance' | 'truck_inspection' | 'trailer_inspection';

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  entityId: string;
  entityName: string;
  expirationDate: string;
  daysUntilExpiration: number;
  linkTo?: string; // Page to navigate to when clicked
  createdAt: string;
}

/**
 * Calculate days until expiration
 * Uses local time parsing to avoid timezone bugs
 */
const getDaysUntilExpiration = (expirationDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Use local time parsing to avoid timezone shift bug
  const expiry = parseDateOnlyLocal(expirationDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Determine notification type based on days until expiration
 */
const getNotificationType = (daysUntilExpiration: number): NotificationType => {
  if (daysUntilExpiration <= 7) return 'critical';
  if (daysUntilExpiration <= 30) return 'warning';
  return 'info';
};

/**
 * Check driver CDL expiration
 */
export const checkDriverCDLExpiration = (drivers: Employee[]): Notification[] => {
  const notifications: Notification[] = [];
  const today = new Date().toISOString();

  drivers.forEach(driver => {
    if (driver.license?.expiration) {
      const daysUntil = getDaysUntilExpiration(driver.license.expiration);
      
      // Only notify if expiration is within 60 days
      if (daysUntil <= 60 && daysUntil >= -7) { // Allow 7 days grace period for expired
        notifications.push({
          id: `cdl-${driver.id}`,
          type: getNotificationType(daysUntil),
          category: 'cdl',
          title: `CDL Expiring: ${driver.firstName} ${driver.lastName}`,
          message: daysUntil < 0 
            ? `CDL expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`
            : daysUntil === 0
            ? 'CDL expires today'
            : `CDL expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          entityId: driver.id,
          entityName: `${driver.firstName} ${driver.lastName}`,
          expirationDate: driver.license.expiration,
          daysUntilExpiration: daysUntil,
          linkTo: 'Drivers',
          createdAt: today,
        });
      }
    }
  });

  return notifications;
};

/**
 * Check driver medical expiration
 */
export const checkDriverMedicalExpiration = (drivers: Employee[]): Notification[] => {
  const notifications: Notification[] = [];
  const today = new Date().toISOString();

  drivers.forEach(driver => {
    if (driver.medicalExpirationDate) {
      const daysUntil = getDaysUntilExpiration(driver.medicalExpirationDate);
      
      // Only notify if expiration is within 60 days
      if (daysUntil <= 60 && daysUntil >= -7) {
        notifications.push({
          id: `medical-${driver.id}`,
          type: getNotificationType(daysUntil),
          category: 'medical',
          title: `Medical Card Expiring: ${driver.firstName} ${driver.lastName}`,
          message: daysUntil < 0 
            ? `Medical card expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`
            : daysUntil === 0
            ? 'Medical card expires today'
            : `Medical card expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          entityId: driver.id,
          entityName: `${driver.firstName} ${driver.lastName}`,
          expirationDate: driver.medicalExpirationDate,
          daysUntilExpiration: daysUntil,
          linkTo: 'Drivers',
          createdAt: today,
        });
      }
    }
  });

  return notifications;
};

/**
 * Check truck registration expiration
 */
export const checkTruckRegistrationExpiration = (trucks: Truck[]): Notification[] => {
  const notifications: Notification[] = [];
  const today = new Date().toISOString();

  trucks.forEach(truck => {
    if (truck.registrationExpiry) {
      const daysUntil = getDaysUntilExpiration(truck.registrationExpiry);
      
      if (daysUntil <= 60 && daysUntil >= -7) {
        notifications.push({
          id: `truck-reg-${truck.id}`,
          type: getNotificationType(daysUntil),
          category: 'truck_registration',
          title: `Truck Registration Expiring: ${truck.number}`,
          message: daysUntil < 0 
            ? `Registration expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`
            : daysUntil === 0
            ? 'Registration expires today'
            : `Registration expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          entityId: truck.id,
          entityName: truck.number,
          expirationDate: truck.registrationExpiry,
          daysUntilExpiration: daysUntil,
          linkTo: 'Fleet',
          createdAt: today,
        });
      }
    }
  });

  return notifications;
};

/**
 * Check trailer registration expiration
 */
export const checkTrailerRegistrationExpiration = (trailers: Trailer[]): Notification[] => {
  const notifications: Notification[] = [];
  const today = new Date().toISOString();

  trailers.forEach(trailer => {
    if (trailer.registrationExpiry) {
      const daysUntil = getDaysUntilExpiration(trailer.registrationExpiry);
      
      if (daysUntil <= 60 && daysUntil >= -7) {
        notifications.push({
          id: `trailer-reg-${trailer.id}`,
          type: getNotificationType(daysUntil),
          category: 'trailer_registration',
          title: `Trailer Registration Expiring: ${trailer.number}`,
          message: daysUntil < 0 
            ? `Registration expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`
            : daysUntil === 0
            ? 'Registration expires today'
            : `Registration expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          entityId: trailer.id,
          entityName: trailer.number,
          expirationDate: trailer.registrationExpiry,
          daysUntilExpiration: daysUntil,
          linkTo: 'Fleet',
          createdAt: today,
        });
      }
    }
  });

  return notifications;
};

/**
 * Check truck insurance expiration
 */
export const checkTruckInsuranceExpiration = (trucks: Truck[]): Notification[] => {
  const notifications: Notification[] = [];
  const today = new Date().toISOString();

  trucks.forEach(truck => {
    if (truck.insuranceExpirationDate) {
      const daysUntil = getDaysUntilExpiration(truck.insuranceExpirationDate);
      
      if (daysUntil <= 60 && daysUntil >= -7) {
        notifications.push({
          id: `truck-ins-${truck.id}`,
          type: getNotificationType(daysUntil),
          category: 'truck_insurance',
          title: `Truck Insurance Expiring: ${truck.number}`,
          message: daysUntil < 0 
            ? `Insurance expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`
            : daysUntil === 0
            ? 'Insurance expires today'
            : `Insurance expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          entityId: truck.id,
          entityName: truck.number,
          expirationDate: truck.insuranceExpirationDate,
          daysUntilExpiration: daysUntil,
          linkTo: 'Fleet',
          createdAt: today,
        });
      }
    }
  });

  return notifications;
};

/**
 * Check trailer insurance expiration
 */
export const checkTrailerInsuranceExpiration = (trailers: Trailer[]): Notification[] => {
  const notifications: Notification[] = [];
  const today = new Date().toISOString();

  trailers.forEach(trailer => {
    if (trailer.insuranceExpirationDate) {
      const daysUntil = getDaysUntilExpiration(trailer.insuranceExpirationDate);
      
      if (daysUntil <= 60 && daysUntil >= -7) {
        notifications.push({
          id: `trailer-ins-${trailer.id}`,
          type: getNotificationType(daysUntil),
          category: 'trailer_insurance',
          title: `Trailer Insurance Expiring: ${trailer.number}`,
          message: daysUntil < 0 
            ? `Insurance expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`
            : daysUntil === 0
            ? 'Insurance expires today'
            : `Insurance expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          entityId: trailer.id,
          entityName: trailer.number,
          expirationDate: trailer.insuranceExpirationDate,
          daysUntilExpiration: daysUntil,
          linkTo: 'Fleet',
          createdAt: today,
        });
      }
    }
  });

  return notifications;
};

/**
 * Check truck inspection due dates
 */
export const checkTruckInspection = (trucks: Truck[]): Notification[] => {
  const notifications: Notification[] = [];
  const today = new Date().toISOString();

  trucks.forEach(truck => {
    if (truck.inspectionDueDate) {
      const daysUntil = getDaysUntilExpiration(truck.inspectionDueDate);
      
      if (daysUntil <= 30 && daysUntil >= -7) {
        notifications.push({
          id: `truck-insp-${truck.id}`,
          type: getNotificationType(daysUntil),
          category: 'truck_inspection',
          title: `Truck Inspection Due: ${truck.number}`,
          message: daysUntil < 0 
            ? `Inspection overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'}`
            : daysUntil === 0
            ? 'Inspection due today'
            : `Inspection due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          entityId: truck.id,
          entityName: truck.number,
          expirationDate: truck.inspectionDueDate,
          daysUntilExpiration: daysUntil,
          linkTo: 'Fleet',
          createdAt: today,
        });
      }
    }
  });

  return notifications;
};

/**
 * Check trailer inspection due dates
 */
export const checkTrailerInspection = (trailers: Trailer[]): Notification[] => {
  const notifications: Notification[] = [];
  const today = new Date().toISOString();

  trailers.forEach(trailer => {
    if (trailer.inspectionDueDate) {
      const daysUntil = getDaysUntilExpiration(trailer.inspectionDueDate);
      
      if (daysUntil <= 30 && daysUntil >= -7) {
        notifications.push({
          id: `trailer-insp-${trailer.id}`,
          type: getNotificationType(daysUntil),
          category: 'trailer_inspection',
          title: `Trailer Inspection Due: ${trailer.number}`,
          message: daysUntil < 0 
            ? `Inspection overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'}`
            : daysUntil === 0
            ? 'Inspection due today'
            : `Inspection due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          entityId: trailer.id,
          entityName: trailer.number,
          expirationDate: trailer.inspectionDueDate,
          daysUntilExpiration: daysUntil,
          linkTo: 'Fleet',
          createdAt: today,
        });
      }
    }
  });

  return notifications;
};

/**
 * Get all notifications from all sources
 */
export const getAllNotifications = (
  drivers: Employee[],
  trucks: Truck[],
  trailers: Trailer[]
): Notification[] => {
  const allNotifications: Notification[] = [
    ...checkDriverCDLExpiration(drivers),
    ...checkDriverMedicalExpiration(drivers),
    ...checkTruckRegistrationExpiration(trucks),
    ...checkTrailerRegistrationExpiration(trailers),
    ...checkTruckInsuranceExpiration(trucks),
    ...checkTrailerInsuranceExpiration(trailers),
    ...checkTruckInspection(trucks),
    ...checkTrailerInspection(trailers),
  ];

  // Sort by priority: critical first, then by days until expiration
  return allNotifications.sort((a, b) => {
    const typeOrder = { critical: 0, warning: 1, info: 2 };
    const typeDiff = typeOrder[a.type] - typeOrder[b.type];
    if (typeDiff !== 0) return typeDiff;
    return a.daysUntilExpiration - b.daysUntilExpiration;
  });
};

/**
 * Simple notification service for user-facing messages
 * Used by errorHandler and other services to display user notifications
 * 
 * TODO: Replace with a proper toast notification library (e.g., react-hot-toast, sonner)
 */
export const notifications = {
  /**
   * Show an error notification
   */
  error: (message: string) => {
    console.error('[Notification]', message);
    // TODO: Show toast/alert UI
    // For now, use browser alert in development
    if (import.meta.env.DEV) {
      // In development, log to console
      // In production, this would show a toast notification
    }
  },

  /**
   * Show a warning notification
   */
  warning: (message: string) => {
    console.warn('[Notification]', message);
    // TODO: Show toast/alert UI
  },

  /**
   * Show an info notification
   */
  info: (message: string) => {
    console.info('[Notification]', message);
    // TODO: Show toast/alert UI
  },

  /**
   * Show a success notification
   */
  success: (message: string) => {
    console.log('[Notification]', message);
    // TODO: Show toast/alert UI
  },
};