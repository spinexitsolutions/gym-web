import { Suspense, lazy, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/app/RequireAuth';
import { PageLoader } from '@/components/ui';
import { RouteErrorBoundary } from '@/components/layout/ErrorBoundary';

const L = (factory: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(factory);
  return <C />;
};

/* Public */
const PublicLayout = lazy(() => import('@/layouts/PublicLayout'));
/* Dashboards */
const AdminLayout = lazy(() => import('@/admin/AdminLayout'));
const MemberLayout = lazy(() => import('@/member/MemberLayout'));
const TrainerLayout = lazy(() => import('@/trainer/TrainerLayout'));

const Guard = ({ children, ...p }: { children: ReactNode } & Parameters<typeof RequireAuth>[0]) => <RequireAuth {...p}>{children}</RequireAuth>;

export default function App() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth (standalone layout) */}
          <Route path="/login" element={L(() => import('@/pages/auth/LoginPage'))} />
          <Route path="/register" element={L(() => import('@/pages/auth/RegisterPage'))} />
          <Route path="/forgot-password" element={L(() => import('@/pages/auth/ForgotPasswordPage'))} />
          <Route path="/reset-password" element={L(() => import('@/pages/auth/ResetPasswordPage'))} />
          <Route path="/verify-email" element={L(() => import('@/pages/auth/VerifyEmailPage'))} />

          {/* Admin draft preview (rendered inside the public chrome, admin-only) */}
          <Route
            path="/preview/:pageId"
            element={
              <Guard permission="cms:write">
                <PublicLayout />
              </Guard>
            }
          >
            <Route index element={L(() => import('@/pages/public/PreviewPage'))} />
          </Route>

          {/* Member */}
          <Route
            path="/member"
            element={
              <Guard roles={['member']}>
                <MemberLayout />
              </Guard>
            }
          >
            <Route index element={L(() => import('@/member/pages/DashboardPage'))} />
            <Route path="membership" element={L(() => import('@/member/pages/MembershipPage'))} />
            <Route path="checkout/:planId" element={L(() => import('@/member/pages/CheckoutPage'))} />
            <Route path="payments" element={L(() => import('@/member/pages/PaymentsPage'))} />
            <Route path="bookings" element={L(() => import('@/member/pages/BookingsPage'))} />
            <Route path="book" element={L(() => import('@/member/pages/BookClassesPage'))} />
            <Route path="personal-training" element={L(() => import('@/member/pages/PersonalTrainingPage'))} />
            <Route path="workouts" element={L(() => import('@/member/pages/WorkoutsPage'))} />
            <Route path="progress" element={L(() => import('@/member/pages/ProgressPage'))} />
            <Route path="attendance" element={L(() => import('@/member/pages/AttendancePage'))} />
            <Route path="rewards" element={L(() => import('@/member/pages/LoyaltyPage'))} />
            <Route path="notifications" element={L(() => import('@/features/notifications/NotificationsPage'))} />
            <Route path="support" element={L(() => import('@/member/pages/SupportPage'))} />
            <Route path="support/:id" element={L(() => import('@/member/pages/SupportTicketPage'))} />
            <Route path="profile" element={L(() => import('@/member/pages/ProfilePage'))} />
            <Route path="settings" element={L(() => import('@/member/pages/SettingsPage'))} />
          </Route>

          {/* Trainer */}
          <Route
            path="/trainer"
            element={
              <Guard roles={['trainer']}>
                <TrainerLayout />
              </Guard>
            }
          >
            <Route index element={L(() => import('@/trainer/pages/DashboardPage'))} />
            <Route path="members" element={L(() => import('@/trainer/pages/MembersPage'))} />
            <Route path="members/:id" element={L(() => import('@/trainer/pages/MemberDetailPage'))} />
            <Route path="schedule" element={L(() => import('@/trainer/pages/SchedulePage'))} />
            <Route path="workouts" element={L(() => import('@/trainer/pages/WorkoutPlansPage'))} />
            <Route path="notes" element={L(() => import('@/trainer/pages/NotesPage'))} />
            <Route path="profile" element={L(() => import('@/trainer/pages/ProfilePage'))} />
            <Route path="check-in" element={L(() => import('@/trainer/pages/CheckInPage'))} />
            <Route path="notifications" element={L(() => import('@/features/notifications/NotificationsPage'))} />
          </Route>

          {/* Admin (staff with permissions can also reach permitted pages) */}
          <Route
            path="/admin"
            element={
              <Guard roles={['admin', 'trainer']}>
                <AdminLayout />
              </Guard>
            }
          >
            <Route index element={<Guard permission="reports:read">{L(() => import('@/admin/pages/OverviewPage'))}</Guard>} />
            <Route path="members" element={<Guard permission="members:read">{L(() => import('@/admin/pages/MembersPage'))}</Guard>} />
            <Route path="members/:id" element={<Guard permission="members:read">{L(() => import('@/admin/pages/MemberDetailPage'))}</Guard>} />
            <Route path="memberships" element={<Guard permission="members:read">{L(() => import('@/admin/pages/MembershipsPage'))}</Guard>} />
            <Route path="check-in" element={<Guard permission="attendance:write">{L(() => import('@/admin/pages/CheckInPage'))}</Guard>} />
            <Route path="classes" element={<Guard permission="classes:write">{L(() => import('@/admin/pages/ClassesPage'))}</Guard>} />
            <Route path="bookings" element={<Guard permission="classes:write">{L(() => import('@/admin/pages/BookingsPage'))}</Guard>} />
            <Route path="trainers" element={<Guard permission="trainers:write">{L(() => import('@/admin/pages/TrainersPage'))}</Guard>} />
            <Route path="exercises" element={<Guard permission="classes:write">{L(() => import('@/admin/pages/ExercisesPage'))}</Guard>} />
            <Route path="support" element={<Guard permission="support:write">{L(() => import('@/admin/pages/SupportPage'))}</Guard>} />
            <Route path="support/:id" element={<Guard permission="support:write">{L(() => import('@/admin/pages/SupportTicketPage'))}</Guard>} />
            <Route path="payments" element={<Guard permission="payments:read">{L(() => import('@/admin/pages/PaymentsPage'))}</Guard>} />
            <Route path="plans" element={<Guard permission="plans:write">{L(() => import('@/admin/pages/PlansPage'))}</Guard>} />
            <Route path="coupons" element={<Guard permission="plans:write">{L(() => import('@/admin/pages/CouponsPage'))}</Guard>} />
            <Route path="campaigns" element={<Guard permission="members:write">{L(() => import('@/admin/pages/CampaignsPage'))}</Guard>} />
            <Route path="reports" element={<Guard permission="reports:read">{L(() => import('@/admin/pages/ReportsPage'))}</Guard>} />
            <Route path="settings" element={<Guard permission="settings:write">{L(() => import('@/admin/pages/SettingsPage'))}</Guard>} />
            <Route path="staff" element={<Guard roles={['admin']}>{L(() => import('@/admin/pages/StaffPage'))}</Guard>} />
            <Route path="audit" element={<Guard permission="audit:read">{L(() => import('@/admin/pages/AuditLogPage'))}</Guard>} />
            <Route path="notifications" element={L(() => import('@/features/notifications/NotificationsPage'))} />
            <Route path="website/pages" element={<Guard permission="cms:write">{L(() => import('@/admin/cms/PagesListPage'))}</Guard>} />
            <Route path="website/pages/:id" element={<Guard permission="cms:write">{L(() => import('@/admin/cms/PageBuilderPage'))}</Guard>} />
            <Route path="website/theme" element={<Guard permission="cms:write">{L(() => import('@/admin/cms/ThemePage'))}</Guard>} />
            <Route path="website/media" element={<Guard permission="media:write">{L(() => import('@/admin/cms/MediaPage'))}</Guard>} />
            <Route path="website/models" element={<Guard permission="media:write">{L(() => import('@/admin/cms/ModelsPage'))}</Guard>} />
            <Route path="website/content/:collection" element={<Guard permission="cms:write">{L(() => import('@/admin/cms/ContentPage'))}</Guard>} />
            <Route path="website/blog" element={<Guard permission="cms:write">{L(() => import('@/admin/cms/BlogAdminPage'))}</Guard>} />
            <Route path="website/blog/:id" element={<Guard permission="cms:write">{L(() => import('@/admin/cms/BlogEditorPage'))}</Guard>} />
            <Route path="website/reviews" element={<Guard permission="cms:write">{L(() => import('@/admin/cms/ReviewsPage'))}</Guard>} />
            <Route path="website/messages" element={<Guard permission="cms:write">{L(() => import('@/admin/cms/MessagesPage'))}</Guard>} />
            <Route path="website/subscribers" element={<Guard permission="cms:write">{L(() => import('@/admin/cms/SubscribersPage'))}</Guard>} />
          </Route>

          {/* Public website */}
          <Route element={<PublicLayout />}>
            <Route index element={L(() => import('@/pages/public/HomePage'))} />
            <Route path="programs" element={L(() => import('@/pages/public/ProgramsPage'))} />
            <Route path="programs/:slug" element={L(() => import('@/pages/public/ProgramDetailPage'))} />
            <Route path="trainers" element={L(() => import('@/pages/public/TrainersPage'))} />
            <Route path="trainers/:slug" element={L(() => import('@/pages/public/TrainerDetailPage'))} />
            <Route path="memberships" element={L(() => import('@/pages/public/MembershipsPage'))} />
            <Route path="schedule" element={L(() => import('@/pages/public/SchedulePage'))} />
            <Route path="blog" element={L(() => import('@/pages/public/BlogPage'))} />
            <Route path="blog/:slug" element={L(() => import('@/pages/public/BlogPostPage'))} />
            <Route path="contact" element={L(() => import('@/pages/public/ContactPage'))} />
            <Route path="unsubscribe" element={L(() => import('@/pages/public/UnsubscribePage'))} />
            <Route path=":slug" element={L(() => import('@/pages/public/CmsPage'))} />
            <Route path="*" element={L(() => import('@/pages/public/NotFoundPage'))} />
          </Route>
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}
