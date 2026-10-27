import { useRef, useState } from 'react';
import { UploadCloud, Trash2, Link2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { Img } from '../ui/Img.jsx';
import { Button } from '../ui/Button.jsx';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const LIMITS = { image: 8, video: 80, icon: 0.5 };

/**
 * value: { url, publicId?, alt? }. Uploads to /api/admin/media/:kind → Cloudinary.
 * Admins can also paste a licensed image URL instead of uploading.
 */
export function ImageUpload({ value, onChange, folder = 'misc', kind = 'image', label, withAlt = true }) {
  const input = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [urlMode, setUrlMode] = useState(false);
  const v = value || {};

  const pick = async (file) => {
    setError('');
    const types = kind === 'video' ? ['video/mp4', 'video/webm'] : kind === 'icon' ? ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'] : IMAGE_TYPES;
    if (!types.includes(file.type)) return setError(`Unsupported file type (${file.type || 'unknown'})`);
    if (file.size > LIMITS[kind] * 1024 * 1024) return setError(`File must be ${LIMITS[kind] < 1 ? `${LIMITS[kind] * 1024} KB` : `${LIMITS[kind]} MB`} or smaller`);
    const form = new FormData();
    form.append('file', file);
    try {
      setProgress(0);
      const res = await api.post(`/admin/media/${kind}?folder=${folder}`, form, { onUploadProgress: setProgress });
      onChange({ ...v, url: res.data.url, publicId: res.data.publicId });
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-3">
      {label && <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative aspect-video w-full overflow-hidden rounded-brand border border-dashed border-line/20 bg-elevated sm:w-56">
          {v.url ? (kind === 'video'
            ? <video src={v.url} className="h-full w-full object-cover" muted controls />
            : <Img src={v.url} alt={v.alt || ''} sizes="224px" className="h-full w-full" />)
            : <div className="grid h-full place-items-center text-xs text-muted">No {kind} selected</div>}
          {progress !== null && (
            <div className="absolute inset-0 grid place-items-center bg-[#0B0B0C]/70" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <div className="w-3/4">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} /></div>
                <p className="mt-2 text-center text-xs text-white">{progress}%</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <input ref={input} type="file" className="sr-only" tabIndex={-1} accept={kind === 'video' ? 'video/mp4,video/webm' : kind === 'icon' ? 'image/png,image/x-icon,image/svg+xml' : IMAGE_TYPES.join(',')} onChange={(e) => { if (e.target.files[0]) pick(e.target.files[0]); e.target.value = ''; }} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={progress !== null}><UploadCloud className="h-4 w-4" aria-hidden />Upload</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setUrlMode((m) => !m)}><Link2 className="h-4 w-4" aria-hidden />Use URL</Button>
            {v.url && <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ url: '', alt: v.alt || '' })}><Trash2 className="h-4 w-4" aria-hidden />Remove</Button>}
          </div>
          {urlMode && <input className="input" placeholder="https://… (licensed image URL)" value={v.url || ''} onChange={(e) => onChange({ ...v, url: e.target.value.trim(), publicId: undefined })} aria-label="Image URL" />}
          {withAlt && kind !== 'video' && <input className="input" placeholder="Alt text — describe the image for screen readers" value={v.alt || ''} maxLength={200} onChange={(e) => onChange({ ...v, alt: e.target.value })} aria-label="Alt text" />}
          <p className="text-xs text-muted">{kind === 'video' ? 'MP4 or WebM, up to 80 MB.' : kind === 'icon' ? 'PNG, ICO or SVG, up to 512 KB.' : 'JPG, PNG, WebP or AVIF up to 8 MB. Served as WebP/AVIF automatically.'}</p>
          {error && <p className="text-xs text-danger" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
