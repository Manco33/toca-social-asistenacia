'use client';

import React from 'react';
import { Download, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/hooks/use-install-prompt';

interface InstallPromptProps {
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * Componente para mostrar el botón de instalación de PWA
 * Se muestra 13.3solo si la app no está instalada y puede serlo
 */
export function InstallPrompt({ variant = 'default', className = '' }: InstallPromptProps) {
  const { canInstall, isInstalled, isInstalling, handleInstall } = useInstallPrompt();

  // No mostrar si ya está instalada o no se puede instalar
  if (!canInstall) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <Button
        onClick={handleInstall}
        disabled={isInstalling}
        size="sm"
        variant="outline"
        className={`gap-2 ${className}`}
      >
        {isInstalling ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Instalando...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Instalar app
          </>
        )}
      </Button>
    );
  }

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 ${className}`}>
      <div className="flex-1">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100">Instalar BOCO Marcaje</h3>
        <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
          Descarga la app para un acceso más rápido desde tu celular
        </p>
      </div>
      <Button
        onClick={handleInstall}
        disabled={isInstalling}
        className="gap-2 whitespace-nowrap"
      >
        {isInstalling ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Instalando...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Descargar
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Componente para mostrar estado de instalación
 */
export function InstallStatus() {
  const { isInstalled } = useInstallPrompt();

  if (!isInstalled) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-4 w-4" />
      App instalada
    </div>
  );
}
