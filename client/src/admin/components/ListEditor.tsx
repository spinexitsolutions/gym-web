import { useId, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';

/** Ordered list of short strings (e.g. plan benefits) with add/remove/reorder. */
export function ListEditor({ label, value, onChange, max = 20, maxLength = 120, placeholder = 'Add an item', error, hint }: { label: ReactNode; value: string[]; onChange: (v: string[]) => void; max?: number; maxLength?: number; placeholder?: string; error?: string; hint?: ReactNode }) {
  const id = useId();
  const set = (i: number, v: string) => onChange(value.map((x, j) => (j === i ? v : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <ol className="space-y-2">
        {value.map((v, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
            <label htmlFor={`${id}-${i}`} className="sr-only">
              Item {i + 1}
            </label>
            <input id={`${id}-${i}`} className="input py-2" value={v} maxLength={maxLength} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
            <Button size="sm" variant="ghost" className="!px-2" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="!px-2" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="!px-2 text-danger" aria-label={`Remove item ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ol>
      <Button size="sm" variant="secondary" className="mt-2" icon={<Plus className="h-3.5 w-3.5" />} disabled={value.length >= max} onClick={() => onChange([...value, ''])}>
        Add
      </Button>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">{hint ?? `${value.length}/${max}`}</p>
      )}
    </fieldset>
  );
}
