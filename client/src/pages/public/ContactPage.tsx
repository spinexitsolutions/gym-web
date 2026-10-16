import { Seo } from '@/components/layout/Seo';
import { PageHero } from '@/components/layout/PageHero';
import { Reveal } from '@/components/layout/Reveal';
import { ContactForm } from '@/features/sections/forms';
import { LocationSection, ContactDetails } from '@/features/sections/sections/ToolSections';
import { sectionPropsSchemas } from '@apex/shared';

const locationProps = sectionPropsSchemas.location.parse({ eyebrow: 'Visit', heading: 'Find the club', showMap: true, showHours: true });

export default function ContactPage() {
  return (
    <>
      <Seo title="Contact" description="Questions about memberships, corporate plans or personal training? Talk to the team." />
      <PageHero eyebrow="Contact" title="Talk to the team." description="Memberships, corporate plans, personal training or a quick question — we reply within one business day." />
      <section className="section" aria-label="Contact details and form">
        <div className="container grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <ContactDetails />
          </Reveal>
          <Reveal delay={0.1} className="card p-6 md:p-10 lg:col-span-7">
            <h2 className="mb-8 font-display text-2xl font-semibold tracking-tight">Send a message</h2>
            <ContactForm />
          </Reveal>
        </div>
      </section>
      <LocationSection p={locationProps} />
    </>
  );
}
