import { Bell, CalendarDays, ClipboardList, LayoutDashboard, NotebookPen, ScanLine, UserCog, Users } from 'lucide-react';
import { DashboardLayout, type NavGroup } from '@/layouts/DashboardLayout';

export const trainerNav: NavGroup[] = [
  { items: [{ to: '/trainer', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'Coaching',
    items: [
      { to: '/trainer/members', label: 'My members', icon: Users },
      { to: '/trainer/schedule', label: 'Schedule & attendance', icon: CalendarDays },
      { to: '/trainer/workouts', label: 'Workout plans', icon: ClipboardList },
      { to: '/trainer/notes', label: 'Notes & follow-ups', icon: NotebookPen },
      { to: '/trainer/check-in', label: 'Check-in', icon: ScanLine },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/trainer/profile', label: 'Profile & availability', icon: UserCog },
      { to: '/trainer/notifications', label: 'Notifications', icon: Bell },
    ],
  },
];

export default function TrainerLayout() {
  return <DashboardLayout area="Trainer" nav={trainerNav} notificationsHref="/trainer/notifications" />;
}
