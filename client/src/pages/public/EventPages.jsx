import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, MapPin, Trophy, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { PageHero } from '../../components/sections/PageHero.jsx';
import { Section } from '../../components/ui/Section.jsx';
import { Events } from '../../components/sections/Events.jsx';
import { Img } from '../../components/ui/Img.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { formatDate } from '../../utils/format.js';
import NotFoundPage from './NotFoundPage.jsx';
import { cn } from '../../utils/cn.js';

export function EventsPage() {
  return (
    <>
      <Seo title="Events & challenges" description="Workshops, community events and fitness challenges with live leaderboards." path="/events" />
      <PageHero eyebrow="Community" title="Events & challenges" lead="Learn from our coaches, train with the community and compete on the leaderboard." />
      <Events />
    </>
  );
}

export function EventDetailPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['event', slug, Boolean(user)], queryFn: async () => (await api.get(`/events/${slug}`)).data, retry: (n, e) => e.status !== 404 && n < 2 });
  if (q.isLoading) return <PageLoader />;
  if (q.error?.status === 404) return <NotFoundPage />;
  if (q.isError) return <div className="container py-24"><ErrorState message={q.error.message} onRetry={q.refetch} /></div>;
  const e = q.data;
  const ended = new Date(e.endDate) < new Date();
  const toggle = async () => {
    try { toast.success((await api.post(`/events/${e._id}/${e.joined ? 'leave' : 'join'}`)).message); qc.invalidateQueries({ queryKey: ['event', slug] }); } catch (err) { toast.error(err); }
  };
  return (
    <>
      <Seo title={e.title} description={e.description?.slice(0, 160)} image={e.image?.url} path={`/events/${e.slug}`}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Event', name: e.title, startDate: e.startDate, endDate: e.endDate, location: e.location ? { '@type': 'Place', name: e.location } : undefined, image: e.image?.url, description: e.description }} />
      <PageHero eyebrow={e.kind === 'challenge' ? 'Challenge' : 'Event'} title={e.title} image={e.image} />
      <Section className="pt-12 md:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted">
              <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-gold" aria-hidden />{formatDate(e.startDate, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} – {formatDate(e.endDate, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</span>
              {e.location && <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" aria-hidden />{e.location}</span>}
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-gold" aria-hidden />{e.participantCount} joined</span>
            </div>
            <div className="space-y-4 whitespace-pre-line text-lg leading-relaxed text-muted">{e.description}</div>
            <div className="mt-8">
              {ended ? <Badge>This event has ended</Badge> : user ? (
                <Button onClick={toggle} variant={e.joined ? 'outline' : 'primary'}>{e.joined ? 'Leave' : e.kind === 'challenge' ? 'Join the challenge' : 'Join the event'}</Button>
              ) : <Button to={`/login?next=${encodeURIComponent(`/events/${e.slug}`)}`}>Log in to join</Button>}
              {!ended && <p className="mt-2 text-xs text-muted">Requires an active membership.</p>}
            </div>
          </div>
          {e.metric !== 'none' && (
            <aside className="rounded-brand border border-line/10 bg-surface p-6">
              <h2 className="mb-1 flex items-center gap-2 font-sans text-lg font-semibold"><Trophy className="h-5 w-5 text-gold" aria-hidden />Leaderboard</h2>
              <p className="mb-5 text-xs text-muted">{e.metric === 'attendance' ? 'Scored automatically from check-ins during the challenge.' : 'Scores are entered by our coaches.'}</p>
              {e.leaderboard.length ? (
                <ol className="space-y-2">
                  {e.leaderboard.slice(0, 20).map((r) => (
                    <li key={r.userId} className={cn('flex items-center gap-3 rounded-brand px-3 py-2 text-sm', e.myRank?.userId === r.userId ? 'bg-gold/15' : r.rank <= 3 ? 'bg-elevated' : '')}>
                      <span className={cn('w-6 text-center font-semibold', r.rank <= 3 ? 'text-gold' : 'text-muted')}>{r.rank}</span>
                      <span className="h-8 w-8 overflow-hidden rounded-full bg-elevated">{r.avatar?.url ? <Img image={r.avatar} alt="" sizes="32px" className="h-full w-full" /> : <span className="grid h-full place-items-center text-xs text-gold">{r.name[0]}</span>}</span>
                      <span className="flex-1">{r.name}</span>
                      <span className="font-semibold">{r.score}{e.unit ? ` ${e.unit}` : ''}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm text-muted">No participants yet — be the first!</p>}
              {e.myRank && e.myRank.rank > 20 && <p className="mt-3 text-sm">You’re #{e.myRank.rank} with {e.myRank.score}.</p>}
            </aside>
          )}
        </div>
        <p className="mt-12"><Link to="/events" className="text-sm text-gold hover:underline">← All events</Link></p>
      </Section>
    </>
  );
}
