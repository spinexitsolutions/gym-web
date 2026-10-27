import { useSettings } from '../../hooks/useSettings.js';
import { Seo } from '../../components/layout/Seo.jsx';
import { Hero } from '../../components/sections/Hero.jsx';
import { Stats } from '../../components/sections/Stats.jsx';
import { About } from '../../components/sections/About.jsx';
import { Facilities } from '../../components/sections/Facilities.jsx';
import { FeaturedTrainers } from '../../components/sections/Trainers.jsx';
import { PricingSection } from '../../components/sections/Pricing.jsx';
import { FeaturedPrograms } from '../../components/sections/Programs.jsx';
import { Transformations } from '../../components/sections/Transformations.jsx';
import { Testimonials } from '../../components/sections/Testimonials.jsx';
import { Events } from '../../components/sections/Events.jsx';
import { FitnessTools } from '../../components/sections/FitnessTools.jsx';
import { Faq } from '../../components/sections/Faq.jsx';
import { ContactSection } from '../../components/sections/ContactSection.jsx';
import { Newsletter } from '../../components/sections/Newsletter.jsx';

export default function HomePage() {
  const { data: s } = useSettings();
  const on = s.sections;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ExerciseGym',
    name: s.brand.name,
    description: s.seo.description,
    image: s.seo.ogImage?.url,
    telephone: s.contact.phone,
    email: s.contact.email,
    address: { '@type': 'PostalAddress', streetAddress: s.contact.address, addressLocality: s.contact.city },
    url: s.seo.siteUrl || undefined,
    sameAs: Object.values(s.social).filter(Boolean),
  };
  return (
    <>
      <Seo path="/" jsonLd={jsonLd} />
      <Hero hero={s.hero} accent={s.theme.accent} />
      {on.stats && <Stats stats={s.stats} />}
      {on.about && <About about={s.about} />}
      {on.facilities && <Facilities facilities={s.facilities} />}
      {on.trainers && <FeaturedTrainers />}
      {on.plans && <PricingSection />}
      {on.programs && <FeaturedPrograms />}
      {on.transformations && <Transformations />}
      {on.testimonials && <Testimonials />}
      {on.events && <Events />}
      {on.tools && <FitnessTools />}
      {on.faq && <Faq />}
      {on.contact && <ContactSection contact={s.contact} />}
      {on.newsletter && <Newsletter newsletter={s.newsletter} />}
    </>
  );
}
