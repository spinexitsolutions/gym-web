import { Schema, model, type InferSchemaType } from 'mongoose';

const trainerNoteSchema = new Schema(
  {
    trainer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, maxlength: 2000 },
    followUpAt: Date,
    done: { type: Boolean, default: false },
  },
  { timestamps: true },
);
trainerNoteSchema.index({ trainer: 1, done: 1, followUpAt: 1 });

export type TrainerNote = InferSchemaType<typeof trainerNoteSchema>;
export const TrainerNoteModel = model('TrainerNote', trainerNoteSchema);
