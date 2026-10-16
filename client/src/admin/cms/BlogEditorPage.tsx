import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Bold, Columns2, ExternalLink, Eye, Heading2, ImagePlus, Italic, Link2, List, PencilLine, Quote, Save } from 'lucide-react';
import { Badge, Button, ErrorState, PageLoader, Select, Switch, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { CharCount, ChipInput, FieldError, Hint, LabelRow, Segmented } from './components/bits';
import { ImageField, MediaPicker } from './components/MediaPicker';
import { isoToLocalInput, localInputToIso, slugify, useUnsavedChangesWarning } from './components/utils';
import type { AdminPost } from './BlogAdminPage';

interface PostForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  tags: string[];
  authorName: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  seo: { title: string; description: string; image: string; noIndex: boolean };
}

const EMPTY: PostForm = { title: '', slug: '', excerpt: '', content: '', coverImage: '', category: 'training', tags: [], authorName: '', status: 'draft', publishedAt: null, seo: { title: '', description: '', image: '', noIndex: false } };
const CATEGORIES = ['training', 'nutrition', 'recovery', 'community', 'news', 'stories'];

type FullPost = AdminPost & { content: string; seo?: PostForm['seo'] };

const fromPost = (p: FullPost): PostForm => ({
  title: p.title,
  slug: p.slug,
  excerpt: p.excerpt ?? '',
  content: p.content ?? '',
  coverImage: p.coverImage ?? '',
  category: p.category ?? 'training',
  tags: p.tags ?? [],
  authorName: p.authorName ?? '',
  status: p.status,
  publishedAt: p.publishedAt ?? null,
  seo: { ...EMPTY.seo, ...(p.seo ?? {}) },
});

