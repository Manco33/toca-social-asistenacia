import React from 'react';
import { RRHHUserManagement } from '@/components/rrhh-user-management';

/**
 * Página de gestión de usuarios para RRHH
 */
export default function RRHHUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
        <p className="text-muted-foreground mt-2">
          Asigna roles y gestiona usuarios pendientes en el sistema
        </p>
      </div>

      <RRHHUserManagement />
    </div>
  );
}
