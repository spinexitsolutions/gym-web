import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Upload, RotateCcw, Save } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/dashboard/Widgets.jsx';
import { FormFields } from '../../components/dashboard/FormBuilder.jsx';
import { docToForm, formToPayload } from '../../components/dashboard/formValues.js';
import { ConfirmDialog } from '../../components/dashboard/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { SETTINGS_KEY } from '../../hooks/useSettings.js';
import { SETTINGS_SECTIONS } from '../settingsSections.js';
import { formatDate } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const DRAFT_KEY = ['settings', 'draft'];

function SectionForm({ section, draft, onSaved }) {
  const toast = useToast();
  const [error, setFormError] = useState('');
  const { register, control, handleSubmit, reset, setError, formState: { errors, isSubmitting, isDirty } } = useForm({ defaultValues: docToForm(section.fields, draft) });
  useEffect(() => { reset(docToForm(section.fields, draft)); }, [section, draft, reset]);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const res = await api.patch('/settings/draft', formToPayload(section.fields, values));
      toast.success('Draft saved. Publish to make it live.');
      onSaved(res.data);
    } catch (err) {
      setFormError(applyServerErrors(err, setError) || 'Please fix the highlighted fields.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FormAlert>{error}</FormAlert>
      <FormFields fields={section.fields} control={control} register={register} errors={errors} />
      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty} className="shadow-card"><Save className="h-4 w-4" aria-hidden />Save draft</Button>
      </div>
    </form>
  );
}

export default function WebsitePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState(SETTINGS_SECTIONS[0].key);
  const [confirm, setConfirm] = useState(null); // 'publish' | 'discard'
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: DRAFT_KEY, queryFn: async () => (await api.get('/settings/draft')).data });

  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  const { draft, hasUnpublishedChanges, publishedAt, version } = q.data;
  const section = SETTINGS_SECTIONS.find((s) => s.key === tab);

  const act = async (kind) => {
    setBusy(true);
    try {
      const res = await api.post(kind === 'publish' ? '/settings/publish' : '/settings/discard');
      qc.setQueryData(DRAFT_KEY, res.data);
      qc.invalidateQueries({ queryKey: SETTINGS_KEY });
      toast.success(res.message);
    } catch (err) { toast.error(err); } finally { setBusy(false); setConfirm(null); }
  };

  return (
    <>
      <Seo title="Website content" noindex />
      <PageHeader eyebrow="Content management" title="Website"
        description="Edit any part of the public website. Changes are saved as a draft and go live only when you publish."
        actions={(
          <>
            <Button variant="ghost" size="sm" href={`${window.location.origin}/?preview=draft`}><Eye className="h-4 w-4" aria-hidden />Preview draft</Button>
            <Button variant="outline" size="sm" disabled={!hasUnpublishedChanges} onClick={() => setConfirm('discard')}><RotateCcw className="h-4 w-4" aria-hidden />Discard</Button>
            <Button size="sm" disabled={!hasUnpublishedChanges} loading={busy && confirm === 'publish'} onClick={() => setConfirm('publish')}><Upload className="h-4 w-4" aria-hidden />Publish</Button>
          </>
        )} />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        {hasUnpublishedChanges ? <Badge tone="gold">Unpublished changes</Badge> : <Badge tone="success">Live site is up to date</Badge>}
        <span>Version {version}{publishedAt ? ` · published ${formatDate(publishedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Website sections" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {SETTINGS_SECTIONS.map((s) => (
              <li key={s.key}>
                <button type="button" onClick={() => setTab(s.key)} aria-current={tab === s.key ? 'page' : undefined}
                  className={cn('w-full whitespace-nowrap rounded-brand px-3 py-2 text-left text-sm transition', tab === s.key ? 'bg-gold/10 text-gold' : 'text-muted hover:bg-ink/5 hover:text-ink')}>{s.label}</button>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="section-title" className="rounded-brand border border-line/10 bg-surface p-5 md:p-8">
          <h2 id="section-title" className="mb-6 font-sans text-lg font-semibold">{section.label}</h2>
          <SectionForm key={section.key} section={section} draft={draft} onSaved={(data) => qc.setQueryData(DRAFT_KEY, data)} />
        </section>
      </div>

      <ConfirmDialog open={confirm === 'publish'} onClose={() => setConfirm(null)} onConfirm={() => act('publish')} loading={busy} tone="primary"
        title="Publish changes?" message="Your draft will replace the live website content immediately." confirmLabel="Publish" />
      <ConfirmDialog open={confirm === 'discard'} onClose={() => setConfirm(null)} onConfirm={() => act('discard')} loading={busy}
        title="Discard draft?" message="All unpublished edits will be lost and the draft will match the live site again." confirmLabel="Discard" />
    </>
  );
}
