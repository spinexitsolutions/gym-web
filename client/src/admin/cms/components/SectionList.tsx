import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, Copy, Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { SECTION_META, type DraftSection } from '@apex/shared';
import { cn } from '@/lib/cn';
import { IconButton } from './bits';
import { SECTION_ICONS } from './sectionIcons';
import { asString } from './utils';

export function sectionSummary(s: DraftSection): string {
  const p = s.props ?? {};
  return asString(p.headline) || asString(p.heading) || asString(p.eyebrow) || asString(p.subheading).slice(0, 60) || 'No heading';
}

interface RowProps {
  section: DraftSection;
  index: number;
  selected: boolean;
  errorCount: number;
  onSelect: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SortableRow({ section, index, selected, errorCount, onSelect, onToggle, onDuplicate, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const meta = SECTION_META[section.type];
  const Icon = SECTION_ICONS[section.type];
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center gap-1 rounded-xl border pr-1 transition-colors',
        selected ? 'border-primary/50 bg-primary/[0.07]' : 'border-transparent hover:border-line hover:bg-fg/[0.03]',
        isDragging && 'z-10 border-primary/60 bg-surface shadow-2xl',
        !section.enabled && 'opacity-60',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="grid h-11 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-l-xl text-muted/60 hover:text-fg active:cursor-grabbing"
        aria-label={`Reorder ${meta.label} section (position ${index + 1}). Press space to pick up, arrow keys to move.`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onSelect} aria-current={selected ? 'true' : undefined} className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left">
        <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', selected ? 'bg-primary/15 text-primary' : 'bg-fg/[0.06] text-fg/70')}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{meta.label}</span>
            {!section.enabled && <span className="rounded bg-fg/10 px-1.5 py-px text-[0.6rem] font-semibold uppercase tracking-wider text-muted">Hidden</span>}
          </span>
          <span className="block truncate text-xs text-muted">{sectionSummary(section)}</span>
        </span>
        {errorCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-danger" title={`${errorCount} issue(s) to fix before publishing`}>
            <AlertCircle className="h-3 w-3" />
            {errorCount}
            <span className="sr-only"> validation issues</span>
          </span>
        )}
      </button>
      <div className={cn('shrink-0 items-center', selected ? 'flex' : 'flex xl:hidden xl:group-focus-within:flex xl:group-hover:flex')}>
        <IconButton label={section.enabled ? `Hide ${meta.label}` : `Show ${meta.label}`} onClick={onToggle} className="h-7 w-7" aria-pressed={!section.enabled}>
          {section.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </IconButton>
        <IconButton label={`Duplicate ${meta.label}`} onClick={onDuplicate} className="h-7 w-7">
          <Copy className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label={`Delete ${meta.label}`} tone="danger" onClick={onDelete} className="h-7 w-7">
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </li>
  );
}

interface SectionListProps {
  sections: DraftSection[];
  selectedId: string | null;
  errorCounts: Record<string, number>;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SectionList({ sections, selectedId, errorCounts, onSelect, onReorder, onToggle, onDuplicate, onDelete }: SectionListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = sections.findIndex((s) => s.id === e.active.id);
    const to = sections.findIndex((s) => s.id === e.over!.id);
    if (from >= 0 && to >= 0) onReorder(from, to);
  };
  const labelOf = (id: string | number) => {
    const s = sections.find((x) => x.id === id);
    return s ? SECTION_META[s.type].label : 'section';
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${labelOf(active.id)}.`,
          onDragOver: ({ active, over }) => (over ? `${labelOf(active.id)} moved to position ${sections.findIndex((s) => s.id === over.id) + 1}.` : ''),
          onDragEnd: ({ active, over }) => (over ? `${labelOf(active.id)} dropped at position ${sections.findIndex((s) => s.id === over.id) + 1}.` : `${labelOf(active.id)} dropped.`),
          onDragCancel: ({ active }) => `Reordering ${labelOf(active.id)} cancelled.`,
        },
      }}
    >
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-1" aria-label="Page sections">
          {sections.map((s, i) => (
            <SortableRow
              key={s.id}
              section={s}
              index={i}
              selected={s.id === selectedId}
              errorCount={errorCounts[s.id] ?? 0}
              onSelect={() => onSelect(s.id)}
              onToggle={() => onToggle(s.id)}
              onDuplicate={() => onDuplicate(s.id)}
              onDelete={() => onDelete(s.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
