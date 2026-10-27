import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../services/api.js';
import { AuthHeading } from '../../layouts/AuthLayout.jsx';
import { TextField, FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { emailRule } from '../../forms/schemas.js';
import { Button } from '../../components/ui/Button.jsx';
import { Seo } from '../../components/layout/Seo.jsx';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState('');
  const [error, setFormError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email: emailRule })) });
  const onSubmit = async (values) => {
    setFormError('');
    try {
      setSent((await api.post('/auth/forgot-password', values)).message);
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  };
  return (
    <>
      <Seo title="Forgot password" noindex />
      <AuthHeading title="Reset your password" lead="Enter your email and we'll send you a secure link that expires in 30 minutes." />
      {sent ? (
        <FormAlert tone="success">{sent}</FormAlert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <FormAlert>{error}</FormAlert>
          <TextField label="Email" name="email" type="email" autoComplete="email" register={register} errors={errors} required />
          <Button type="submit" loading={isSubmitting} className="w-full">Send reset link</Button>
        </form>
      )}
      <p className="mt-8 text-center text-sm text-muted"><Link to="/login" className="text-gold hover:underline">Back to log in</Link></p>
    </>
  );
}
