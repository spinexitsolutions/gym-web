import { Schema, model, type InferSchemaType } from 'mongoose';

const testimonialSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    subtitle: { type: String, maxlength: 100 },
    quote: { type: String, required: true, maxlength: 1000 },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    avatarUrl: { type: String, maxlength: 1000, default: '' },
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 50 },
  },
  { timestamps: true },
);

export type Testimonial = InferSchemaType<typeof testimonialSchema>;
export const TestimonialModel = model('Testimonial', testimonialSchema);
