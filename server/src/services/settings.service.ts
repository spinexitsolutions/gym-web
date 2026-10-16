import { DEFAULT_THEME, siteSettingsSchema, themeTokensSchema, type SiteSettings, type ThemeTokens } from '@apex/shared';
import { ThemeConfigurationModel, WebsiteSettingsModel } from '../models';

export const DEFAULT_SITE_SETTINGS: SiteSettings = siteSettingsSchema.parse({
  brand: { name: 'Apex Athletics', shortName: 'APEX', logoUrl: '', logoAlt: 'Apex Athletics', faviconUrl: '' },
  announcement: { enabled: true, text: 'Founding memberships now open — first month 20% off with code APEX20', href: '/memberships' },
  contact: { email: 'hello@apexathletics.example', phone: '+91 98765 43210', whatsapp: '', addressLine: '12 Performance Avenue, Indiranagar', city: 'Bengaluru', region: 'Karnataka', postalCode: '560038', country: 'IN' },
  location: { lat: 12.9719, lng: 77.6412, mapEmbedUrl: '', directionsUrl: '' },
  hours: [
    { day: 'mon', open: '05:30', close: '22:30' },
    { day: 'tue', open: '05:30', close: '22:30' },
    { day: 'wed', open: '05:30', close: '22:30' },
    { day: 'thu', open: '05:30', close: '22:30' },
    { day: 'fri', open: '05:30', close: '22:30' },
    { day: 'sat', open: '06:30', close: '20:00' },
    { day: 'sun', open: '07:00', close: '13:00' },
  ],
  social: { instagram: 'https://instagram.com/', facebook: '', youtube: 'https://youtube.com/', x: '', linkedin: '' },
  business: { legalName: 'Apex Athletics Pvt. Ltd.', gstin: '', currency: 'INR', timezone: 'Asia/Kolkata', foundedYear: 2014 },
  seo: {
    title: 'Apex Athletics — Luxury Performance Gym',
    description: 'Elite coaching, precision equipment and a luxury training floor. Memberships, classes and personal training.',
    image: '',
    noIndex: false,
    siteUrl: '',
    titleTemplate: '%s | Apex Athletics',
  },
  notifications: {},
  privacy: {},
  bookings: {},
  loyalty: {},
});

let cache: { settings: SiteSettings; at: number } | null = null;
const TTL = 30_000;

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < TTL) return cache.settings;
  const doc = await WebsiteSettingsModel.findOne({ key: 'site' }).lean();
  const parsed = doc ? siteSettingsSchema.safeParse(doc.data) : null;
  const settings = parsed?.success ? parsed.data : DEFAULT_SITE_SETTINGS;
  cache = { settings, at: Date.now() };
  return settings;
}

/** Gym timezone from the cached settings (sync; falls back to the default). */
export const gymTimeZone = () => cache?.settings.business.timezone ?? DEFAULT_SITE_SETTINGS.business.timezone;

export function invalidateSettingsCache() {
  cache = null;
}

export async function saveSiteSettings(settings: SiteSettings, userId?: string) {
  await WebsiteSettingsModel.findOneAndUpdate({ key: 'site' }, { data: settings, updatedBy: userId }, { upsert: true });
  invalidateSettingsCache();
}

export async function getThemeDoc() {
  let doc = await ThemeConfigurationModel.findOne({ key: 'default' });
  if (!doc) {
    doc = await ThemeConfigurationModel.create({ key: 'default', draft: DEFAULT_THEME, published: DEFAULT_THEME, presetId: 'titanium-lime', publishedAt: new Date() });
  }
  return doc;
}

export async function getPublishedTheme(): Promise<ThemeTokens> {
  const doc = await getThemeDoc();
  const parsed = themeTokensSchema.safeParse(doc.published);
  return parsed.success ? parsed.data : DEFAULT_THEME;
}
