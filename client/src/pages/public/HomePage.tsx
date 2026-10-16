import { CmsPageView } from './CmsPageView';

/** Home: the published CMS page flagged as home (GET /pages/public/home). */
export default function HomePage() {
  return <CmsPageView slug="home" home />;
}
