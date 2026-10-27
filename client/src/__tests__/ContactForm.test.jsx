import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactForm } from '../components/sections/ContactForm.jsx';

vi.mock('../services/content.js', () => ({
  contentApi: { contact: vi.fn(() => Promise.resolve({ message: 'Thanks! We will be in touch shortly.' })) },
}));

describe('ContactForm', () => {
  it('shows validation errors and submits valid data', async () => {
    const { contentApi } = await import('../services/content.js');
    render(<ContactForm />);
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    expect(await screen.findByText('Please enter your name')).toBeInTheDocument();
    expect(contentApi.contact).not.toHaveBeenCalled();

    fireEvent.input(screen.getByLabelText(/name/i, { selector: 'input' }), { target: { value: 'Neha Kapoor' } });
    fireEvent.input(screen.getByLabelText(/email/i), { target: { value: 'neha@example.com' } });
    fireEvent.input(screen.getByLabelText(/message/i), { target: { value: 'I would like a trial session please.' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(contentApi.contact).toHaveBeenCalled());
    expect(contentApi.contact.mock.calls[0][0]).toMatchObject({ name: 'Neha Kapoor', source: 'contact_page', startedAt: expect.any(Number) });
    expect(await screen.findByText(/we will be in touch/i)).toBeInTheDocument();
  });
});
