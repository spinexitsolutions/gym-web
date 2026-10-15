/** Response shapes for member/trainer endpoints that aren't in `@/types/api`. */
import type { Booking, MembershipView, PaymentView, User } from '@/types/api';

export type Ref = { _id: string; name: string; email?: string; phone?: string; avatarUrl?: string; status?: string };

export interface Goal {
  _id: string;
  title: string;
  metric: 'weight' | 'bodyFat' | 'attendance' | 'custom';
  startValue?: number;
  targetValue?: number;
  unit?: string;
  deadline?: string | null;
  status: 'active' | 'achieved' | 'abandoned';
  createdAt?: string;
}

export interface MemberProfile {
  _id: string;
  user: string;
  dateOfBirth?: string | null;
  gender?: 'male' | 'female' | 'other' | 'prefer_not';
  heightCm?: number | null;
  address?: string;
  emergencyContact?: { name?: string; phone?: string };
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  healthNotes?: string;
  goals: Goal[];
  assignedTrainer?: { _id: string; name: string; email?: string; avatarUrl?: string } | null;
  loyaltyPoints: number;
  referralCode?: string;
  progressPhotosSharedWithTrainer: boolean;
  trialUsed?: boolean;
}

export interface MeResponse {
  user: User;
  profile: MemberProfile;
}

export interface ProgressEntry {
  _id: string;
  date: string;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  measurements?: { chestCm?: number; waistCm?: number; hipsCm?: number; armCm?: number; thighCm?: number };
  notes?: string;
  recordedBy?: string;
}

export interface ProgressPhoto {
  id: string;
  takenAt: string;
  pose: 'front' | 'side' | 'back' | 'other';
  note?: string;
  url: string;
}

export interface PlanExercise {
  exercise?: string | null;
  name: string;
  sets: number;
  reps: string;
  weightKg?: number | null;
  restSec: number;
  tempo?: string;
  notes?: string;
}

export interface PlanDay {
  name: string;
  focus?: string;
  exercises: PlanExercise[];
}

export interface WorkoutPlan {
  _id: string;
  title: string;
  description?: string;
  member?: { _id: string; name: string } | string | null;
  trainer: { _id: string; name: string } | string;
  isTemplate: boolean;
  startDate?: string | null;
  endDate?: string | null;
  status: 'active' | 'archived';
  days: PlanDay[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkoutLog {
  _id: string;
  plan?: string | null;
  dayName?: string;
  performedAt: string;
  durationMin?: number;
  entries: { name: string; sets: { reps: number; weightKg: number }[] }[];
  notes?: string;
  loggedBy?: string;
}

export interface AttendanceRecord {
  _id: string;
  user?: Ref | string;
  day: string;
  checkInAt: string;
  checkOutAt?: string | null;
  method: 'qr' | 'manual' | 'class';
  gymClass?: { _id: string; title: string } | null;
}

export interface MemberDashboard {
  membership: MembershipView | null;
  upcomingMembership: MembershipView | null;
  nextBookings: Booking[];
  workoutPlan: WorkoutPlan | null;
  recentAttendance: AttendanceRecord[];
  attendanceLast30Days: number;
  progress: ProgressEntry[];
  unreadNotifications: number;
  loyaltyPoints: number;
  referralCode: string | null;
  goals: Goal[];
  lastPayment: PaymentView | null;
}

export interface LoyaltyTx {
  _id: string;
  points: number;
  reason: 'check_in' | 'referral' | 'adjustment' | 'redemption';
  note?: string;
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
  subject: string;
  category: 'membership' | 'payment' | 'booking' | 'facility' | 'account' | 'other';
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  _id: string;
  name: string;
  slug: string;
  category: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: string;
}

export interface Availability {
  day: number;
  start: string;
  end: string;
}

export interface TrainerProfileFull {
  _id: string;
  user: string;
  slug: string;
  displayName: string;
  title?: string;
  bio?: string;
  specializations: string[];
  certifications: string[];
  experienceYears: number;
  photoUrl?: string;
  instagram?: string;
  showOnWebsite: boolean;
  availability: Availability[];
  ptSessionMinutes: number;
}

export interface TrainerNote {
  _id: string;
  member: { _id: string; name: string } | string;
  body: string;
  followUpAt?: string | null;
  done: boolean;
  createdAt: string;
}

/** Raw GymClass document (trainer endpoints). */
export interface GymClassDoc {
  _id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  waitlistCount: number;
  location?: string;
  level: string;
  status: 'scheduled' | 'cancelled' | 'completed';
}

export interface AssignedMember {
  user: Ref;
  fitnessLevel?: string;
  goals: Goal[];
  healthNotes?: string;
  membership: MembershipView | null;
}

export interface MemberDetail {
  user: User;
  profile: MemberProfile | null;
  memberships: MembershipView[];
  payments: PaymentView[] | null;
  attendance: AttendanceRecord[];
  bookings: Booking[];
  workoutPlans: { _id: string; title: string; status: string; trainer?: { name: string }; updatedAt: string }[];
}

export const refName = (r: { name: string } | string | null | undefined, fallback = '—') => (r && typeof r === 'object' ? r.name : fallback);
export const refId = (r: { _id: string } | string | null | undefined) => (r && typeof r === 'object' ? r._id : (r ?? ''));
