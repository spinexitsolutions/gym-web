import { describe, it, expect } from 'vitest';
import { docToForm, formToPayload, getPath, setPath } from '../components/dashboard/formValues.js';

const fields = [
  { section: 'x' },
  { name: 'name', type: 'text' },
  { name: 'limits.classesPerWeek', type: 'number' },
  { name: 'trainer', type: 'ref' },
  { name: 'plans', type: 'multiref' },
  { name: 'startAt', type: 'datetime' },
  { name: 'startDate', type: 'date' },
  { name: 'day', type: 'select', options: [{ value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }] },
  { name: 'image', type: 'image' },
  { name: 'days', type: 'repeater', fields: [{ name: 'label', type: 'text' }, { name: 'exercises', type: 'repeater', fields: [{ name: 'sets', type: 'number' }] }] },
];

describe('form value conversion', () => {
  it('reads nested paths, ids and dates from documents', () => {
    const form = docToForm(fields, {
      name: 'HIIT', limits: { classesPerWeek: 3 }, trainer: { _id: 't1', name: 'Tara' }, plans: [{ _id: 'p1' }, 'p2'],
      startAt: '2026-03-10T00:30:00.000Z', startDate: '2026-03-10T00:00:00.000Z', days: [{ label: 'D1', exercises: [{ sets: 3 }] }],
    });
    expect(form.limits.classesPerWeek).toBe(3);
    expect(form.trainer).toBe('t1');
    expect(form.plans).toEqual(['p1', 'p2']);
    expect(form.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(form.startDate).toBe('2026-03-10');
    expect(form.days[0].exercises[0].sets).toBe(3);
  });

  it('builds API payloads with types the server expects', () => {
    const local = '2026-03-10T06:00';
    const p = formToPayload(fields, {
      name: 'HIIT', limits: { classesPerWeek: '4' }, trainer: '', plans: ['p1'], startAt: local, startDate: '', day: '1',
      image: { url: '' }, days: [{ label: 'D1', exercises: [{ sets: '5' }] }],
    });
    expect(p.limits).toEqual({ classesPerWeek: 4 });
    expect(p.trainer).toBeNull(); // cleared reference
    expect(p.startAt).toBe(new Date(local).toISOString()); // browser local time → UTC
    expect('startDate' in p).toBe(false); // blank dates are omitted, never null (null would become 1970)
    expect(p.day).toBe(1);
    expect('image' in p).toBe(false);
    expect(p.days[0].exercises[0].sets).toBe(5);
  });

  it('path helpers', () => {
    const o = setPath({}, 'a.b.c', 1);
    expect(o).toEqual({ a: { b: { c: 1 } } });
    expect(getPath(o, 'a.b.c')).toBe(1);
    expect(getPath(o, 'a.x.y')).toBeUndefined();
  });
});
