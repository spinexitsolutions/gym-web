import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api.js';
import { ME_KEY } from '../../context/AuthContext.jsx';
import { AuthHeading } from '../../layouts/AuthLayout.jsx';
import { FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { PasswordField } from '../../forms/PasswordField.jsx';
import { resetSchema } from '../../forms/schemas.js';
import { Button } from '../../components/ui/Button.jsx';
import { Seo } from '../../components/layout/Seo.jsx';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setFormError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetSchema) });

  const onSubmit = async ({ password }) => {
    setFormError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      qc.setQueryData(ME_KEY, null);
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setFormError(applyServerErrors(err, setError) || err.message);
    }
  };

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <>
        <AuthHeading title="Invalid link" lead="This password reset link is incomplete or has expired." />
        <Button to="/forgot-password" className="w-full">Request a new link</Button>
      </>
    );
  }
  return (
    <>
      <Seo title="Choose a new password" noindex />
      <AuthHeading title="Choose a new password" lead="For your security, you'll be signed out of all devices." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <FormAlert>{error}</FormAlert>
        <PasswordField label="New password" name="password" register={register} errors={errors} autoComplete="new-password" hint="8+ characters with upper- and lowercase letters and a number." />
        <PasswordField label="Confirm new password" name="confirmPassword" register={register} errors={errors} autoComplete="new-password" />
        <Button type="submit" loading={isSubmitting} className="w-full">Update password</Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted"><Link to="/login" className="text-gold hover:underline">Back to log in</Link></p>
    </>
  );
}
