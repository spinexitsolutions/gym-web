# Website CMS & theme builder

The admin can change the public website (pages, sections, theme, media, 3D models and content collections) without touching code. Everything follows the same rule: **edit a draft → preview it → publish**. The live site only changes on publish.

Admin UI: `/admin/website/*` (code in `client/src/admin/cms/`). API: `server/src/routes/{pages,themes,media,cms,blog}.routes.ts`.

| Area | Admin route | API |
| --- | --- | --- |
| Pages & sections (builder) | `/admin/website/pages`, `/admin/website/pages/:id` | `/api/v1/pages` |
| Theme & brand | `/admin/website/theme` | `/api/v1/themes` |
| Media library | `/admin/website/media` | `/api/v1/media` |
| 3D models | `/admin/website/models` | `/api/v1/media?kind=model`, `/media/models` |
| Content collections | `/admin/website/content/:collection` | `/api/v1/cms/admin/:collection` |
| Blog | `/admin/website/blog`, `/admin/website/blog/:id` (`new`) | `/api/v1/blog/admin` |
| Reviews / messages / subscribers | `/admin/website/{reviews,messages,subscribers}` | `/api/v1/cms/admin/...` |

---

## Pages: draft, publish, versions

A page document holds a **draft** (`title`, `seo`, `featuredImage`, `sections[]`) plus page properties (`slug`, `showInNav`, `navOrder`, `status`) and a pointer to the **published version**.

- **Save draft**: `PUT /pages/:id/draft`. Drafts may be incomplete (sections are only checked against the loose `draftSectionSchema`). The builder autosaves about 1.5 s after the last change, and also saves on **Save** or Ctrl/⌘+S. The top bar shows *Saving… / Draft saved / Unsaved changes / Save failed*. The live page is never touched.
- **Validation**: the builder validates every section on the client with the same zod schemas the server uses (`sectionPropsSchemas`). `GET /pages/:id` and the draft-save response also return `validation.errors` (`[{index, id, type, issues: [{path, message}]}]`). Issue paths such as `props.ctas.0.href` are mapped onto the matching field control, and each section row shows an error badge.
- **Publish**: `POST /pages/:id/publish {note?}`. The server validates the whole draft with `validateSections`. If anything is invalid it responds **422** with per-section errors in `details`, and **the live page is unchanged**. The builder lists the errors and jumps to the first invalid section. On success it writes an immutable `PageVersion` (`version = n+1`) and bumps the content version.
- **Versions**: `GET /pages/:id/versions`. *Restore* (`POST /pages/:id/versions/:versionId/restore`) copies a version **into the draft**, so you can review it and then publish it again.
- **Unpublish / duplicate / delete**: available from the pages list. The home page and system pages cannot be deleted, and the home page cannot be unpublished.
- **Live updates**: public visitors' `SiteProvider` polls `GET /cms/version` (every 60 s and on tab focus) and refetches published content when it changes.

> Note: `slug`, `showInNav` and `navOrder` are page properties rather than draft fields, so saving them takes effect on the live site straight away. The settings panel says this.

## Section schema

Section types are defined in **`shared/src/sections.ts`**:

- `sectionPropsSchemas[type]`: the zod schema for `props`, used on publish (server), in the builder (client) and before rendering (public site).
- `SECTION_META[type]`: `label`, `description`, optional `dataSource` (dynamic sections that render CMS data), `fields: FieldDef[]` and `defaults`.
- `createSection(type)` builds a new section with defaults; `newSectionId()` makes ids.

The builder's editor is **generated from `fields`**. Each `FieldDef.type` maps to a control in `client/src/admin/cms/components/FieldControls.tsx`:

| FieldType | Control |
| --- | --- |
| `text`, `textarea` | Input or textarea with a character counter (max length read from the zod schema) |
| `number`, `boolean`, `select` | Number input (min/max), switch, select |
| `image` | `ImageField` (thumbnail plus the `MediaPicker` modal: library, upload or paste URL) |
| `link` | Text input with a hint about `/path`, `#anchor` and `https://` |
| `datetime` | `datetime-local`, converted to an ISO string |
| `ctas` / `cta` | Button list editor (label, href, variant; max taken from the schema) / a single optional button |
| `scene` | `SceneEditor` (model, scale, rotation in degrees, position, camera, fov, animation, environment, toggles) |
| `stringList`, `statItems`, `equipmentItems`, `galleryImages`, `background`, `model` | Dedicated list or group editors |

### Adding a new section type

1. In `shared/src/sections.ts`, add a zod schema to `sectionPropsSchemas` (reuse `common` for eyebrow, heading, subheading, anchorId and background). Then add an entry to `SECTION_META` with label, description, `fields` (use only existing `FieldType`s, or add a new control in `FieldControls.tsx`) and `defaults`.
2. Add a renderer to `client/src/features/sections/registry.tsx` (`SECTION_RENDERERS`). The type `{ [K in SectionType]: … }` makes TypeScript require it.
3. Add an icon in `client/src/admin/cms/components/sectionIcons.ts` (also type-checked). If the section reads CMS data, add its `dataSource` to `DATA_SOURCE_LINKS` so the editor links to where that data is managed.

