/** Admin-side API shapes (as returned by the server routes). */
import type { Booking, MembershipView, PaymentView, Plan, User } from '@/types/api';

export interface Ref {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface MemberRow extends User {
  membership: MembershipView | null;
  assignedTrainer: { _id: string; name: string } | null;
}

export interface MemberProfile {
  _id: string;
  user: string;
  assignedTrainer?: { _id: string; name: string; email?: string } | null;
  dateOfBirth?: string | null;
  gender?: string;
  heightCm?: number | null;
  address?: string;
  emergencyContact?: { name?: string; phone?: string };
  fitnessLevel?: string;
  healthNotes?: string;
  loyaltyPoints?: number;
  referralCode?: string;
  goals?: { _id: string; title: string; status: string }[];
}

export interface AttendanceRecord {
  _id: string;
  user: Ref | string;
  day: string;
  checkInAt: string;
  checkOutAt?: string | null;
  method: 'qr' | 'manual' | 'class';
  gymClass?: { _id: string; title: string } | null;
}

export interface MemberDetail {
  user: User;
  profile: MemberProfile | null;
  memberships: MembershipView[];
  payments: PaymentView[] | null;
  attendance: AttendanceRecord[];
  bookings: Booking[];
  workoutPlans: { _id: string; title: string; status: string; trainer?: { _id: string; name: string } | null; updatedAt: string }[];
}

export interface AdminMembership extends MembershipView {
  user: Ref | null;
  cancelReason: string | null;
}

export interface AdminPayment extends PaymentView {
  user: Ref | null;
}

export interface PaymentsStatus {
  provider: 'razorpay' | 'sandbox' | 'disabled';
  configured: boolean;
  testMode: boolean;
  webhookConfigured: boolean;
}

export interface AdminPlan extends Plan {
  createdAt?: string;
}

export interface Coupon {
  _id: string;
  code: string;
  description?: string;
  type: 'percent' | 'flat';
  value: number;
  maxDiscountMinor?: number | null;
  minAmountMinor?: number;
  validFrom?: string | null;
  validUntil?: string | null;
  usageLimit?: number | null;
  usedCount?: number;
  perUserLimit?: number;
  plans: string[];
  newMembersOnly?: boolean;
  active: boolean;
  campaign?: string;
  createdAt?: string;
}

export interface AvailabilitySlot {
  day: number;
  start: string;
  end: string;
}

export interface AdminTrainer {
  _id: string;
  user: { _id: string; name: string; email: string; phone?: string; status: string; avatarUrl?: string; permissions?: string[] };
  slug: string;
  displayName: string;
  title?: string;
  bio?: string;
  specializations: string[];
  certifications: string[];
  experienceYears: number;
  photoUrl?: string;
  instagram?: string;
  availability: AvailabilitySlot[];
  ptSessionMinutes?: number;
  showOnWebsite: boolean;
  order: number;
  maxClients?: number;
  assignedMembers: number;
}

export interface RosterBooking {
  _id: string;
  user: Ref | null;
  status: Booking['status'];
  startsAt: string;
  createdAt: string;
}

export interface RosterResponse {
  class: { _id: string; title: string; startsAt: string; endsAt: string; capacity: number; bookedCount: number; waitlistCount: number; location?: string; status: string };
  bookings: RosterBooking[];
}

export interface Exercise {
  _id: string;
  name: string;
  slug: string;
  category: 'strength' | 'cardio' | 'mobility' | 'conditioning' | 'core' | 'olympic' | 'other';
  muscleGroups: string[];
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions?: string;
  mediaUrl?: string;
  videoUrl?: string;
}

export interface AuditEntry {
  _id: string;
  actor?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entity: string;
  entityId?: string;
  summary?: string;
  changes?: unknown;
  ip?: string;
  createdAt: string;
}

export interface SupportMessage {
  _id: string;
  author: string;
  authorName?: string;
  staff: boolean;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  _id: string;
  user: Ref | null;
  subject: string;
  category: string;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface Overview {
  totalMembers: number;
  activeMembers: number;
  expiredMemberships: number;
  expiringIn7Days: number;
  expiringIn14Days: number;
  newRegistrations30d: number;
  revenue30dMinor: number;
  revenueThisMonthMinor: number;
  refunds30dMinor: number;
  pendingPayments: number;
  failedPayments7d: number;
  attendanceToday: number;
  pendingTrials: number;
  upcomingClasses: { _id: string; title: string; trainer?: { _id: string; name: string } | null; startsAt: string; endsAt: string; capacity: number; bookedCount: number; waitlistCount: number; location?: string }[];
  recentActivity: AuditEntry[];
  recentSignups: { _id: string; name: string; email: string; createdAt: string }[];
  timezone: string;
}

export interface RevenueRow {
  period: string;
  grossMinor: number;
  refundsMinor: number;
  netMinor: number;
  onlineMinor: number;
  offlineMinor: number;
  payments: number;
}
export interface CountRow {
  period: string;
  count: number;
}
export interface PlanPerfRow {
  planId: string;
  planName: string;
  sales: number;
  revenueMinor: number;
  activeMemberships: number;
}
export interface BookingSummary {
  byStatus: { type: string; status: string; count: number }[];
  attendance: CountRow[];
  classes: { sessions: number; fillRate: number };
}

export interface SystemStatus {
  environment: string;
  payments: PaymentsStatus;
  email: { configured: boolean; from: string };
  whatsapp: { provider: string; configured: boolean };
  storage: { driver: string; maxImageMb: number; maxModelMb: number };
  emailVerificationRequired: boolean;
  jobsEnabled: boolean;
  jobs: { _id: string; name: string; lastStartedAt?: string; lastFinishedAt?: string; lastStatus?: string; lastError?: string; lastResult?: unknown }[];
}

export interface UploadedAsset {
  _id: string;
  url: string;
  variants?: { width: number; url: string }[];
}
