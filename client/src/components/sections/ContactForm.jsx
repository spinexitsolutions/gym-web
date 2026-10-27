import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send } from 'lucide-react';
import { contentApi } from '../../services/content.js';
import { TextField, FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { Button } from '../ui/Button.jsx';

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().regex(/^(\+?[0-9 ()-]{7,20})?$/, 'Enter a valid phone number').optional(),
  interest: z.string().optional(),
  message: z.string().trim().min(10, 'Message should be at least 10 characters').max(3000),
  website: z.string().optional(), // honeypot
});

const INTERESTS = [
  { value: 'membership', label: 'Membership' },
  { value: 'trial', label: 'Free trial visit' },
  { value: 'personal_training', label: 'Personal training' },
  { value: 'corporate', label: 'Corporate wellness' },
  { value: 'other', label: 'Something else' },
];

export function ContactForm({ source = 'contact_page', defaultInterest = 'membership', defaultMessage = '' }) {
  const startedAt = useRef(Date.now());
  const [done, setDone] = useState('');
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { interest: defaultInterest, message: defaultMessage },
  });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const res = await contentApi.contact({ ...values, source, startedAt: startedAt.current });
      setDone(res.message);
      reset({ interest: defaultInterest, message: '' });
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {done && <FormAlert tone="success">{done}</FormAlert>}
      <FormAlert>{formError}</FormAlert>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Name" name="name" register={register} errors={errors} required autoComplete="name" />
        <TextField label="Email" name="email" type="email" register={register} errors={errors} required autoComplete="email" />
        <TextField label="Phone" name="phone" type="tel" register={register} errors={errors} autoComplete="tel" />
        <TextField label="I'm interested in" name="interest" as="select" options={INTERESTS} register={register} errors={errors} />
      </div>
      <TextField label="Message" name="message" as="textarea" register={register} errors={errors} required />
      {/* Honeypot: hidden from people and assistive tech, bots tend to fill it. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website <input tabIndex={-1} autoComplete="off" {...register('website')} /></label>
      </div>
      <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
        <Send className="h-4 w-4" aria-hidden /> Send message
      </Button>
    </form>
  );
}
