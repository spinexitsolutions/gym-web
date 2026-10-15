import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/app/AuthProvider';
import { RequireAuth } from '@/app/RequireAuth';
import { SiteProvider } from '@/app/SiteProvider';
import { ToastProvider } from '@/components/ui';
import LoginPage from '@/pages/auth/LoginPage';
import { safeNext } from '@/pages/auth/AuthShell';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockApi(routes: Record<string, () => Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.includes(k));
    return key ? routes[key]() : json(404, { error: { code: 'NOT_FOUND', message: 'nf' } });
  });
}

function wrap(ui: React.ReactNode, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>
          <SiteProvider>
            <AuthProvider>
              <ToastProvider>{ui}</ToastProvider>
            </AuthProvider>
          </SiteProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());
document.cookie = 'apex_csrf=t';

describe('route guard', () => {
  it('redirects anonymous users to login with a return path', async () => {
    mockApi({ '/auth/me': () => json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }), '/auth/refresh': () => json(401, {}), '/cms/site': () => json(500, {}) });
    wrap(
      <Routes>
        <Route path="/member" element={<RequireAuth roles={['member']}><p>secret</p></RequireAuth>} />
        <Route path="/login" element={<p>login screen</p>} />
      </Routes>,
      '/member',
    );
    expect(await screen.findByText('login screen')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('sends users with the wrong role to their own dashboard', async () => {
    mockApi({ '/auth/me': () => json(200, { data: { user: { id: '1', role: 'member', permissions: [], name: 'M', email: 'm@x' } } }), '/cms/site': () => json(500, {}) });
    wrap(
      <Routes>
        <Route path="/admin" element={<RequireAuth roles={['admin']}><p>admin</p></RequireAuth>} />
        <Route path="/member" element={<p>member home</p>} />
      </Routes>,
      '/admin',
    );
    expect(await screen.findByText('member home')).toBeInTheDocument();
  });
});

describe('login form', () => {
  it('validates fields before calling the API', async () => {
    const fetchMock = mockApi({ '/auth/me': () => json(401, {}), '/auth/refresh': () => json(401, {}), '/cms/site': () => json(500, {}) });
    wrap(<LoginPage />, '/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/auth/login'))).toBe(false);
  });

  it('shows the server error message on failed login', async () => {
    mockApi({
      '/auth/me': () => json(401, {}),
      '/auth/refresh': () => json(401, {}),
      '/cms/site': () => json(500, {}),
      '/auth/login': () => json(401, { error: { code: 'UNAUTHORIZED', message: 'Incorrect email or password' } }),
    });
    wrap(<LoginPage />, '/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Incorrect email or password'));
  });
});

describe('safe redirects', () => {
  it.each([
    ['/member/checkout/abc', '/member/checkout/abc'],
    ['//evil.example', null],
    ['https://evil.example', null],
    ['/\\evil.example', null],
    [null, null],
  ])('safeNext(%s) → %s', (input, out) => {
    expect(safeNext(input)).toBe(out);
  });
});
