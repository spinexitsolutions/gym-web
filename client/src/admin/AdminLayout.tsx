import {
  BarChart3,
  Bell,
  BookOpen,
  Box,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Dumbbell,
  FileText,
  Image,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  Mail,
  Megaphone,
  MessageSquareQuote,
  Palette,
  ScanLine,
  Settings,
  ShieldCheck,
  Tag,
  Ticket,
  UserCog,
  Users,
} from 'lucide-react';
import { DashboardLayout, type NavGroup } from '@/layouts/DashboardLayout';

export const adminNav: NavGroup[] = [
  { items: [{ to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, permission: 'reports:read' }] },
  {
    label: 'Operations',
    items: [
      { to: '/admin/members', label: 'Members', icon: Users, permission: 'members:read' },
      { to: '/admin/memberships', label: 'Memberships', icon: Ticket, permission: 'members:read' },
      { to: '/admin/check-in', label: 'Check-in', icon: ScanLine, permission: 'attendance:write' },
      { to: '/admin/classes', label: 'Classes', icon: CalendarDays, permission: 'classes:write' },
      { to: '/admin/bookings', label: 'Bookings & trials', icon: CalendarClock, permission: 'classes:write' },
      { to: '/admin/trainers', label: 'Trainers', icon: Dumbbell, permission: 'trainers:write' },
      { to: '/admin/exercises', label: 'Exercise library', icon: ClipboardList, permission: 'classes:write' },
      { to: '/admin/support', label: 'Support', icon: LifeBuoy, permission: 'support:write' },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { to: '/admin/payments', label: 'Payments', icon: CreditCard, permission: 'payments:read' },
      { to: '/admin/plans', label: 'Plans', icon: Box, permission: 'plans:write' },
      { to: '/admin/coupons', label: 'Coupons', icon: Tag, permission: 'plans:write' },
      { to: '/admin/campaigns', label: 'Campaigns', icon: Megaphone, permission: 'members:write' },
      { to: '/admin/reports', label: 'Reports', icon: BarChart3, permission: 'reports:read' },
    ],
  },
  {
    label: 'Website',
    items: [
      { to: '/admin/website/pages', label: 'Pages & sections', icon: LayoutTemplate, permission: 'cms:write' },
      { to: '/admin/website/theme', label: 'Theme & brand', icon: Palette, permission: 'cms:write' },
      { to: '/admin/website/media', label: 'Media library', icon: Image, permission: 'media:write' },
      { to: '/admin/website/models', label: '3D models', icon: Box, permission: 'media:write' },
      { to: '/admin/website/content/programs', label: 'Content', icon: BookOpen, permission: 'cms:write' },
      { to: '/admin/website/blog', label: 'Blog', icon: FileText, permission: 'cms:write' },
      { to: '/admin/website/reviews', label: 'Reviews', icon: MessageSquareQuote, permission: 'cms:write' },
      { to: '/admin/website/messages', label: 'Messages', icon: Inbox, permission: 'cms:write' },
      { to: '/admin/website/subscribers', label: 'Subscribers', icon: Mail, permission: 'cms:write' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/settings', label: 'Settings', icon: Settings, permission: 'settings:write' },
      { to: '/admin/staff', label: 'Staff & permissions', icon: UserCog },
      { to: '/admin/audit', label: 'Audit log', icon: ShieldCheck, permission: 'audit:read' },
      { to: '/admin/notifications', label: 'Notifications', icon: Bell },
    ],
  },
];

export default function AdminLayout() {
  return <DashboardLayout area="Admin" nav={adminNav} notificationsHref="/admin/notifications" />;
}

