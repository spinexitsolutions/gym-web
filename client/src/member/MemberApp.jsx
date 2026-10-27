import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LayoutDashboard, Crown, CreditCard, CalendarPlus, QrCode, TrendingUp, ClipboardList, Trophy, Bell, LifeBuoy, Star, Bot, UserRound } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import NotFoundPage from '../pages/public/NotFoundPage.jsx';

const Home = lazy(() => import('./pages/HomePage.jsx'));
const Membership = lazy(() => import('./pages/MembershipPage.jsx'));
const Payments = lazy(() => import('./pages/PaymentsPage.jsx'));
const Book = lazy(() => import('./pages/BookPage.jsx'));
const CheckIn = lazy(() => import('./pages/CheckInPage.jsx'));
const Progress = lazy(() => import('./pages/ProgressPage.jsx'));
const Profile = lazy(() => import('../pages/member/AccountPage.jsx'));
const misc = (name) => lazy(() => import('./pages/MiscPages.jsx').then((m) => ({ default: m[name] })));
const Workouts = misc('WorkoutsPage');
const Notifications = misc('NotificationsPage');
const Support = misc('SupportPage');
const SupportTicket = misc('SupportTicketPage');
const Reviews = misc('ReviewsPage');
const Challenges = misc('ChallengesPage');
const Assistant = misc('AssistantPage');

const NAV = [
  { items: [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/dashboard/check-in', label: 'Check-in QR', icon: QrCode },
    { to: '/dashboard/book', label: 'Book', icon: CalendarPlus },
  ] },
  { group: 'Training', items: [
    { to: '/dashboard/workouts', label: 'Workout plans', icon: ClipboardList },
    { to: '/dashboard/progress', label: 'Progress', icon: TrendingUp },
    { to: '/dashboard/challenges', label: 'Challenges', icon: Trophy },
    { to: '/dashboard/assistant', label: 'AI assistant', icon: Bot },
  ] },
  { group: 'Account', items: [
    { to: '/dashboard/membership', label: 'Membership', icon: Crown },
    { to: '/dashboard/payments', label: 'Payments', icon: CreditCard },
    { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
    { to: '/dashboard/support', label: 'Support', icon: LifeBuoy },
    { to: '/dashboard/feedback', label: 'Feedback', icon: Star },
    { to: '/dashboard/profile', label: 'Profile & settings', icon: UserRound },
  ] },
];

export default function MemberApp() {
  return (
    <Routes>
      <Route element={<DashboardLayout nav={NAV} title="Member" notificationsHref="/dashboard/notifications" />}>
        <Route index element={<Home />} />
        <Route path="membership" element={<Membership />} />
        <Route path="payments" element={<Payments />} />
        <Route path="book" element={<Book />} />
        <Route path="bookings" element={<Book />} />
        <Route path="check-in" element={<CheckIn />} />
        <Route path="progress" element={<Progress />} />
        <Route path="workouts" element={<Workouts />} />
        <Route path="challenges" element={<Challenges />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="support" element={<Support />} />
        <Route path="support/:id" element={<SupportTicket />} />
        <Route path="feedback" element={<Reviews />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
