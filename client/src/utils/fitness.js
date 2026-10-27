// General-purpose estimates for the public tools. They are not medical advice.

export function bmi(weightKg, heightCm) {
  const m = heightCm / 100;
  if (!(weightKg > 0) || !(m > 0)) return null;
  const value = weightKg / (m * m);
  let category;
  if (value < 18.5) category = 'Underweight';
  else if (value < 25) category = 'Healthy weight';
  else if (value < 30) category = 'Overweight';
  else category = 'Obese';
  // Healthy-weight range for this height (BMI 18.5–24.9).
  const range = [18.5 * m * m, 24.9 * m * m].map((n) => Math.round(n * 10) / 10);
  return { value: Math.round(value * 10) / 10, category, range };
}

export const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Sedentary (little exercise)', factor: 1.2 },
  { key: 'light', label: 'Light (1–3 days/week)', factor: 1.375 },
  { key: 'moderate', label: 'Moderate (3–5 days/week)', factor: 1.55 },
  { key: 'active', label: 'Active (6–7 days/week)', factor: 1.725 },
  { key: 'athlete', label: 'Athlete (twice daily)', factor: 1.9 },
];

// Mifflin–St Jeor resting energy expenditure × activity factor.
export function dailyCalories({ sex, age, weightKg, heightCm, activity }) {
  if (!(age > 0 && weightKg > 0 && heightCm > 0)) return null;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
  const factor = ACTIVITY_LEVELS.find((a) => a.key === activity)?.factor ?? 1.2;
  const maintain = Math.round(bmr * factor);
  return {
    bmr: Math.round(bmr),
    maintain,
    lose: Math.max(1200, maintain - 500),
    gain: maintain + 300,
  };
}

// MET values from the Compendium of Physical Activities (approximate).
export const WORKOUTS = [
  { key: 'weights', label: 'Weight training (vigorous)', met: 6 },
  { key: 'hiit', label: 'HIIT / circuit training', met: 8 },
  { key: 'running', label: 'Running (10 km/h)', met: 9.8 },
  { key: 'cycling', label: 'Indoor cycling (moderate)', met: 6.8 },
  { key: 'rowing', label: 'Rowing machine (moderate)', met: 7 },
  { key: 'yoga', label: 'Yoga (hatha)', met: 2.5 },
  { key: 'walking', label: 'Brisk walking', met: 4.3 },
];

export function workoutCalories({ met, weightKg, minutes }) {
  if (!(met > 0 && weightKg > 0 && minutes > 0)) return null;
  return Math.round(((met * 3.5 * weightKg) / 200) * minutes);
}
