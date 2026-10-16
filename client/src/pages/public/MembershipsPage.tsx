import { Check } from 'lucide-react';
import { Seo } from '@/components/layout/Seo';
import { PageHero } from '@/components/layout/PageHero';
import { Reveal, RevealGroup, RevealItem } from '@/components/layout/Reveal';
import { FaqAccordion, PlanCard } from '@/features/sections/cards';
import { CardSkeletons, QuietError } from '@/features/sections/primitives';
import { useFaqs, usePlans } from '@/features/sections/queries';

export default function MembershipsPage() {
  const plans = usePlans();
  const faqs = useFaqs(8);
  const list = plans.data ?? [];
  const highlight = list.find((p) => p.highlight)?.slug;
  const allBenefits = Array.from(new Set(list.filter((p) => !p.isTrial).flatMap((p) => p.benefits)));

  return (
    <>
      <Seo title="Memberships" description="Transparent membership pricing with no joining fees. Choose the commitment that fits your training." />
      <PageHero eyebrow="Memberships" title="Choose your commitment." description="Transparent pricing, no joining fees, and every plan starts with a coaching assessment." />
      <section className="section" aria-label="Membership plans">
        <div className="container">
          {plans.isLoading ? (
            <CardSkeletons count={4} className="lg:grid-cols-4" itemClassName="h-[520px]" />
          ) : plans.isError ? (
            <QuietError what="Membership plans" onRetry={() => plans.refetch()} />
          ) : list.length === 0 ? (
            <p className="py-16 text-center text-muted">Membership options are being updated — please contact the club for current pricing.</p>
          ) : (
            <RevealGroup className={`grid gap-5 md:grid-cols-2 ${list.length >= 4 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'}`}>
              {list.map((p) => (
                <RevealItem key={p.id}>
                  <PlanCard plan={p} highlighted={p.slug === highlight} />
                </RevealItem>
              ))}
            </RevealGroup>
          )}
          {allBenefits.length > 0 && (
            <Reveal className="mt-20 grid gap-10 border-t border-fg/[0.08] pt-14 lg:grid-cols-12">
              <h2 className="font-display text-display-md font-semibold lg:col-span-4">Included across memberships</h2>
              <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:col-span-8">
                {allBenefits.slice(0, 12).map((b) => (
                  <li key={b} className="flex items-start gap-3 border-b border-fg/[0.07] pb-4 text-fg/85">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> {b}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
      </section>
      {faqs.data && faqs.data.length > 0 && (
        <section className="section border-t border-fg/[0.06]" aria-labelledby="m-faq">
          <div className="container grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow mb-5">FAQ</p>
              <h2 id="m-faq" className="font-display text-display-md font-semibold">
                Before you join
              </h2>
            </div>
            <div className="lg:col-span-8">
              <FaqAccordion faqs={faqs.data} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
