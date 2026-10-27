const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const formatPaise = (paise) => inr.format(Math.round((paise || 0) / 100));

export const PERIODS = {
  monthly: { label: 'Monthly', months: 1, short: '/mo' },
  quarterly: { label: 'Quarterly', months: 3, short: '/3 mo' },
  half_yearly: { label: 'Half-yearly', months: 6, short: '/6 mo' },
  yearly: { label: 'Yearly', months: 12, short: '/yr' },
};

export const CATEGORY_LABELS = {
  weight_loss: 'Weight loss',
  muscle_building: 'Muscle building',
  strength: 'Strength training',
  personal_training: 'Personal training',
  functional: 'Functional training',
  hiit: 'HIIT',
  yoga: 'Yoga & flexibility',
  cardio: 'Cardio',
  beginner: 'Beginner fitness',
};

export const formatDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('en-IN', opts).format(new Date(d));

export const to12h = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export const whatsappLink = (number, text) =>
  `https://wa.me/${String(number).replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