export default function BlogEditorPage() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const postQ = useQuery({ queryKey: ['cms-blog-post', id], queryFn: () => api.get<FullPost>(`/blog/admin/${id}`), enabled: !isNew, refetchOnWindowFocus: false });
  const [form, setForm] = useState<PostForm | null>(isNew ? EMPTY : null);
  const [base, setBase] = useState(JSON.stringify(EMPTY));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'split' | 'write' | 'preview'>('split');
  const [imgOpen, setImgOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (postQ.data && !form) {
      const f = fromPost(postQ.data);
      setForm(f);
      setBase(JSON.stringify(f));
    }
  }, [postQ.data, form]);

  const dirty = form !== null && JSON.stringify(form) !== base;
  useUnsavedChangesWarning(dirty);
  const words = useMemo(() => (form?.content ?? '').split(/\s+/).filter(Boolean).length, [form?.content]);

  if (!isNew && postQ.isError) return <ErrorState error={postQ.error} onRetry={() => postQ.refetch()} />;
  if (!form) return <PageLoader label="Loading article" />;

  const set = <K extends keyof PostForm>(k: K, v: PostForm[K]) => {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [k]: v };
      if (k === 'title' && !slugTouched) next.slug = slugify(String(v));
      return next;
    });
    setErrors((e) => (e[k as string] ? Object.fromEntries(Object.entries(e).filter(([x]) => x !== k)) : e));
  };
  const setSeo = <K extends keyof PostForm['seo']>(k: K, v: PostForm['seo'][K]) => set('seo', { ...form.seo, [k]: v });

  /** Wraps the textarea selection with markdown syntax. */
  const wrap = (before: string, after = before, placeholder = 'text') => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    set('content', next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  const linePrefix = (prefix: string) => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: s, value } = el;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    set('content', value.slice(0, lineStart) + prefix + value.slice(lineStart));
    requestAnimationFrame(() => el.focus());
  };

  const save = async (statusOverride?: PostForm['status']) => {
    const body = { ...form, status: statusOverride ?? form.status, title: form.title.trim(), publishedAt: form.publishedAt || null };
    const local: Record<string, string> = {};
    if (body.title.length < 3) local.title = 'Title must be at least 3 characters';
    if (!body.slug) local.slug = 'Slug is required';
    if (Object.keys(local).length) {
      setErrors(local);
      toast.error('Please fix the highlighted fields');
      return;
    }
    setSaving(true);
    try {
      const res = isNew ? await api.post<FullPost>('/blog/admin', body) : await api.put<FullPost>(`/blog/admin/${id}`, body);
      const f = fromPost(res);
      setForm(f);
      setBase(JSON.stringify(f));
      setErrors({});
      void qc.invalidateQueries({ queryKey: ['cms-blog'] });
      qc.setQueryData(['cms-blog-post', res._id], res);
      toast.success(f.status === 'published' ? 'Article published' : 'Draft saved', f.status === 'published' ? 'It is now live on the blog.' : undefined);
      if (isNew) navigate(`/admin/website/blog/${res._id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        if (/duplicate|E11000|exists/i.test(err.message)) fe.slug = 'Another article already uses this slug';
        setErrors(fe);
      }
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const tool = 'grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-fg/[0.07] hover:text-fg';
  const published = form.status === 'published';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/admin/website/blog" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-fg/[0.06] hover:text-fg" aria-label="Back to blog">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Blog</p>
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{isNew ? 'New article' : form.title || 'Untitled'}</h1>
        </div>
        {dirty ? <Badge tone="warning">Unsaved changes</Badge> : !isNew && <Badge tone={published ? 'success' : 'neutral'}>{published ? 'Published' : 'Draft'}</Badge>}
        {!isNew && published && (
          <a href={`/blog/${form.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            <ExternalLink className="h-4 w-4" /> View
          </a>
        )}
        <Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={saving} onClick={() => void save()}>
          Save
        </Button>
        {!published && (
          <Button loading={saving} onClick={() => void save('published')}>
            Publish
          </Button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="card space-y-4 p-5">
            <div>
              <LabelRow htmlFor="b-title" label="Title" required right={<CharCount value={form.title} max={160} />} />
              <input id="b-title" className="input text-lg font-semibold" value={form.title} onChange={(e) => set('title', e.target.value)} aria-invalid={errors.title ? true : undefined} />
              <FieldError>{errors.title}</FieldError>
            </div>
            <div>
              <LabelRow htmlFor="b-slug" label="URL slug" required />
              <div className="flex">
                <span className="inline-flex items-center rounded-l-theme-sm border border-r-0 border-line bg-fg/[0.04] px-3 text-sm text-muted">/blog/</span>
                <input
                  id="b-slug"
                  className="input rounded-l-none font-mono text-[0.85rem]"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  aria-invalid={errors.slug ? true : undefined}
                />
              </div>
              <FieldError>{errors.slug}</FieldError>
            </div>
            <div>
              <LabelRow htmlFor="b-excerpt" label="Excerpt" right={<CharCount value={form.excerpt} max={400} />} />
              <textarea id="b-excerpt" rows={2} className="input resize-y" value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} aria-invalid={errors.excerpt ? true : undefined} />
              <FieldError>{errors.excerpt}</FieldError>
              <Hint>{!errors.excerpt && 'Shown on blog cards and as the default meta description.'}</Hint>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 border-b border-line/70 px-3 py-2">
              <button type="button" className={tool} onClick={() => linePrefix('## ')} aria-label="Heading" title="Heading">
                <Heading2 className="h-4 w-4" />
              </button>
              <button type="button" className={tool} onClick={() => wrap('**')} aria-label="Bold" title="Bold">
                <Bold className="h-4 w-4" />
              </button>
              <button type="button" className={tool} onClick={() => wrap('_')} aria-label="Italic" title="Italic">
                <Italic className="h-4 w-4" />
              </button>
              <button type="button" className={tool} onClick={() => linePrefix('- ')} aria-label="Bulleted list" title="List">
                <List className="h-4 w-4" />
              </button>
              <button type="button" className={tool} onClick={() => linePrefix('> ')} aria-label="Quote" title="Quote">
                <Quote className="h-4 w-4" />
              </button>
              <button type="button" className={tool} onClick={() => wrap('[', '](https://)', 'link text')} aria-label="Link" title="Link">
                <Link2 className="h-4 w-4" />
              </button>
              <button type="button" className={tool} onClick={() => setImgOpen(true)} aria-label="Insert image" title="Insert image">
                <ImagePlus className="h-4 w-4" />
              </button>
              <span className="ml-2 text-xs text-muted">
                {words} words · ~{Math.max(1, Math.round(words / 220))} min read
              </span>
              <div className="flex-1" />
              <Segmented
                label="Editor layout"
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: 'write', label: <PencilLine className="h-3.5 w-3.5" />, title: 'Write' },
                  { value: 'split', label: <Columns2 className="h-3.5 w-3.5" />, title: 'Side by side' },
                  { value: 'preview', label: <Eye className="h-3.5 w-3.5" />, title: 'Preview' },
                ]}
              />
            </div>
            <div className={cn('grid min-h-[520px]', view === 'split' && 'lg:grid-cols-2')}>
              <div className={cn(view === 'preview' && 'hidden', view === 'split' && 'lg:border-r lg:border-line/70')}>
                <label htmlFor="b-content" className="sr-only">
                  Content (Markdown)
                </label>
                <textarea
                  id="b-content"
                  ref={textRef}
                  value={form.content}
                  onChange={(e) => set('content', e.target.value)}
                  placeholder={'Write in Markdown…\n\n## A heading\nSome **bold** text and a [link](/programs).'}
                  className="h-full min-h-[520px] w-full resize-none bg-transparent p-5 font-mono text-[0.85rem] leading-relaxed outline-none placeholder:text-muted/60"
                />
              </div>
              <div className={cn('scrollbar-thin max-h-[70vh] overflow-y-auto p-5', view === 'write' && 'hidden', view === 'split' && 'hidden lg:block')}>
                {form.content.trim() ? (
                  <article className="prose-apex space-y-4 text-sm leading-relaxed text-fg/90 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:rounded-theme-sm [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_code]:rounded [&_code]:bg-fg/10 [&_code]:px-1">
                    <ReactMarkdown skipHtml>{form.content}</ReactMarkdown>
                  </article>
                ) : (
                  <p className="text-sm text-muted">The preview appears here as you write. Raw HTML is not rendered.</p>
                )}
              </div>
            </div>
            <FieldError>{errors.content}</FieldError>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold">Publishing</h2>
            <Switch label="Published" description={published ? 'Visible on the blog (from the publish date).' : 'Draft — only visible to staff.'} checked={published} onChange={(v) => set('status', v ? 'published' : 'draft')} />
            <div>
              <LabelRow htmlFor="b-date" label="Publish date" right={form.publishedAt ? <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => set('publishedAt', null)}>Clear</button> : undefined} />
              <input id="b-date" type="datetime-local" className="input" value={isoToLocalInput(form.publishedAt)} onChange={(e) => set('publishedAt', localInputToIso(e.target.value) || null)} />
              <Hint>Leave empty to use the moment you publish. A future date schedules the article.</Hint>
            </div>
            <div>
              <LabelRow htmlFor="b-author" label="Author name" right={<CharCount value={form.authorName} max={100} />} />
              <input id="b-author" className="input" value={form.authorName} onChange={(e) => set('authorName', e.target.value)} placeholder="Defaults to your name" />
            </div>
          </div>
          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold">Organisation</h2>
            <ImageField label="Cover image" value={form.coverImage} onChange={(v) => set('coverImage', v)} error={errors.coverImage} hint="16:9, at least 1600px wide." />
            <Select label="Category" value={CATEGORIES.includes(form.category) ? form.category : form.category || 'training'} options={Array.from(new Set([...CATEGORIES, form.category].filter(Boolean))).map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))} onChange={(e) => set('category', e.target.value)} />
            <ChipInput label="Tags" value={form.tags} onChange={(v) => set('tags', v)} max={12} lowercase />
          </div>
          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold">SEO</h2>
            <div>
              <LabelRow htmlFor="b-seo-title" label="SEO title" right={<CharCount value={form.seo.title} max={70} />} />
              <input id="b-seo-title" className="input" value={form.seo.title} onChange={(e) => setSeo('title', e.target.value)} placeholder={form.title} aria-invalid={errors['seo.title'] ? true : undefined} />
              <FieldError>{errors['seo.title']}</FieldError>
            </div>
            <div>
              <LabelRow htmlFor="b-seo-desc" label="Meta description" right={<CharCount value={form.seo.description} max={170} />} />
              <textarea id="b-seo-desc" rows={3} className="input resize-y" value={form.seo.description} onChange={(e) => setSeo('description', e.target.value)} placeholder={form.excerpt} aria-invalid={errors['seo.description'] ? true : undefined} />
              <FieldError>{errors['seo.description']}</FieldError>
            </div>
            <ImageField label="Social image" value={form.seo.image} onChange={(v) => setSeo('image', v)} hint="Defaults to the cover image." />
            <Switch label="Hide from search engines" checked={form.seo.noIndex} onChange={(v) => setSeo('noIndex', v)} />
          </div>
        </aside>
      </div>
      <MediaPicker open={imgOpen} onClose={() => setImgOpen(false)} onSelect={([img]) => img && wrap(`![${img.alt || 'image'}](`, ')', img.url)} />
    </div>
  );
}
