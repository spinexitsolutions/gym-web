import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader, Card, ChartCard, StatCard } from '../../components/dashboard/Widgets.jsx';
import { DataTable } from '../../components/dashboard/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { formatDate } from '../../utils/format.js';
import { bmi } from '../../utils/fitness.js';
import { chartColors, tooltipStyle } from '../../utils/chart.js';

const num = { setValueAs: (v) => (v === '' ? undefined : Number(v)) };
const MEASURES = [['chestCm', 'Chest'], ['waistCm', 'Waist'], ['hipsCm', 'Hips'], ['armCm', 'Arm'], ['thighCm', 'Thigh']];

export default function ProgressPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [error, setFormError] = useState('');
  const q = useQuery({ queryKey: ['progress'], queryFn: async () => (await api.get('/workouts/progress')).data });
  const { register, handleSubmit, reset, setError, formState: { isSubmitting } } = useForm({ defaultValues: { date: new Date().toLocaleDateString('en-CA') } });
  const c = chartColors();
  const entries = q.data || [];
  const latest = [...entries].reverse().find((e) => e.weightKg);
  const first = entries.find((e) => e.weightKg);
  const b = latest && profile?.heightCm ? bmi(latest.weightKg, profile.heightCm) : null;

  const submit = async (v) => {
    setFormError('');
    const measurements = Object.fromEntries(MEASURES.map(([k]) => [k, v[k]]).filter(([, x]) => x));
    try {
      await api.post('/workouts/progress', { date: v.date, weightKg: v.weightKg, bodyFatPct: v.bodyFatPct, measurements: Object.keys(measurements).length ? measurements : undefined, note: v.note || undefined });
      toast.success('Progress saved');
      reset({ date: new Date().toLocaleDateString('en-CA') });
      qc.invalidateQueries({ queryKey: ['progress'] });
    } catch (err) { setFormError(applyServerErrors(err, setError)); }
  };
  const remove = async (id) => { try { await api.delete(`/workouts/progress/${id}`); qc.invalidateQueries({ queryKey: ['progress'] }); } catch (err) { toast.error(err); } };
  const chart = entries.map((e) => ({ date: e.date.slice(0, 10), weight: e.weightKg, fat: e.bodyFatPct, waist: e.measurements?.waistCm }));

  return (
    <>
      <Seo title="Progress" noindex />
      <PageHeader title="Progress" description="Track weight, body fat and measurements. Your coach can see this to adjust your plan." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Current weight" value={latest ? `${latest.weightKg} kg` : '—'} loading={q.isLoading} hint={latest && formatDate(latest.date)} />
        <StatCard label="Change since first entry" value={latest && first && latest !== first ? `${(latest.weightKg - first.weightKg > 0 ? '+' : '') + (latest.weightKg - first.weightKg).toFixed(1)} kg` : '—'} loading={q.isLoading} />
        <StatCard label="BMI" value={b ? b.value : '—'} hint={b ? b.category : profile?.heightCm ? undefined : 'Add your height in Profile'} loading={q.isLoading} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <ChartCard title="Weight & body fat">
            {chart.filter((x) => x.weight || x.fat).length >= 2 ? (
              <ResponsiveContainer>
                <LineChart data={chart}><CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="w" domain={['dataMin - 2', 'dataMax + 2']} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} width={36} />
                  <YAxis yAxisId="f" orientation="right" domain={[0, 'dataMax + 5']} stroke={c.muted} fontSize={11} tickLine={false} axisLine={false} width={30} />
                  <Tooltip {...tooltipStyle()} /><Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="w" type="monotone" dataKey="weight" name="Weight (kg)" stroke={c.accent} strokeWidth={2.5} connectNulls dot={{ r: 3 }} />
                  <Line yAxisId="f" type="monotone" dataKey="fat" name="Body fat (%)" stroke={c.soft} strokeWidth={2} connectNulls dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted">Add at least two entries to see a chart.</p>}
          </ChartCard>
          <DataTable caption="Progress entries" rows={[...entries].reverse()} loading={q.isLoading} error={q.error} onRetry={q.refetch} empty={{ title: 'No entries yet' }}
            columns={[
              { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
              { key: 'weightKg', header: 'Weight', render: (r) => (r.weightKg ? `${r.weightKg} kg` : '—') },
              { key: 'bodyFatPct', header: 'Body fat', render: (r) => (r.bodyFatPct ? `${r.bodyFatPct}%` : '—') },
              { key: 'm', header: 'Measurements', hideOnMobile: true, render: (r) => MEASURES.filter(([k]) => r.measurements?.[k]).map(([k, l]) => `${l} ${r.measurements[k]}`).join(' · ') || '—' },
              { key: '_a', header: <span className="sr-only">Delete</span>, className: 'text-right', render: (r) => <button type="button" onClick={() => remove(r._id)} className="rounded-full p-2 text-muted hover:text-danger" aria-label={`Delete entry from ${formatDate(r.date)}`}><Trash2 className="h-4 w-4" /></button> },
            ]} />
        </div>
        <Card title="Log progress">
          <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
            <FormAlert>{error}</FormAlert>
            <Field label="Date">{(a) => <input {...a} type="date" className="input" max={new Date().toLocaleDateString('en-CA')} {...register('date')} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Weight (kg)">{(a) => <input {...a} type="number" step="0.1" className="input" {...register('weightKg', num)} />}</Field>
              <Field label="Body fat (%)">{(a) => <input {...a} type="number" step="0.1" className="input" {...register('bodyFatPct', num)} />}</Field>
              {MEASURES.map(([k, l]) => <Field key={k} label={`${l} (cm)`}>{(a) => <input {...a} type="number" step="0.5" className="input" {...register(k, num)} />}</Field>)}
            </div>
            <Field label="Note">{(a) => <input {...a} className="input" maxLength={500} {...register('note')} placeholder="Felt strong today" />}</Field>
            <Button type="submit" loading={isSubmitting} className="w-full">Save entry</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