Existing drafts keep working because drafts are loosely typed, and publish validates against the new schema.

## Live preview protocol

`/preview/:pageId` (admin-only) renders the page **draft** with the public section renderer.

- On mount the preview posts `{ type: 'apex-preview-ready' }` to `window.parent`.
- The admin posts `{ type: 'apex-preview', sections?: DraftSection[], theme?: ThemeTokens }` to `iframe.contentWindow`, targeting `window.location.origin` only. The preview re-renders with that unsaved state.
- The builder (`components/PreviewFrame.tsx`) posts the current sections when it receives *ready*, on `load`, and about 200 ms after each edit. Device toggles are 1280 / 820 / 390 px, and the frame is scaled to fit the panel.
- Theme preview uses `/preview/home-theme?themePreview=1`. This renders the published home page, and `?themePreview=1` stops `SiteProvider` from applying the published theme over the posted one.

## Theme tokens

`shared/src/theme.ts` defines `themeTokensSchema`: `mode`; `colors.{primary, secondary, accent, background, surface, text, muted, border, success, warning, danger}`; `fonts.{heading, body}` (allow-listed `FONT_OPTIONS`, loaded from Google Fonts); `radius`; `buttonShape`; `buttonStyle`; `cardStyle`; `shadow`; `spacing`; `gradient.{from, to, angle}`; `effects.{customCursor, grain, glow}`; `header.{transparentOnTop, showLogin, ctaLabel, ctaHref}`; and `footer.{tagline, showNewsletter}`.

- `client/src/lib/theme.ts` `themeToCssVars()` turns tokens into CSS variables (`--c-*` RGB channels, `--radius`, `--btn-radius`, `--shadow`, `--section-y`, …), which Tailwind's colour tokens use. `applyTheme()` also sets `data-mode`, `data-card`, `data-btn`, `data-grain` and `data-glow`, which the `.card` and `.btn` variants depend on.
- API: `GET /themes` returns `{draft, published, presets, history, hasUnpublishedChanges}`. `PUT /themes/draft {tokens, presetId?}`, `POST /themes/publish`, `POST /themes/reset-draft` (default *Titanium Lime*) and `POST /themes/history/:i/restore` (loads into the draft) complete it. `GET /themes/published` is public.
- The theme page has presets, colour pickers with hex validation, WCAG contrast warnings (text vs background/surface below 4.5:1, muted below 3:1, button text vs primary), font previews, visual option tiles and a component sampler. The sampler applies `themeToCssVars(draft)` and the `data-*` attributes to a wrapper element, so it shows the draft without changing the admin's own theme.

## Media rules

- Images: `POST /media/images` (multipart `files`, up to 10 per request, plus `folder`). Accepted types are JPG, PNG, WebP, AVIF and GIF, up to 8 MB each, 16 to 8000 px per side. SVG is rejected. The real type is detected from magic bytes. Images are re-encoded (metadata stripped) and given responsive WebP variants (480/1024/1920 px wide when the image is larger). The server returns `{uploaded, errors}` with per-file errors. The client pre-checks extension and size, but the server is authoritative.
- `PATCH /media/:id {name, alt, folder}`, `DELETE /media/:id`. Deleting does not rewrite pages that reference the URL; they lose the image until it is replaced (the UI warns about this).
- `MediaPicker` (`client/src/admin/cms/components/MediaPicker.tsx`) is the reusable picker used by the builder, content forms and blog. It offers library search and folder filter, upload, or a pasted `https://` / `/path` URL (validated with `mediaUrl`).

## 3D model workflow

1. Upload a `.glb` (`POST /media/models`, field `file` plus `name`). Requirements: a single binary glTF 2.0 file with embedded textures, no Draco or meshopt compression, at most 15 MB and 500k triangles, and you must hold the rights or a licence. The server inspects the file and stores `meshes`, `materials` and `triangles`. Status starts as **pending**.
2. Review it in **3D models**: `POST /media/models/:id/review {status: approved|rejected, notes}`.
3. Approved models are added to `/cms/site` `models` as `asset:<id>` and appear in every scene's **Model** dropdown (hero and 3D equipment sections). Built-in procedural models (`BUILTIN_MODELS`) are always available.

## Content collections

`/admin/website/content/:collection` is a single config-driven CRUD page for `programs | faqs | facilities | testimonials | gallery | promotions`. Field specs mirror `server/src/validators/content.validators.ts`, and the server's 422 field errors are shown inline. Because `PUT` validates the full schema, the UI always sends the complete item, including for the published toggle and up/down reordering (which renumbers `order` to 0, 10, 20 and so on).

**Gallery consent**: transformation and before/after items involve member data. Publishing is disabled until "Member's written consent recorded" is ticked (with a reference such as a release form id). The server enforces the same rule, and the public API never returns member items without consent.

## Blog

Markdown editor with a side-by-side preview (`react-markdown` with `skipHtml`, so raw HTML is never rendered), a formatting toolbar, image insert via `MediaPicker`, slug generated from the title, cover image, category, tags, author, draft/published status, a publish date (a future date schedules the post) and SEO fields with character counters.
