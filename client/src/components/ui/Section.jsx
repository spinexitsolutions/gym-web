import { cn } from '../../utils/cn.js';
import { Reveal } from './Reveal.jsx';

export function Section({ id, className, children, ...props }) {
  return (
    <section id={id} className={cn('relative py-20 md:py-28', className)} {...props}>
      <div className="container">{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, lead, align = 'left', className, action }) {
  return (
    <Reveal className={cn('mb-12 md:mb-16', align === 'center' && 'mx-auto max-w-2xl text-center', className)}>
      <div className={cn(action && 'flex flex-col gap-6 md:flex-row md:items-end md:justify-between')}>
        <div className={cn(align !== 'center' && 'max-w-2xl')}>
          {eyebrow && (
            <p className={cn('eyebrow mb-4 flex items-center gap-3', align === 'center' && 'justify-center')}>
              <span className="h-px w-8 bg-gold" aria-hidden />
              {eyebrow}
            </p>
          )}
          <h2 className="text-balance text-3xl font-semibold leading-[1.1] md:text-5xl">{title}</h2>
          {lead && <p className="mt-5 text-pretty text-base leading-relaxed text-muted md:text-lg">{lead}</p>}
        </div>
        {action}
      </div>
    </Reveal>
  );
}
