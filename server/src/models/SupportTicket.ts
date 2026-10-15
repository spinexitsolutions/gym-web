import { Schema, model, type InferSchemaType } from 'mongoose';

const supportTicketSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, maxlength: 140 },
    category: { type: String, enum: ['membership', 'payment', 'booking', 'facility', 'account', 'other'], default: 'other' },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open', index: true },
    messages: [
      {
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: String,
        staff: { type: Boolean, default: false },
        body: { type: String, required: true, maxlength: 4000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export type SupportTicket = InferSchemaType<typeof supportTicketSchema>;
export const SupportTicketModel = model('SupportTicket', supportTicketSchema);
