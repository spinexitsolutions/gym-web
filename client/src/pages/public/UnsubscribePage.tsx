import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { Seo } from '@/components/layout/Seo';
import { Button } from '@/components/ui';
import { FormSuccess } from '@/features/sections/forms';

/** Confirms a newsletter unsubscribe (explicit click, so link scanners can't unsubscribe people). */
export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [done, setDone] = useState(false);
  const m = useMutation({ mutationFn: () => api.post('/cms/newsletter/unsubscribe', { token, email }), onSuccess: () => setDone(true) });
  const valid = token.length >= 10 && /.+@.+\..+/.test(email);

  return (
    <section className="container flex min-h-[75svh] max-w-xl flex-col justify-center pb-20 pt-[calc(var(--chrome-h,6rem)+3rem)]">
      <Seo title="Unsubscribe" noIndex />
      {done ? (
        <FormSuccess title="You’ve been unsubscribed">
          <p>
            {email} won’t receive our newsletter any more. Changed your mind? You can subscribe again from the footer of any page.
          </p>
          <Link to="/" className="btn btn-secondary mt-6">
            Back to home
          </Link>
        </FormSuccess>
      ) : valid ? (
        <div>
          <p className="eyebrow mb-5">Newsletter</p>
          <h1 className="font-display text-display-md font-semibold">Unsubscribe from training notes?</h1>
          <p className="mt-4 text-muted">
            We’ll stop sending the monthly newsletter to <span className="text-fg">{email}</span>. Account and booking emails are not affected.
          </p>
          <div aria-live="assertive">{m.isError && <p className="mt-6 rounded-theme-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm">{errorMessage(m.error)}</p>}</div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" loading={m.isPending} onClick={() => m.mutate()}>
              Confirm unsubscribe
            </Button>
            <Link to="/" className="btn btn-ghost btn-lg">
              Keep me subscribed
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="font-display text-display-md font-semibold">This link is incomplete</h1>
          <p className="mt-4 text-muted">Please use the unsubscribe link from one of our emails, or contact us and we’ll remove you manually.</p>
          <Link to="/contact" className="btn btn-secondary mt-8">
            Contact us
          </Link>
        </div>
      )}
    </section>
  );
}
