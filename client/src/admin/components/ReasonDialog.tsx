import { useEffect, useState, type ReactNode } from 'react';
import { Button, Modal, Textarea } from '@/components/ui';

/** Confirm dialog that requires a written reason (audited actions). */
export function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  loading,
  minLength = 3,
  required = true,
  placeholder = 'Reason (recorded in the audit log)',
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  minLength?: number;
  required?: boolean;
  placeholder?: string;
  error?: string;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);
  const invalid = required && reason.trim().length < minLength;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            onClick={() => {
              setTouched(true);
              if (!invalid) onConfirm(reason.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!invalid) onConfirm(reason.trim());
        }}
        className="space-y-4"
      >
        {children}
        <Textarea
          label={required ? 'Reason' : 'Reason (optional)'}
          required={required}
          rows={3}
          value={reason}
          maxLength={300}
          placeholder={placeholder}
          onChange={(e) => setReason(e.target.value)}
          error={error ?? (touched && invalid ? `Please give a reason (at least ${minLength} characters)` : undefined)}
        />
      </form>
    </Modal>
  );
}
