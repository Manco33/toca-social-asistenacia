'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Clock, Mail, LogOut, AlertCircle } from 'lucide-react';
import { sendPasswordResetEmail } from '@/app/user-actions';
import { useRouter } from 'next/navigation';

/**
 * Página de espera para usuarios con rol pending_role
 * Se muestra mientras se espera que RRHH asigne un rol
 */
export default function PendingRolePage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isResending, setIsResending] = useState(false);

  const handleResendEmail = async () => {
    if (!user?.email) return;

    setIsResending(true);
    try {
      const result = await sendPasswordResetEmail(user.email);
      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'Correo Reenviado',
        description: 'Se ha enviado un nuevo correo de confirmación',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-500/20 border border-blue-500/50 mb-4">
            <Clock className="h-8 w-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white font-headline">Cuenta en Espera</h1>
          <p className="text-slate-400 mt-2">Tu acceso está pendiente de revisión</p>
        </div>

        {/* Main Card */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle>¡Bienvenido a Aktiva Marcaje!</CardTitle>
            <CardDescription>Tu correo ha sido registrado exitosamente</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* User Info */}
            <div className="space-y-3 p-4 rounded-lg bg-slate-900/50 border border-slate-700">
              <div>
                <p className="text-sm text-slate-400">Correo Registrado</p>
                <p className="text-white font-medium">{user?.email}</p>
              </div>
              {user?.name && (
                <div>
                  <p className="text-sm text-slate-400">Nombre</p>
                  <p className="text-white font-medium">{user.name}</p>
                </div>
              )}
            </div>

            {/* Information */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-white">¿Qué sucede ahora?</p>
                  <p className="text-slate-400 mt-1">
                    Un administrador del departamento de RRHH revisará tu solicitud. Esto puede tomar entre 1 a 3 días hábiles.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Mail className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-white">Mantente atento a tu correo</p>
                  <p className="text-slate-400 mt-1">
                    Recibirás un mensaje cuando se haya asignado tu rol. Verifica también la bandeja de spam.
                  </p>
                </div>
              </div>
            </div>

            {/* Expected Timeline */}
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm font-medium text-amber-200 mb-2">Cronograma Estimado:</p>
              <ul className="text-sm text-amber-100/90 space-y-1">
                <li>• Revisión: 1-2 días hábiles</li>
                <li>• Asignación de rol: 1 día hábil</li>
                <li>• Acceso completo: 3 días hábiles como máximo</li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
              <p className="text-sm font-medium text-slate-300 mb-2">¿Preguntas?</p>
              <p className="text-sm text-slate-400">
                Contacta al departamento de RRHH si tienes dudas sobre el proceso.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleResendEmail}
            disabled={isResending}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isResending ? 'Reenviando...' : 'Reenviar Correo de Confirmación'}
          </Button>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>

        {/* Help Link */}
        <p className="text-center text-sm text-slate-500">
          ¿Necesitas ayuda?{' '}
          <a href="mailto:rrhh@aktivacorp.com" className="text-blue-400 hover:text-blue-300 underline">
            Contacta a RRHH
          </a>
        </p>
      </div>
    </div>
  );
}
