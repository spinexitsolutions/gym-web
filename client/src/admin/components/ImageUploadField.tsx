import { useId, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { Button, FieldWrap, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import type { UploadedAsset } from './types';

/** Uploads one image to the public media library and returns the preferred URL. */
export async function uploadImage(file: File, folder: string, preferWidth?: number): Promise<string> {
  const fd = new FormData();
  fd.append('files', file);
  fd.append('folder', folder);
  const res = await api.upload<{ uploaded: UploadedAsset[]; errors: { file: string; message: string }[] }>('/media/images', fd);
  const a = res.uploaded[0];
  if (!a) throw new Error(res.errors[0]?.message ?? 'Upload failed');
  if (preferWidth) return a.variants?.find((v) => v.width === preferWidth)?.url ?? a.url;
  return a.url;
}

interface Props {
  label?: ReactNode;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  /** Prefer a resized variant of this width (e.g. 480 for avatars). */
  preferWidth?: number;
  error?: string;
  hint?: ReactNode;
  /** Preview shape */
  aspect?: 'square' | 'wide' | 'logo';
}

/** URL field + upload button + preview. Accepts uploaded paths (/uploads/…) or https URLs. */
export function ImageUploadField({ label, value, onChange, folder, preferWidth, error, hint, aspect = 'square' }: Props) {
  const id = useId();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const box = aspect === 'wide' ? 'h-16 w-28' : aspect === 'logo' ? 'h-14 w-24' : 'h-16 w-16';
  return (
    <FieldWrap label={label} error={error} hint={hint ?? 'Upload an image or paste an https:// URL.'} id={id}>
      <div className="flex items-center gap-3">
        <div className={`grid shrink-0 place-items-center overflow-hidden rounded-theme-sm border border-line bg-fg/[0.03] ${box}`}>
          {value ? <img src={value} alt="" className="h-full w-full object-contain" /> : <ImagePlus className="h-5 w-5 text-muted" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input id={id} className="input" value={value} placeholder="/uploads/… or https://…" onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" loading={busy} icon={<Upload className="h-3.5 w-3.5" />} onClick={() => file.current?.click()}>
              Upload
            </Button>
            {value && (
              <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onChange('')}>
                Remove
              </Button>
            )}
          </div>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            try {
              onChange(await uploadImage(f, folder, preferWidth));
              toast.success('Image uploaded');
            } catch (err) {
              toast.error(err);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </FieldWrap>
  );
}
