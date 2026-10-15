import type { DraftSection, PageStatus, Seo, ThemeTokens } from '@apex/shared';

/** Per-section validation issue as returned by the server (`validateSections`). */
export interface SectionIssue {
  path: string;
  message: string;
}
export interface SectionError {
  index: number;
  id?: string;
  type?: string;
  issues: SectionIssue[];
}

/** GET /pages list item. */
export interface PageListItem {
  id: string;
  slug: string;
  isHome: boolean;
  system: boolean;
  status: PageStatus;
  title: string;
  seo: Seo;
  featuredImage: string;
  showInNav: boolean;
  navOrder: number;
  publishedVersion: number;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  draftUpdatedAt: string | null;
  updatedAt: string;
  sectionCount: number;
}

/** GET /pages/:id (and PUT /pages/:id/draft response). */
export interface PageDetail extends Omit<PageListItem, 'sectionCount'> {
  sections: DraftSection[];
  validation?: { ok: boolean; errors: SectionError[] };
}

export interface PageVersion {
  _id: string;
  version: number;
  title: string;
  note?: string;
  createdAt: string;
  publishedBy?: { _id: string; name: string } | null;
}

export interface ThemeDoc {
  draft: ThemeTokens;
  published: ThemeTokens;
  presetId?: string;
  publishedAt?: string | null;
  draftUpdatedAt?: string | null;
  hasUnpublishedChanges: boolean;
  history: { index: number; publishedAt: string }[];
  presets: { id: string; label: string; tokens: ThemeTokens }[];
}

export interface MediaAsset {
  _id: string;
  kind: 'image' | 'model';
  visibility: 'public' | 'private';
  storage: 'local' | 'cloudinary';
  url: string;
  variants?: { width: number; url: string }[];
  name: string;
  originalName?: string;
  folder: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  alt?: string;
  model?: { status?: 'pending' | 'approved' | 'rejected'; meshes?: number; materials?: number; triangles?: number; notes?: string };
  createdAt: string;
  updatedAt: string;
}

export interface UploadResult {
  uploaded: MediaAsset[];
  errors: { file: string; message: string }[];
}
