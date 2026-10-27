import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { useList } from '../../hooks/useList.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DataTable, Pager } from './DataTable.jsx';
import { Modal, ConfirmDialog } from './Modal.jsx';
import { PageHeader, SearchInput, FilterSelect, Toolbar } from './Widgets.jsx';
import { FormFields } from './FormBuilder.jsx';
import { docToForm, formToPayload } from './formValues.js';
import { Button } from '../ui/Button.jsx';
import { FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { Seo } from '../layout/Seo.jsx';

function ResourceForm({ config, doc, onClose, onSaved }) {
  const toast = useToast();
  const [formError, setFormError] = useState('');
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    defaultValues: docToForm(config.fields, doc || {}, doc ? {} : config.defaults?.() || {}),
  });
  const onSubmit = async (values) => {
    setFormError('');
    const payload = config.toPayload ? config.toPayload(formToPayload(config.fields, values), values) : formToPayload(config.fields, values);
    try {
      const res = doc ? await api.patch(`${config.endpoint}/${doc._id}`, payload) : await api.post(config.endpoint, payload);
      toast.success(res.message || 'Saved');
      onSaved(res.data);
    } catch (err) {
      setFormError(applyServerErrors(err, setError) || 'Please fix the highlighted fields.');
    }
  };
  return (
    <Modal open onClose={onClose} side size="lg" title={doc ? `Edit ${config.singular}` : `New ${config.singular}`}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Save</Button></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <FormAlert>{formError}</FormAlert>
        <FormFields fields={config.fields} control={control} register={register} errors={errors} />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

/**
 * Generic admin list + create/edit/delete for a /api/admin/* resource.
 * config: { title, singular, description, endpoint, columns, fields, defaults(), filters, searchPlaceholder, sortDefault, toPayload, canDelete, extraActions(row) }
 */
export function ResourcePage({ config }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { rows, meta, query, params, set } = useList(config.endpoint, { defaults: { sort: config.sortDefault || '', limit: 20 } });
  const [editing, setEditing] = useState(null); // null | 'new' | doc
  const [deleting, setDeleting] = useState(null);
  const del = useMutation({
    mutationFn: (doc) => api.delete(`${config.endpoint}/${doc._id}`),
    onSuccess: (res) => { toast.success(res.message); setDeleting(null); qc.invalidateQueries({ queryKey: [config.endpoint] }); },
    onError: (err) => { toast.error(err); setDeleting(null); },
  });

  const columns = [
    ...config.columns,
    {
      key: '_actions', header: <span className="sr-only">Actions</span>, className: 'w-px whitespace-nowrap text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {config.extraActions?.(r)}
          <button type="button" className="rounded-full p-2 text-muted hover:bg-ink/5 hover:text-ink" onClick={(e) => { e.stopPropagation(); setEditing(r); }} aria-label={`Edit ${config.singular}`}><Pencil className="h-4 w-4" /></button>
          {config.canDelete !== false && <button type="button" className="rounded-full p-2 text-muted hover:bg-danger/10 hover:text-danger" onClick={(e) => { e.stopPropagation(); setDeleting(r); }} aria-label={`Delete ${config.singular}`}><Trash2 className="h-4 w-4" /></button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <Seo title={config.title} noindex />
      <PageHeader title={config.title} description={config.description}
        actions={<Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden />New {config.singular}</Button>} />
      <Toolbar>
        <SearchInput value={params.q || ''} onChange={(q) => set({ q })} placeholder={config.searchPlaceholder || 'Search'} />
        {config.filters?.map((f) => <FilterSelect key={f.key} label={f.label} value={params[f.key] || ''} onChange={(v) => set({ [f.key]: v })} options={f.options} />)}
      </Toolbar>
      <DataTable caption={config.title} columns={columns} rows={rows} loading={query.isLoading} error={query.error} onRetry={query.refetch}
        sort={params.sort} onSort={(sort) => set({ sort })} onRowClick={(r) => setEditing(r)}
        empty={{ title: `No ${config.title.toLowerCase()} yet`, message: params.q ? 'Try a different search.' : `Create your first ${config.singular}.` }} />
      <Pager meta={meta} onPage={(page) => set({ page })} />
      {editing && (
        <ResourceForm config={config} doc={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: [config.endpoint] }); config.onSaved?.(qc); }} />
      )}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} loading={del.isPending} onConfirm={() => del.mutate(deleting)}
        title={`Delete ${config.singular}?`} message="This cannot be undone." confirmLabel="Delete" />
    </>
  );
}
