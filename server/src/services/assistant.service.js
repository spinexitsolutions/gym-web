import Anthropic from '@anthropic-ai/sdk';
import env from '../config/env.js';
import { WorkoutProgram } from '../models/index.js';
import { getPublishedSettings } from './settings.service.js';
import { ApiError } from '../utils/ApiError.js';

export const assistantEnabled = () => Boolean(env.ANTHROPIC_API_KEY);
let client;
const getClient = () => (client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 }));

export const DISCLAIMER = 'General fitness information only — not medical advice. Consult a doctor before starting a new programme, especially with an injury, pregnancy or a health condition.';

// Kept stable (no timestamps or per-user data) so the prefix can be cached across requests.
async function systemPrompt() {
  const [s, programs] = await Promise.all([
    getPublishedSettings(),
    WorkoutProgram.find({ isActive: true }).select('title category difficulty durationWeeks').sort('order').lean(),
  ]);
  const programList = programs.map((p) => `- ${p.title} (${p.category.replace('_', ' ')}, ${p.difficulty}, ${p.durationWeeks} weeks)`).join('\n');
  return `You are the virtual fitness assistant for ${s.brand.name}, a premium gym. You give general guidance on workouts, exercise technique, training structure, recovery, and everyday nutrition habits.

Scope and safety rules:
- Give general, educational fitness information. You are not a doctor, physiotherapist, or dietitian.
- Do not diagnose injuries or conditions, and do not recommend medication, supplement dosages, or extreme diets (very low calorie, fasting protocols for medical purposes, rapid weight cutting).
- If someone mentions pain, injury, a medical condition, pregnancy, an eating disorder, chest pain, dizziness, or fainting, tell them to stop exercising and consult a qualified medical professional, and suggest speaking to one of the club's coaches. Encourage emergency services for urgent symptoms.
- Recommend progressive, conservative loads and proper warm-ups. Encourage beginners to learn technique with a coach.
- Stay on fitness, training, recovery, nutrition habits and questions about the club. Politely decline unrelated requests.
- Do not invent prices, schedules, or policies. For membership prices, bookings, or account questions, point people to the Memberships page, their dashboard, or the front desk at ${s.contact.phone}.
- Keep answers concise and practical: short paragraphs or bullet lists, sets/reps where useful. No more than about 250 words unless the user asks for a full plan.

The club's current programmes (recommend them when relevant):
${programList || '- (no programmes listed)'}

Opening hours: ${s.contact.hours.map((h) => `${h.days} ${h.open}–${h.close}`).join('; ')}.`;
}

export async function ask(messages) {
  if (!assistantEnabled()) throw new ApiError(503, 'The AI assistant is not enabled on this server.');
  let response;
  try {
    response = await getClient().beta.messages.create({
      model: env.ASSISTANT_MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' }, // conversational Q&A: fast and economical
      system: [{ type: 'text', text: await systemPrompt(), cache_control: { type: 'ephemeral' } }],
      messages,
      // On a safety-classifier decline, the API retries on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new ApiError(503, 'The assistant is busy right now. Please try again in a minute.');
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('Assistant credential error:', err.status);
      throw new ApiError(503, 'The AI assistant is temporarily unavailable.');
    }
    if (err instanceof Anthropic.BadRequestError) {
      console.error('Assistant bad request:', err.message);
      throw new ApiError(502, 'The assistant could not answer that request.');
    }
    if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIConnectionError) {
      console.error('Assistant API error:', err.status ?? 'connection', err.message);
      throw new ApiError(503, 'The AI assistant is temporarily unavailable.');
    }
    throw err;
  }
  if (response.stop_reason === 'refusal') {
    return { reply: "I can't help with that one. For anything health-related, please speak to a medical professional or one of our coaches.", disclaimer: DISCLAIMER };
  }
  const reply = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return { reply: reply || 'Sorry, I could not come up with an answer. Please rephrase your question.', disclaimer: DISCLAIMER, truncated: response.stop_reason === 'max_tokens' };
}
