import { useParams } from 'react-router-dom';
import { CmsPageView } from './CmsPageView';

/** Any published CMS page at /:slug; unknown slugs render the 404 page. */
export default function CmsPage() {
  const { slug = '' } = useParams();
  return <CmsPageView key={slug} slug={slug} />;
}
