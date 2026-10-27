import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings.js';
import { Seo } from '../../components/layout/Seo.jsx';
import { PageHero } from '../../components/sections/PageHero.jsx';
import { Section } from '../../components/ui/Section.jsx';
import { ContactDetails, MapEmbed } from '../../components/sections/ContactSection.jsx';
import { ContactForm } from '../../components/sections/ContactForm.jsx';

export default function ContactPage() {
  const { data: s } = useSettings();
  const [params] = useSearchParams();
  const interest = ['membership', 'trial', 'personal_training', 'corporate', 'other'].includes(params.get('interest')) ? params.get('interest') : 'membership';
  const trainer = params.get('trainer')?.slice(0, 80);
  const message = trainer ? `I'd like to book a personal training session with ${trainer}. My preferred days/times are: ` : '';
  return (
    <>
      <Seo title="Contact us" description={`Visit ${s.brand.name} at ${s.contact.address}, ${s.contact.city}. Call, email or WhatsApp us.`} path="/contact" />
      <PageHero eyebrow="Contact" title="Let's talk about your goals" lead="Questions about memberships, personal training or a free trial? Send us a message — we reply within one business day." />
      <Section className="pt-12 md:pt-16">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <ContactDetails contact={s.contact} />
          <div className="glass relative rounded-brand p-6 md:p-10">
            <h2 className="mb-6 font-sans text-xl font-semibold">Send a message</h2>
            <ContactForm source="contact_page" defaultInterest={interest} defaultMessage={message} />
          </div>
        </div>
        <div className="mt-16 aspect-[16/9] overflow-hidden rounded-brand border border-line/10 md:aspect-[21/9]">
          <MapEmbed query={s.contact.mapQuery} title={`Map showing ${s.brand.name}`} />
        </div>
      </Section>
    </>
  );
}
