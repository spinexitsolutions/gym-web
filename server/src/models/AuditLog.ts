import { Schema, model, type InferSchemaType } from 'mongoose';

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorName: String,
    actorRole: String,
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: String,
    summary: { type: String, maxlength: 300 },
    changes: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ createdAt: -1 });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export const AuditLogModel = model('AuditLog', auditLogSchema);
