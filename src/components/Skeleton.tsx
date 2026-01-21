/**
 * Skeleton Loading Components
 *
 * Provides visual placeholders while content is loading.
 * Reduces perceived loading time and prevents layout shift.
 */

import React from 'react';

// ============================================================================
// Base Skeleton Component
// ============================================================================

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  animate?: boolean;
}

/**
 * Base skeleton component with shimmer animation
 */
export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'md',
  animate = true
}: SkeletonProps): JSX.Element {
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`bg-slate-200 ${roundedClasses[rounded]} ${animate ? 'skeleton' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// ============================================================================
// Text Skeletons
// ============================================================================

interface TextSkeletonProps {
  lines?: number;
  className?: string;
}

/**
 * Skeleton for text content (paragraphs)
 */
export function TextSkeleton({ lines = 3, className = '' }: TextSkeletonProps): JSX.Element {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={16}
          width={index === lines - 1 ? '75%' : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for a single line of text
 */
export function LineSkeleton({
  width = '100%',
  className = ''
}: {
  width?: string | number;
  className?: string;
}): JSX.Element {
  return <Skeleton height={16} width={width} rounded="sm" className={className} />;
}

// ============================================================================
// Card Skeletons
// ============================================================================

/**
 * Skeleton for stat/KPI cards
 */
export function StatCardSkeleton(): JSX.Element {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width={120} height={16} rounded="sm" />
        <Skeleton width={40} height={40} rounded="lg" />
      </div>
      <Skeleton width={80} height={32} rounded="sm" className="mb-2" />
      <Skeleton width={100} height={14} rounded="sm" />
    </div>
  );
}

/**
 * Grid of stat card skeletons
 */
export function StatCardsGridSkeleton({ count = 4 }: { count?: number }): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * Skeleton for generic content cards
 */
export function CardSkeleton({ className = '' }: { className?: string }): JSX.Element {
  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm border border-slate-100 ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <Skeleton width={48} height={48} rounded="full" />
        <div className="flex-1">
          <Skeleton width="60%" height={20} rounded="sm" className="mb-2" />
          <Skeleton width="40%" height={14} rounded="sm" />
        </div>
      </div>
      <TextSkeleton lines={2} />
    </div>
  );
}

// ============================================================================
// Table Skeletons
// ============================================================================

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

/**
 * Skeleton for table content
 */
export function TableSkeleton({
  rows = 5,
  columns = 5,
  showHeader = true,
  className = ''
}: TableSkeletonProps): JSX.Element {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton
                key={index}
                width={index === 0 ? 100 : 80}
                height={14}
                rounded="sm"
                className="flex-1"
              />
            ))}
          </div>
        </div>
      )}

      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4">
            <div className="flex items-center gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  width={colIndex === 0 ? 120 : 80}
                  height={16}
                  rounded="sm"
                  className="flex-1"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for table rows (for use inside existing tables)
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }): JSX.Element {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <Skeleton width="80%" height={16} rounded="sm" />
        </td>
      ))}
    </tr>
  );
}

// ============================================================================
// List Skeletons
// ============================================================================

interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
  className?: string;
}

/**
 * Skeleton for list items
 */
export function ListSkeleton({
  items = 5,
  showAvatar = false,
  className = ''
}: ListSkeletonProps): JSX.Element {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          {showAvatar && <Skeleton width={40} height={40} rounded="full" />}
          <div className="flex-1">
            <Skeleton width="70%" height={16} rounded="sm" className="mb-2" />
            <Skeleton width="50%" height={14} rounded="sm" />
          </div>
          <Skeleton width={60} height={24} rounded="md" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Form Skeletons
// ============================================================================

/**
 * Skeleton for form fields
 */
export function FormFieldSkeleton(): JSX.Element {
  return (
    <div className="space-y-2">
      <Skeleton width={100} height={14} rounded="sm" />
      <Skeleton width="100%" height={40} rounded="lg" />
    </div>
  );
}

/**
 * Skeleton for a form with multiple fields
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }): JSX.Element {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, index) => (
        <FormFieldSkeleton key={index} />
      ))}
      <div className="flex gap-4 pt-4">
        <Skeleton width={100} height={40} rounded="lg" />
        <Skeleton width={80} height={40} rounded="lg" />
      </div>
    </div>
  );
}

// ============================================================================
// Page Layout Skeletons
// ============================================================================

/**
 * Skeleton for page header with title and actions
 */
export function PageHeaderSkeleton(): JSX.Element {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <Skeleton width={200} height={28} rounded="sm" className="mb-2" />
        <Skeleton width={300} height={16} rounded="sm" />
      </div>
      <div className="flex gap-3">
        <Skeleton width={100} height={40} rounded="lg" />
        <Skeleton width={120} height={40} rounded="lg" />
      </div>
    </div>
  );
}

/**
 * Full page skeleton for dashboard-style layouts
 */
export function DashboardSkeleton(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsGridSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSkeleton className="h-64" />
        <CardSkeleton className="h-64" />
      </div>
      <TableSkeleton rows={5} columns={6} />
    </div>
  );
}

/**
 * Full page skeleton for list/table pages
 */
export function ListPageSkeleton(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex items-center gap-4 mb-4">
        <Skeleton width={300} height={40} rounded="lg" />
        <Skeleton width={120} height={40} rounded="lg" />
        <Skeleton width={120} height={40} rounded="lg" />
      </div>
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}

/**
 * Skeleton for detail/edit pages
 */
export function DetailPageSkeleton(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <Skeleton width={150} height={20} rounded="sm" className="mb-6" />
            <FormSkeleton fields={6} />
          </div>
        </div>
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Chart Skeletons
// ============================================================================

/**
 * Skeleton for chart containers
 */
export function ChartSkeleton({
  height = 300,
  className = ''
}: {
  height?: number;
  className?: string;
}): JSX.Element {
  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm border border-slate-100 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <Skeleton width={150} height={20} rounded="sm" />
        <div className="flex gap-2">
          <Skeleton width={60} height={28} rounded="md" />
          <Skeleton width={60} height={28} rounded="md" />
        </div>
      </div>
      <Skeleton width="100%" height={height} rounded="lg" />
    </div>
  );
}

// ============================================================================
// Inline/Button Skeletons
// ============================================================================

/**
 * Skeleton for buttons
 */
export function ButtonSkeleton({
  width = 100,
  size = 'md'
}: {
  width?: number;
  size?: 'sm' | 'md' | 'lg';
}): JSX.Element {
  const heights = { sm: 32, md: 40, lg: 48 };
  return <Skeleton width={width} height={heights[size]} rounded="lg" />;
}

/**
 * Skeleton for avatar/profile images
 */
export function AvatarSkeleton({
  size = 40
}: {
  size?: number;
}): JSX.Element {
  return <Skeleton width={size} height={size} rounded="full" />;
}

// ============================================================================
// Export all components
// ============================================================================

export default Skeleton;
