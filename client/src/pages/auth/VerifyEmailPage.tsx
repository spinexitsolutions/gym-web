import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { AuthShell } from './AuthShell';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error');
  const [msg, setMsg] = useState('This verification link is incomplete.');
  const once = useRef(false);
  useEffect(() => {
    if (!token || once.current) return;
    once.current = true;
    api
      .post('/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch((e) => {
        setMsg(errorMessage(e));
        setState('error');
      });
  }, [token]);
  return (
    <AuthShell title="Email verification">
      {state === 'loading' && <Spinner label="Verifying" />}
      {state === 'ok' && (
        <div className="space-y-5">
          <Alert tone="success" title="Email verified">Your account is ready.</Alert>
          <Link to="/login" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      )}
      {state === 'error' && <Alert tone="danger" title="Couldn’t verify">{msg}</Alert>}
    </AuthShell>
  );
}
