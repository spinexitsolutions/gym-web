import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthHeading } from '../../layouts/AuthLayout.jsx';
import { TextField, FormAlert, applyServerErrors } from '../../forms/Field.jsx';
import { PasswordField } from '../../forms/PasswordField.jsx';
import { loginSchema } from '../../forms/schemas.js';
import { Button } from '../../components/ui/Button.jsx';
import { Seo } from '../../components/layout/Seo.jsx';
import { safeNext, homeFor } from '../../utils/redirect.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setFormError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const { user } = await login(values);
      navigate(safeNext(params.get('next')) || homeFor(user), { replace: true });
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  };

  return (
    <>
      <Seo title="Log in" noindex />
      <AuthHeading title="Welcome back" lead="Log in to manage your membership, bookings and progress." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {params.get('reset') && !error && <FormAlert tone="success">Password updated. Log in with your new password.</FormAlert>}
        <FormAlert>{error}</FormAlert>
        <TextField label="Email" name="email" type="email" autoComplete="email" register={register} errors={errors} required />
        <PasswordField name="password" register={register} errors={errors} />
        <div className="flex justify-end"><Link to="/forgot-password" className="text-sm text-gold hover:underline">Forgot password?</Link></div>
        <Button type="submit" loading={isSubmitting} className="w-full">Log in</Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">New here? <Link to="/register" className="text-gold hover:underline">Create an account</Link></p>
    </>
  );
}
