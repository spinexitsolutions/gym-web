export const ROLES = ['admin', 'trainer', 'member'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Fine-grained permissions. Admins implicitly hold every permission.
 * Trainers/members can be explicitly granted extra permissions by an admin.
 */
export const PERMISSIONS = [
  'cms:write',
  'media:write',
  'members:read',
  'members:write',
  'plans:write',
  'payments:read',
  'payments:write',
  'classes:write',
  'trainers:write',
  'reports:read',
  'settings:write',
  'attendance:write',
  'support:write',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'cms:write': 'Edit website content, pages and theme',
  'media:write': 'Upload and manage media',
  'members:read': 'View all members',
  'members:write': 'Create and edit members',
  'plans:write': 'Manage membership plans and coupons',
  'payments:read': 'View payments and revenue',
  'payments:write': 'Record offline payments and refunds',
  'classes:write': 'Manage classes and schedules',
  'trainers:write': 'Manage trainers',
  'reports:read': 'View analytics and export reports',
  'settings:write': 'Change system settings',
  'attendance:write': 'Check members in (all members)',
  'support:write': 'Respond to support tickets',
  'audit:read': 'View audit logs',
};

export const ACCOUNT_STATUSES = ['active', 'suspended', 'pending'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
