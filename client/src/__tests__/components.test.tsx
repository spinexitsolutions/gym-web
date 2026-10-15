import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, ErrorState, Modal } from '@/components/ui';
import { ApiError } from '@/lib/api';

const cols = [{ key: 'name', header: 'Name', cell: (r: { name: string }) => r.name }];

describe('DataTable states', () => {
  it('shows skeleton rows while loading', () => {
    const { container } = render(<DataTable columns={cols} rows={undefined} rowKey={(r) => r.name} isLoading />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
  });
  it('shows an empty state', () => {
    render(<DataTable columns={cols} rows={[]} rowKey={(r) => r.name} empty={{ title: 'No members yet' }} />);
    expect(screen.getByText('No members yet')).toBeInTheDocument();
  });
  it('shows an error with retry', async () => {
    const retry = vi.fn();
    render(<DataTable columns={cols} rows={undefined} rowKey={(r) => r.name} error={new ApiError(500, 'X', 'Server unavailable')} onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Server unavailable');
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
  });
  it('renders rows', () => {
    render(<DataTable columns={cols} rows={[{ name: 'Asha' }]} rowKey={(r) => r.name} />);
    expect(screen.getByRole('cell', { name: 'Asha' })).toBeInTheDocument();
  });
});

describe('Modal accessibility', () => {
  it('is labelled, focusable and closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Record payment">
        <input aria-label="Amount" />
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ErrorState', () => {
  it('renders the API error message', () => {
    render(<ErrorState error={new ApiError(0, 'NETWORK_ERROR', 'Network error — check your connection and try again.')} />);
    expect(screen.getByText(/check your connection/)).toBeInTheDocument();
  });
});
