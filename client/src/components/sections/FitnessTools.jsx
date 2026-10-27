import { useId, useState } from 'react';
import { Calculator, Flame, Scale } from 'lucide-react';
import { Section, SectionHeading } from '../ui/Section.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { Field, Input, Select } from '../../forms/Field.jsx';
import { bmi, dailyCalories, workoutCalories, ACTIVITY_LEVELS, WORKOUTS } from '../../utils/fitness.js';
import { cn } from '../../utils/cn.js';

const num = (v) => (v === '' ? '' : Number(v));

function NumberField({ label, value, onChange, unit, min, max, step = 1 }) {
  return (
    <Field label={`${label}${unit ? ` (${unit})` : ''}`}>
      {(a11y) => <Input {...a11y} type="number" inputMode="decimal" min={min} max={max} step={step} value={value} onChange={(e) => onChange(num(e.target.value))} />}
    </Field>
  );
}

function Result({ children }) {
  return <div aria-live="polite" className="mt-6 rounded-brand border border-gold/30 bg-gold/5 p-5">{children}</div>;
}

function BmiTool() {
  const [h, setH] = useState(170);
  const [w, setW] = useState(70);
  const r = bmi(w, h);
  const pct = r ? Math.min(100, Math.max(0, ((r.value - 15) / 20) * 100)) : 0;
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Height" unit="cm" value={h} onChange={setH} min={100} max={250} />
        <NumberField label="Weight" unit="kg" value={w} onChange={setW} min={25} max={300} step={0.1} />
      </div>
      {r ? (
        <Result>
          <p className="flex items-baseline gap-3"><span className="font-display text-4xl font-semibold text-gold">{r.value}</span><span className="text-sm">{r.category}</span></p>
          <div className="relative mt-4 h-2 rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 via-50% to-rose-500" aria-hidden>
            <span className="absolute -top-1 h-4 w-1 rounded bg-ink" style={{ left: `${pct}%` }} />
          </div>
          <p className="mt-3 text-sm text-muted">A healthy weight for your height is roughly {r.range[0]}–{r.range[1]} kg.</p>
        </Result>
      ) : <Result><p className="text-sm text-muted">Enter your height and weight.</p></Result>}
    </div>
  );
}

function CalorieTool() {
  const [v, setV] = useState({ sex: 'male', age: 30, heightCm: 175, weightKg: 75, activity: 'moderate' });
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const r = dailyCalories(v);
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sex">{(a) => <Select {...a} value={v.sex} onChange={(e) => set('sex')(e.target.value)}><option value="male">Male</option><option value="female">Female</option></Select>}</Field>
        <NumberField label="Age" value={v.age} onChange={set('age')} min={14} max={90} />
        <NumberField label="Height" unit="cm" value={v.heightCm} onChange={set('heightCm')} min={100} max={250} />
        <NumberField label="Weight" unit="kg" value={v.weightKg} onChange={set('weightKg')} min={25} max={300} step={0.1} />
        <Field label="Activity" className="sm:col-span-2">{(a) => (
          <Select {...a} value={v.activity} onChange={(e) => set('activity')(e.target.value)}>
            {ACTIVITY_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </Select>
        )}</Field>
      </div>
      <Result>
        {r ? (
          <dl className="grid grid-cols-3 gap-4 text-center">
            {[['Lose', r.lose], ['Maintain', r.maintain], ['Gain', r.gain]].map(([k, val]) => (
              <div key={k}><dt className="text-xs uppercase tracking-wider text-muted">{k}</dt><dd className="mt-1 font-display text-2xl font-semibold text-gold">{val.toLocaleString('en-IN')}</dd><dd className="text-xs text-muted">kcal/day</dd></div>
            ))}
          </dl>
        ) : <p className="text-sm text-muted">Fill in all fields.</p>}
      </Result>
    </div>
  );
}

function BurnTool() {
  const [workout, setWorkout] = useState('weights');
  const [minutes, setMinutes] = useState(45);
  const [weightKg, setWeight] = useState(70);
  const met = WORKOUTS.find((w) => w.key === workout)?.met;
  const kcal = workoutCalories({ met, weightKg, minutes });
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Workout" className="sm:col-span-2">{(a) => (
          <Select {...a} value={workout} onChange={(e) => setWorkout(e.target.value)}>
            {WORKOUTS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
          </Select>
        )}</Field>
        <NumberField label="Duration" unit="min" value={minutes} onChange={setMinutes} min={5} max={240} />
        <NumberField label="Your weight" unit="kg" value={weightKg} onChange={setWeight} min={25} max={300} />
      </div>
      <Result>
        {kcal ? <p className="flex items-baseline gap-3"><span className="font-display text-4xl font-semibold text-gold">≈ {kcal}</span><span className="text-sm">kcal burned</span></p>
          : <p className="text-sm text-muted">Fill in all fields.</p>}
      </Result>
    </div>
  );
}

const TABS = [
  { key: 'bmi', label: 'BMI calculator', icon: Scale, Comp: BmiTool },
  { key: 'calories', label: 'Daily calories', icon: Calculator, Comp: CalorieTool },
  { key: 'burn', label: 'Workout burn', icon: Flame, Comp: BurnTool },
];

export function FitnessTools() {
  const [tab, setTab] = useState('bmi');
  const id = useId();
  const Active = TABS.find((t) => t.key === tab).Comp;
  const onKey = (e) => {
    const i = TABS.findIndex((t) => t.key === tab);
    if (e.key === 'ArrowRight') setTab(TABS[(i + 1) % TABS.length].key);
    if (e.key === 'ArrowLeft') setTab(TABS[(i - 1 + TABS.length) % TABS.length].key);
  };
  return (
    <Section id="tools" className="bg-surface/30">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <SectionHeading className="mb-0" eyebrow="Fitness tools" title="Know your numbers"
          lead="Quick estimates to help you set realistic goals. Our coaches refine them with a full body-composition assessment." />
        <Reveal className="glass rounded-brand p-6 md:p-8">
          <div role="tablist" aria-label="Fitness tools" className="mb-8 flex flex-wrap gap-2" onKeyDown={onKey}>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} id={`${id}-${key}`} role="tab" type="button" aria-selected={tab === key} aria-controls={`${id}-panel`} tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
                className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition', tab === key ? 'border-gold bg-gold/15 text-gold' : 'border-line/15 text-muted hover:text-ink')}>
                <Icon className="h-4 w-4" aria-hidden />{label}
              </button>
            ))}
          </div>
          <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`}><Active /></div>
          <p className="mt-6 text-xs leading-relaxed text-muted">
            These are general estimates, not medical advice. BMI does not account for muscle mass. Consult a doctor before starting a new exercise or diet programme, especially if you have a health condition.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
