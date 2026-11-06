'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Check, Clock } from 'lucide-react';
import { getPendingUsers, assignUserRole, sendPasswordResetEmail } from '@/app/user-actions';
import { useAuth } from '@/hooks/use-auth';

interface PendingUser {
  id: string;
  supabase_id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  status: string;
  created_at: string;
}

interface AssignmentDialogProps {
  user: PendingUser | null;
  isOpen: boolean;
  isLoading: boolean;
  selectedRole: string;
  onRoleChange: (role: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function AssignmentDialog({
  user,
  isOpen,
  isLoading,
  selectedRole,
  onRoleChange,
  onConfirm,
  onCancel,
}: AssignmentDialogProps) {
  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar Rol a Usuario</DialogTitle>
          <DialogDescription>
            Asigna un rol a {user.full_name || user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Correo: {user.email}</p>
            {user.full_name && <p className="text-sm text-gray-600">Nombre: {user.full_name}</p>}
            {user.phone && <p className="text-sm text-gray-600">Teléfono: {user.phone}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Selecciona un Rol</label>
            <Select value={selectedRole} onValueChange={onRoleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technician">
                  <span>👷 Técnico</span>
                </SelectItem>
                <SelectItem value="administrator">
                  <span>👨‍💼 Administrador</span>
                </SelectItem>
                <SelectItem value="rrhh">
                  <span>👥 RRHH</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
            El usuario recibirá un correo para establecer su contraseña después de la asignación.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isLoading || !selectedRole}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Asignar Rol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Panel de Gestión de Usuarios Pendientes para RRHH
 */
export function RRHHUserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Cargar usuarios pendientes
  useEffect(() => {
    loadPendingUsers();
  }, []);

  const loadPendingUsers = async () => {
    try {
      setIsLoading(true);
      const pendingUsers = await getPendingUsers();
      setUsers(pendingUsers);
    } catch (error) {
      console.error('Error loading pending users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los usuarios pendientes',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignRole = (user: PendingUser) => {
    setSelectedUser(user);
    setSelectedRole('');
    setDialogOpen(true);
  };

  const handleConfirmAssignment = async () => {
    if (!selectedUser || !selectedRole || !currentUser) return;

    setIsSaving(true);
    try {
      const result = await assignUserRole(
        selectedUser.supabase_id,
        selectedRole as 'technician' | 'administrator' | 'rrhh',
        currentUser.id
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Enviar email de confirmación
      await sendPasswordResetEmail(selectedUser.email);

      toast({
        title: 'Rol Asignado',
        description: `${selectedUser.full_name || selectedUser.email} ahora tiene rol de ${selectedRole}`,
      });

      setDialogOpen(false);
      setSelectedUser(null);
      setSelectedRole('');

      // Recargar usuarios
      await loadPendingUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendEmail = async (user: PendingUser) => {
    try {
      const result = await sendPasswordResetEmail(user.email);
      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'Correo Enviado',
        description: `Email de confirmación enviado a ${user.email}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Usuarios Pendientes de Asignación</CardTitle>
          <CardDescription>
            Gestiona los usuarios nuevos y asigna sus roles en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay usuarios pendientes de asignación</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Correo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Registrado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.supabase_id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.full_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />
                          Pendiente
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendEmail(user)}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Enviar Email
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAssignRole(user)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Asignar Rol
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AssignmentDialog
        user={selectedUser}
        isOpen={dialogOpen}
        isLoading={isSaving}
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        onConfirm={handleConfirmAssignment}
        onCancel={() => {
          setDialogOpen(false);
          setSelectedUser(null);
          setSelectedRole('');
        }}
      />
    </div>
  );
}
