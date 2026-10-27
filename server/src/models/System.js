import mongoose from 'mongoose';

// Atomic sequences (invoice numbers).
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = mongoose.model('Counter', counterSchema);

export async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
}

// Key/value state: job locks and last-run results.
const systemStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    lockedUntil: Date,
    lastRunAt: Date,
    lastResult: mongoose.Schema.Types.Mixed,
    lastError: String,
  },
  { timestamps: true },
);
export const SystemState = mongoose.model('SystemState', systemStateSchema);

// Server errors (5xx) shown in Admin → System. Capped so it never grows unbounded.
const errorLogSchema = new mongoose.Schema(
  {
    method: String,
    path: String,
    status: Number,
    message: { type: String, maxlength: 500 },
    stack: { type: String, maxlength: 4000 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, capped: { size: 5 * 1024 * 1024, max: 2000 } },
);
export const ErrorLog = mongoose.model('ErrorLog', errorLogSchema);

// Web push subscriptions (only stored after the user grants permission).
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: String, auth: String },
    userAgent: String,
  },
  { timestamps: true },
);
export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
