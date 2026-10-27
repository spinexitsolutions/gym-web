import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout.jsx';
import { AuthLayout } from './layouts/AuthLayout.jsx';
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx';
import { PageLoader } from './components/ui/States.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { homeFor } from './utils/redirect.js';

const HomePage = lazy(() => import('./pages/public/HomePage.jsx'));
const AboutPage = lazy(() => import('./pages/public/AboutPage.jsx'));
const MembershipsPage = lazy(() => import('./pages/public/MembershipsPage.jsx'));
const ProgramsPage = lazy(() => import('./pages/public/ProgramsPage.jsx'));
const ProgramDetailPage = lazy(() => import('./pages/public/ProgramDetailPage.jsx'));
const TrainersPage = lazy(() => import('./pages/public/TrainersPage.jsx'));
const TrainerDetailPage = lazy(() => import('./pages/public/TrainerDetailPage.jsx'));
const SchedulePage = lazy(() => import('./pages/public/SchedulePage.jsx'));
const BlogPage = lazy(() => import('./pages/public/BlogPages.jsx').then((m) => ({ default: m.BlogPage })));
const BlogPostPage = lazy(() => import('./pages/public/BlogPages.jsx').then((m) => ({ default: m.BlogPostPage })));
const EventsPage = lazy(() => import('./pages/public/EventPages.jsx').then((m) => ({ default: m.EventsPage })));
const EventDetailPage = lazy(() => import('./pages/public/EventPages.jsx').then((m) => ({ default: m.EventDetailPage })));
const ContactPage = lazy(() => import('./pages/public/ContactPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage.jsx'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage.jsx'));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage.jsx'));
const MemberApp = lazy(() => import('./member/MemberApp.jsx'));
const TrainerApp = lazy(() => import('./trainer/TrainerApp.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

// Users who are already signed in when they open login/register are sent to their dashboard. The decision is
// made once, so a successful login on this page can perform its own redirect (e.g. ?next=) without a race.
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  const signedInOnArrival = useRef(null);
  if (loading) return <PageLoader />;
  if (signedInOnArrival.current === null) signedInOnArrival.current = Boolean(user);
  return signedInOnArrival.current ? <Navigate to={homeFor(user)} replace /> : children;
}

// Members get the member dashboard; staff and trainers are routed to their own areas.
function MemberArea() {
  const { user } = useAuth();
  if (user.role !== 'member') return <Navigate to={homeFor(user)} replace />;
  return <MemberApp />;
}

function AdminArea() {
  const { user } = useAuth();
  return <AdminApp user={user} />;
}

function AccountRedirect() {
  const { user } = useAuth();
  const { search } = useLocation();
  return <Navigate to={user.role === 'member' ? `/dashboard/profile${search}` : homeFor(user)} replace />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="memberships" element={<MembershipsPage />} />
            <Route path="programs" element={<ProgramsPage />} />
            <Route path="programs/:slug" element={<ProgramDetailPage />} />
            <Route path="trainers" element={<TrainersPage />} />
            <Route path="trainers/:slug" element={<TrainerDetailPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="blog" element={<BlogPage />} />
            <Route path="blog/:slug" element={<BlogPostPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="events/:slug" element={<EventDetailPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route element={<AuthLayout />}>
            <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="account" element={<AccountRedirect />} />
            <Route path="dashboard/*" element={<MemberArea />} />
          </Route>
          <Route element={<ProtectedRoute roles={['trainer']} />}>
            <Route path="trainer/*" element={<TrainerApp />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin', 'staff', 'trainer']} />}>
            <Route path="admin/*" element={<AdminArea />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
