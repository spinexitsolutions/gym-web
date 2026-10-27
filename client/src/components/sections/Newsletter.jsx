import { useState } from 'react';
import { contentApi } from '../../services/content.js';
import { Button } from '../ui/Button.jsx';
import { Reveal } from '../ui/Reveal.jsx';

export function Newsletter({ newsletter }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });
  if (!newsletter?.enabled) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setState({ status: 'error', message: 'Enter a valid email address.' });
    setState({ status: 'loading', message: '' });
    try {
      const res = await contentApi.newsletter(email);
      setState({ status: 'success', message: res.message });
      setEmail('');
    } catch (err) {
      setState({ status: 'error', message: err.message });
    }
  };

  return (
    <section aria-labelledby="newsletter-title" className="border-y border-line/10 bg-gradient-to-br from-gold/10 via-surface to-bg">
      <Reveal className="container flex flex-col items-start justify-between gap-8 py-16 lg:flex-row lg:items-center">
        <div className="max-w-xl">
          <h2 id="newsletter-title" className="text-3xl font-semibold md:text-4xl">{newsletter.title}</h2>
          <p className="mt-3 text-muted">{newsletter.subtitle}</p>
        </div>
        <form onSubmit={submit} noValidate className="w-full max-w-md">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">Email address</label>
            <input id="newsletter-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
              aria-invalid={state.status === 'error' || undefined} aria-describedby="newsletter-msg" className="input flex-1" />
            <Button type="submit" loading={state.status === 'loading'}>Subscribe</Button>
          </div>
          <p id="newsletter-msg" role="status" className={`mt-3 min-h-5 text-sm ${state.status === 'error' ? 'text-danger' : 'text-success'}`}>{state.message}</p>
        </form>
      </Reveal>
    </section>
  );
}
