import { Bell, CalendarCheck, CalendarPlus, CreditCard, Dumbbell, Gift, LayoutDashboard, LifeBuoy, LineChart, QrCode, Settings, Ticket, User, UserRound } from 'lucide-react';
import { DashboardLayout, type NavGroup } from '@/layouts/DashboardLayout';

export const memberNav: NavGroup[] = [
  { items: [{ to: '/member', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'Training',
    items: [
      { to: '/member/book', label: 'Book a class', icon: CalendarPlus },
      { to: '/member/personal-training', label: 'Personal training', icon: UserRound },
      { to: '/member/bookings', label: 'My bookings', icon: CalendarCheck },
      { to: '/member/workouts', label: 'Workouts', icon: Dumbbell },
      { to: '/member/progress', label: 'Progress', icon: LineChart },
      { to: '/member/attendance', label: 'Check-in & attendance', icon: QrCode },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/member/membership', label: 'Membership', icon: Ticket },
      { to: '/member/payments', label: 'Payments & receipts', icon: CreditCard },
      { to: '/member/rewards', label: 'Rewards & referrals', icon: Gift },
      { to: '/member/notifications', label: 'Notifications', icon: Bell },
      { to: '/member/support', label: 'Support', icon: LifeBuoy },
      { to: '/member/profile', label: 'Profile', icon: User },
      { to: '/member/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function MemberLayout() {
  return <DashboardLayout area="Member" nav={memberNav} notificationsHref="/member/notifications" />;
}
