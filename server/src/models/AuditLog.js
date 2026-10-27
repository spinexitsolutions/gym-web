import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: String,
    action: { type: String, required: true }, // 'member.suspend', 'settings.publish', ...
    entity: { type: String, required: true },
    entityId: String,
    summary: { type: String, maxlength: 500 },
    changes: mongoose.Schema.Types.Mixed, // redacted diff, never secrets
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
