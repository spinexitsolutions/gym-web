/** BMI and calorie helpers shared by the public calculator and member dashboard. Not medical advice. */
export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number): { label: string; tone: 'info' | 'success' | 'warning' | 'danger' } {
  if (bmi < 18.5) return { label: 'Below the standard range', tone: 'info' };
  if (bmi < 25) return { label: 'Within the standard range', tone: 'success' };
  if (bmi < 30) return { label: 'Above the standard range', tone: 'warning' };
  return { label: 'Well above the standard range', tone: 'danger' };
}

export const ACTIVITY_LEVELS = {
  sedentary: { label: 'Sedentary (little or no exercise)', factor: 1.2 },
  light: { label: 'Light (1–3 sessions/week)', factor: 1.375 },
  moderate: { label: 'Moderate (3–5 sessions/week)', factor: 1.55 },
  active: { label: 'Very active (6–7 sessions/week)', factor: 1.725 },
  athlete: { label: 'Athlete (2× per day)', factor: 1.9 },
} as const;
export type ActivityLevel = keyof typeof ACTIVITY_LEVELS;

/** Mifflin–St Jeor estimate. Approximate only. */
export function estimateCalories(input: { weightKg: number; heightCm: number; age: number; sex: 'male' | 'female'; activity: ActivityLevel }): { bmr: number; maintenance: number } | null {
  const { weightKg, heightCm, age, sex, activity } = input;
  if (!(weightKg > 0 && heightCm > 0 && age >= 15 && age <= 100)) return null;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
  return { bmr: Math.round(bmr), maintenance: Math.round(bmr * ACTIVITY_LEVELS[activity].factor) };
}
