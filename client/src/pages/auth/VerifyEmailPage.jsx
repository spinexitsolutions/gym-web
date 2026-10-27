import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api.js';
import { ME_KEY } from '../../context/AuthContext.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { PageLoader } from '../../components/ui/States.jsx';
import { Seo } from '../../components/layout/Seo.jsx';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const qc = useQueryClient();
  const [state, setState] = useState({ status: token ? 'loading' : 'error', message: token ? '' : 'This verification link is missing its token.' });
  const once = useRef(false);

  useEffect(() => {
    if (!token || once.current) return;
    once.current = true; // React StrictMode runs effects twice in development; the token is single-use.
    api.post('/auth/verify-email', { token })
      .then((res) => { setState({ status: 'success', message: res.message }); qc.invalidateQueries({ queryKey: ME_KEY }); })
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, [token, qc]);

  if (state.status === 'loading') return <PageLoader />;
  const ok = state.status === 'success';
  return (
    <div className="text-center">
      <Seo title="Verify email" noindex />
      {ok ? <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden /> : <XCircle className="mx-auto h-14 w-14 text-danger" aria-hidden />}
      <h1 className="mt-6 text-3xl font-semibold">{ok ? 'Email verified' : 'Verification failed'}</h1>
      <p className="mt-3 text-muted" role="status">{state.message}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button to="/account">{ok ? 'Go to my account' : 'My account'}</Button>
        {!ok && <Button to="/login" variant="outline">Log in</Button>}
      </div>
      {!ok && <p className="mt-6 text-sm text-muted">You can request a new link from <Link to="/account" className="text-gold">your account</Link>.</p>}
    </div>
  );
}
