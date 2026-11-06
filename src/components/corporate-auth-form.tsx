'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { validateActivaEmail, createSupabaseUser } from '@/app/user-actions';

type AuthMode = 'login' | 'signup' | 'pending' | 'success';

interface AuthFormProps {
  onAuthSuccess?: () => void;
}

/**
 * Formulario de autenticación corporativo
 * Maneja login, signup y validación de email @aktivacorp.com
 */
export function CorporateAuthForm({ onAuthSuccess }: AuthFormProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      // Validar email
      if (!email) {
        throw new Error('Por favor ingresa tu correo');
      }

      if (!validateActivaEmail(email)) {
        throw new Error('Solo se permiten correos con dominio @aktivacorp.com');
      }

      // Validar contraseña
      if (!password || password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }

      if (password !== confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      // Crear usuario
      const result = await createSupabaseUser(email, password, fullName);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Mostrar estado de espera
      setMode('pending');
      toast({
        title: 'Cuenta Creada',
        description: 'Tu cuenta ha sido creada. Espera a que un administrador de RRHH la active.',
      });

      // Limpiar formulario
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(message);
      toast({
        variant: 'destructive',
        title: 'Error en Registro',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      // TODO: Implementar login con Supabase
      throw new Error('El login será manejado por el componente LoginForm existente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Estado: Usuario pendiente de asignación
  if (mode === 'pending') {
    return (
      <Card className="w-full max-w-sm mt-8 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Cuenta Creada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
            <p className="text-sm font-medium text-blue-900">
              ¡Tu cuenta ha sido creada exitosamente!
            </p>
            <p className="text-sm text-blue-700">
              Un administrador de RRHH revisará tu solicitud y te asignará un rol en los próximos días.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium text-gray-700">Próximos pasos:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>Revisa tu correo para instrucciones de acceso</li>
              <li>RRHH asignará tu rol (Técnico, Admin o RRHH)</li>
              <li>Recibirás un correo de confirmación</li>
            </ul>
          </div>

          <Button
            onClick={() => {
              setMode('login');
              setEmail('');
            }}
            className="w-full"
          >
            Volver al Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Estado: Formulario de Registro
  if (mode === 'signup') {
    return (
      <Card className="w-full max-w-sm mt-8 shadow-xl">
        <CardHeader>
          <CardTitle>Crear Cuenta Corporativa</CardTitle>
          <CardDescription>Solo están permitidos correos @aktivacorp.com</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre Completo</label>
              <Input
                placeholder="Juan Pérez"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Correo Corporativo</label>
              <Input
                type="email"
                placeholder="juan.perez@aktivacorp.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">Debe terminar con @aktivacorp.com</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contraseña</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">Mínimo 6 caracteres</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmar Contraseña</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Cuenta
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setMode('login')}
              disabled={isLoading}
            >
              Volver al Login
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Estado: Formulario de Login
  return (
    <Card className="w-full max-w-sm mt-8 shadow-xl">
      <CardHeader>
        <CardTitle>Iniciar Sesión</CardTitle>
        <CardDescription>Solo correos @aktivacorp.com</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Correo</label>
            <Input
              type="email"
              placeholder="tu.correo@aktivacorp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Contraseña</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar Sesión
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setMode('signup')}
            disabled={isLoading}
          >
            No tengo cuenta - Registrarse
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
