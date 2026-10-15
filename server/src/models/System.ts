import { Schema, model } from 'mongoose';

/** Monotonic counters (receipt numbers). */
const counterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });
export const CounterModel = model('Counter', counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return doc!.seq;
}

/** Distributed lock + bookkeeping for scheduled jobs (safe with multiple server instances). */
const jobStateSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    lockedUntil: { type: Date, default: new Date(0) },
    lockedBy: String,
    lastStartedAt: Date,
    lastFinishedAt: Date,
    lastStatus: { type: String, enum: ['ok', 'error'] },
    lastError: String,
    lastResult: Schema.Types.Mixed,
  },
  { timestamps: true },
);
export const JobStateModel = model('JobState', jobStateSchema);

/** Processed provider webhook events (idempotency). */
const webhookEventSchema = new Schema(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    type: String,
    status: { type: String, enum: ['processing', 'processed', 'ignored', 'failed'], default: 'processing' },
    error: String,
  },
  { timestamps: true },
);
webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
export const WebhookEventModel = model('WebhookEvent', webhookEventSchema);

/** Loyalty points ledger. `key` makes each award idempotent. */
const loyaltyTransactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    points: { type: Number, required: true },
    reason: { type: String, enum: ['check_in', 'referral', 'adjustment', 'redemption'], required: true },
    key: { type: String, required: true, unique: true },
    note: String,
  },
  { timestamps: true },
);
export const LoyaltyTransactionModel = model('LoyaltyTransaction', loyaltyTransactionSchema);
