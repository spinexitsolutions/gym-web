// Icons the admin can pick for facilities. Kept explicit so the bundle only includes these.
import {
  Dumbbell, HeartPulse, Activity, Flower2, Snowflake, Lock, Bike, Waves, ShowerHead, Coffee, Car, Users, Timer, Trophy, ShieldCheck, Sparkles,
} from 'lucide-react';

export const ICONS = { Dumbbell, HeartPulse, Activity, Flower2, Snowflake, Lock, Bike, Waves, ShowerHead, Coffee, Car, Users, Timer, Trophy, ShieldCheck, Sparkles };
export const iconFor = (name) => ICONS[name] || Dumbbell;
