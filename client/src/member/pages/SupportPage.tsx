import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight, LifeBuoy, MessageSquarePlus } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';
import { Button, EmptyState, ErrorState, Input, Modal, PageHeader, Pagination, Select, Skeleton, StatusBadge, Tabs, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { relativeTime, titleCase } from '@/lib/format';
import type { SupportTicket } from '../components/types';
import { applyFieldErrors, zr } from '../components/utils';

const CATEGORIES = ['membership', 'payment', 'booking', 'facility', 'account', 'other'] as const;
const schema = z.object({
  subject: z.string().trim().min(3, 'Add a short subject (3+ characters)').max(140),
  category: z.enum(CATEGORIES),
  body: z.string().trim().min(5, 'Tell us a bit more (5+ characters)').max(4000),
});
type Form = z.output<typeof schema>;
type Filter = 'all' | 'open' | 'resolved' | 'closed';

export default function SupportPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { site } = useSite();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['member', 'support', filter, page], queryFn: () => api.getPaged<SupportTicket[]>('/support', { page, limit: 15, status: filter === 'all' ? undefined : filter }) });
  const { register, handleSubmit, reset, setError, formState } = useForm<Form>({ resolver: zr<Form>(schema), defaultValues: { category: 'other', subject: '', body: '' } });

  const create = useMutation({
    mutationFn: (v: Form) => api.post<SupportTicket>('/support', v),
    onSuccess: (t) => {
      toast.success('Ticket created', 'We’ll reply here and notify you.');
      setOpen(false);
      reset();
      void qc.invalidateQueries({ queryKey: ['member', 'support'] });
      navigate(`/member/support/${t._id}`);
    },
    onError: (err) => !applyFieldErrors(err, setError) && toast.error(err),
  });

  const e = formState.errors;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Account"
        title="Support"
        description={`Questions about billing, bookings or the facility? Message the team${site?.settings.contact.phone ? ` — or call ${site.settings.contact.phone}` : ''}.`}
        actions={
          <Button icon={<MessageSquarePlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            New ticket
          </Button>
        }
      />
      <Tabs<Filter>
        className="mb-4 w-fit"
        value={filter}
        onChange={(v) => (setFilter(v), setPage(1))}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'open', label: 'Open' },
          { value: 'resolved', label: 'Resolved' },
          { value: 'closed', label: 'Closed' },
        ]}
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !q.data?.data.length ? (
        <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title={filter === 'all' ? 'No tickets yet' : `No ${filter} tickets`} description="Need help? Open a ticket and the team will get back to you, usually within a working day." action={<Button onClick={() => setOpen(true)}>Open a ticket</Button>} />
      ) : (
        <>
          <ul className="space-y-2">
            {q.data.data.map((t, i) => {
              const last = t.messages[t.messages.length - 1];
              const awaitingYou = last?.staff && t.status !== 'closed';
              return (
                <motion.li key={t._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Link to={`/member/support/${t._id}`} className="card flex items-center gap-3 p-4 transition hover:border-primary/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{t.subject}</p>
                        <StatusBadge status={t.status} />
                        {awaitingYou && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">New reply</span>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">{last?.body}</p>
                      <p className="mt-1 text-xs text-muted">
                        {titleCase(t.category)} · {t.messages.length} {t.messages.length === 1 ? 'message' : 'messages'} · updated {relativeTime(t.updatedAt)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </motion.li>
              );
            })}
          </ul>
          {q.data.meta && <Pagination page={q.data.meta.page} pages={q.data.meta.pages} total={q.data.meta.total} onPage={setPage} />}
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New support ticket"
        description="You can have up to 5 open tickets."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="ticket-form" loading={create.isPending}>
              Send
            </Button>
          </>
        }
      >
        <form id="ticket-form" noValidate className="space-y-4" onSubmit={handleSubmit((v) => create.mutate(v))}>
          <Input label="Subject" required maxLength={140} {...register('subject')} error={e.subject?.message} placeholder="e.g. Receipt for my last payment" />
          <Select label="Category" {...register('category')} options={CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))} error={e.category?.message} />
          <Textarea label="Message" required rows={5} maxLength={4000} {...register('body')} error={e.body?.message} placeholder="Include dates, receipt numbers or booking details if relevant." />
        </form>
      </Modal>
    </div>
  );
}
