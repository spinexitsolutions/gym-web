import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, ScanLine, Users, Crown, CalendarDays, CalendarClock, CreditCard, Inbox, LifeBuoy, Star, Globe, Tags, Dumbbell,
  ClipboardList, Image, Quote, HelpCircle, Trophy, Megaphone, Newspaper, Ticket, BarChart3, UserCog, ScrollText, Activity,
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { ResourcePage } from '../components/dashboard/ResourcePage.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as R from './resources.jsx';
import NotFoundPage from '../pages/public/NotFoundPage.jsx';

const OverviewPage = lazy(() => import('./pages/OverviewPage.jsx'));
const WebsitePage = lazy(() => import('./pages/WebsitePage.jsx'));
const MembersPage = lazy(() => import('./pages/MembersPage.jsx'));
const MemberDetailPage = lazy(() => import('./pages/MemberDetailPage.jsx'));
const MembershipsPage = lazy(() => import('./pages/MembershipsPage.jsx'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage.jsx'));
const ClassesPage = lazy(() => import('./pages/ClassesPage.jsx'));
const BookingsPage = lazy(() => import('./pages/BookingsPage.jsx'));
const CheckInPage = lazy(() => import('./pages/CheckInPage.jsx'));
const Inbox_ = lazy(() => import('./pages/InboxPages.jsx').then((m) => ({ default: m.InquiriesPage })));
const SupportList = lazy(() => import('./pages/InboxPages.jsx').then((m) => ({ default: m.SupportListPage })));
const SupportTicket = lazy(() => import('./pages/InboxPages.jsx').then((m) => ({ default: m.SupportTicketPage })));
const Reviews = lazy(() => import('./pages/InboxPages.jsx').then((m) => ({ default: m.ReviewsPage })));
const Staff = lazy(() => import('./pages/TeamPages.jsx').then((m) => ({ default: m.StaffPage })));
const Audit = lazy(() => import('./pages/TeamPages.jsx').then((m) => ({ default: m.AuditPage })));
const System = lazy(() => import('./pages/TeamPages.jsx').then((m) => ({ default: m.SystemPage })));
const Reports = lazy(() => import('./pages/TeamPages.jsx').then((m) => ({ default: m.ReportsPage })));

const ADMIN = ['admin'];
const DESK = ['admin', 'staff'];

export const ADMIN_NAV = [
  { items: [{ to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, roles: ADMIN }] },
  { group: 'Front desk', items: [
    { to: '/admin/check-in', label: 'Check-in', icon: ScanLine, roles: ['admin', 'staff', 'trainer'] },
    { to: '/admin/members', label: 'Members', icon: Users, roles: DESK },
    { to: '/admin/memberships', label: 'Memberships', icon: Crown, roles: DESK },
    { to: '/admin/bookings', label: 'Bookings', icon: CalendarClock, roles: DESK },
    { to: '/admin/classes', label: 'Classes', icon: CalendarDays, roles: ADMIN },
    { to: '/admin/payments', label: 'Payments', icon: CreditCard, roles: DESK },
  ] },
  { group: 'Inbox', items: [
    { to: '/admin/inquiries', label: 'Inquiries', icon: Inbox, roles: DESK },
    { to: '/admin/support', label: 'Support', icon: LifeBuoy, roles: DESK },
    { to: '/admin/reviews', label: 'Reviews', icon: Star, roles: ADMIN },
  ] },
  { group: 'Website', items: [
    { to: '/admin/website', label: 'Site content & theme', icon: Globe, roles: ADMIN },
    { to: '/admin/plans', label: 'Membership plans', icon: Tags, roles: ADMIN },
    { to: '/admin/trainers', label: 'Trainers', icon: Dumbbell, roles: ADMIN },
    { to: '/admin/programs', label: 'Programs', icon: ClipboardList, roles: ADMIN },
    { to: '/admin/gallery', label: 'Gallery', icon: Image, roles: ADMIN },
    { to: '/admin/testimonials', label: 'Testimonials', icon: Quote, roles: ADMIN },
    { to: '/admin/faqs', label: 'FAQs', icon: HelpCircle, roles: ADMIN },
    { to: '/admin/events', label: 'Events & challenges', icon: Trophy, roles: ADMIN },
    { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, roles: ADMIN },
    { to: '/admin/blog', label: 'Blog', icon: Newspaper, roles: ADMIN },
    { to: '/admin/coupons', label: 'Coupons', icon: Ticket, roles: ADMIN },
  ] },
  { group: 'Business', items: [
    { to: '/admin/reports', label: 'Reports', icon: BarChart3, roles: ADMIN },
    { to: '/admin/team', label: 'Team & roles', icon: UserCog, roles: ADMIN },
    { to: '/admin/audit', label: 'Audit log', icon: ScrollText, roles: ADMIN },
    { to: '/admin/system', label: 'System status', icon: Activity, roles: ADMIN },
  ] },
];

function AnnouncementsResource() {
  const toast = useToast();
  const qc = useQueryClient();
  return <ResourcePage config={R.announcementsConfig(toast, qc)} />;
}

// Staff land on members, trainers on check-in; admins on the overview.
function Home({ role }) {
  if (role === 'trainer') return <Navigate to="/admin/check-in" replace />;
  if (role === 'staff') return <Navigate to="/admin/members" replace />;
  return <OverviewPage />;
}

export default function AdminApp({ user }) {
  return (
    <Routes>
      <Route element={<DashboardLayout nav={ADMIN_NAV} title="Admin" notificationsHref={null} />}>
        <Route index element={<Home role={user.role} />} />
        <Route path="check-in" element={<CheckInPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/:id" element={<MemberDetailPage />} />
        <Route path="memberships" element={<MembershipsPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="inquiries" element={<Inbox_ />} />
        <Route path="support" element={<SupportList />} />
        <Route path="support/:id" element={<SupportTicket />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="website" element={<WebsitePage />} />
        <Route path="plans" element={<ResourcePage key="plans" config={R.plansConfig} />} />
        <Route path="trainers" element={<ResourcePage key="trainers" config={R.trainersConfig} />} />
        <Route path="programs" element={<ResourcePage key="programs" config={R.programsConfig} />} />
        <Route path="gallery" element={<ResourcePage key="gallery" config={R.galleryConfig} />} />
        <Route path="testimonials" element={<ResourcePage key="testimonials" config={R.testimonialsConfig} />} />
        <Route path="faqs" element={<ResourcePage key="faqs" config={R.faqsConfig} />} />
        <Route path="events" element={<ResourcePage key="events" config={R.eventsConfig} />} />
        <Route path="announcements" element={<AnnouncementsResource />} />
        <Route path="blog" element={<ResourcePage key="blog" config={R.blogConfig} />} />
        <Route path="coupons" element={<ResourcePage key="coupons" config={R.couponsConfig} />} />
        <Route path="reports" element={<Reports />} />
        <Route path="team" element={<Staff />} />
        <Route path="audit" element={<Audit />} />
        <Route path="system" element={<System />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
