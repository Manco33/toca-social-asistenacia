'use server';

import { supabase, supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

/**
 * Validar que el email sea de la empresa @aktivacorp.com
 */
export async function validateActivaEmail(email: string): Promise<boolean> {
  return email.toLowerCase().endsWith('@aktivacorp.com');
}

/**
 * Buscar usuario existente en la tabla users
 */
export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (es normal)
    console.error('[getUserByEmail] Error:', error);
  }

  return data || null;
}

/**
 * Obtener usuario por supabase_id
 */
export async function getUserById(supabaseId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('supabase_id', supabaseId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[getUserById] Error:', error);
  }

  return data || null;
}

/**
 * Crear nuevo usuario en Supabase Auth + tabla users + tabla empleados
 * Retornará error si ya existe o si el email no es válido
 */
export async function createSupabaseUser(
  email: string,
  password: string,
  fullName?: string,
  phone?: string
) {
  try {
    // Validar email
    if (!validateActivaEmail(email)) {
      return {
        success: false,
        error: 'Solo se permiten correos con dominio @aktivacorp.com',
      };
    }

    // Verificar si ya existe
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return {
        success: false,
        error: 'Este correo ya está registrado en el sistema',
      };
    }

    const adminSupabase = supabaseAdmin;

    // Crear usuario en auth.users
    const { data: { user }, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true, // Auto-confirmar para permitir inicio de sesión
      user_metadata: {
        full_name: fullName || '',
        phone: phone || '',
      },
    });

    if (authError || !user) {
      console.error('[createSupabaseUser] Auth error:', authError);
      return {
        success: false,
        error: authError?.message || 'Error al crear usuario en Supabase',
      };
    }

    // Crear registro en tabla users con estado pending_role
    const { data: newUser, error: dbError } = await supabase
      .from('users')
      .insert([
        {
          supabase_id: user.id,
          email: email.toLowerCase(),
          full_name: fullName || null,
          phone: phone || null,
          role: 'pending_role',
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error('[createSupabaseUser] DB error:', dbError);
      console.error('[createSupabaseUser] Error details:', {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
      });
      // Si falla la BD, eliminar usuario de auth para mantener consistencia
      await adminSupabase.auth.admin.deleteUser(user.id);
      return {
        success: false,
        error: `Error al crear registro de usuario: ${dbError.message}`,
      };
    }

    // Vincular/Crear empleado en tabla empleados
    // IMPORTANTE: Usar adminSupabase porque aún no hay sesión de usuario autenticado
    const username = email.split('@')[0].toLowerCase();

    try {
      // Primero intentar ACTUALIZAR si existe
      const { data: existingEmpleado } = await adminSupabase
        .from('empleados')
        .select('id')
        .eq('usuario', username)
        .single();

      if (existingEmpleado) {
        // Actualizar empleado existente
        const { error: updateError } = await adminSupabase
          .from('empleados')
          .update({
            supabase_id: user.id,
            contrasena: password,
            nombre: fullName || username
          })
          .eq('id', existingEmpleado.id);

        if (updateError) {
          console.error('[createSupabaseUser] Error actualizando empleado:', updateError);
        } else {
          console.log(`[createSupabaseUser] Empleado '${username}' actualizado`);
        }
      } else {
        // Si no existe, CREAR nuevo empleado con todos los campos obligatorios
        const { error: insertError } = await adminSupabase
          .from('empleados')
          .insert([
            {
              usuario: username,
              nombre: fullName || username,
              contrasena: password,  // Obligatorio
              rol: 'tecnico',        // Obligatorio - sin acento
              supabase_id: user.id,  // Enlace automático con Supabase Auth
              // Horarios por defecto
              horario_entrada: '06:30',
              horario_salida: '16:30',
              horario_almuerzo: '12:00',
            },
          ]);

        if (insertError) {
          console.error('[createSupabaseUser] Error creando empleado:', insertError);
          console.error('[createSupabaseUser] Insert error details:', {
            message: insertError.message,
            code: insertError.code,
            details: insertError.details,
          });
        } else {
          console.log(`[createSupabaseUser] Empleado '${username}' creado con supabase_id`);
        }
      }
    } catch (empleadoError) {
      console.warn('[createSupabaseUser] Advertencia al procesar empleado:', empleadoError);
      console.error('[createSupabaseUser] Error stack:', empleadoError);
      // No fallar - el usuario en auth y users fue creado exitosamente
    }

    // Enviar email de reinicio de contraseña
    await sendPasswordResetEmail(email);

    return {
      success: true,
      user: newUser,
      message: 'Usuario creado exitosamente. Se ha enviado un correo para confirmar la contraseña.',
    };
  } catch (error) {
    console.error('[createSupabaseUser] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Enviar email de reinicio de contraseña
 */
export async function sendPasswordResetEmail(email: string) {
  try {
    const adminSupabase = supabaseAdmin;

    const { error } = await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase(),
    });

    if (error) {
      console.error('[sendPasswordResetEmail] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Email de reinicio enviado',
    };
  } catch (error) {
    console.error('[sendPasswordResetEmail] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Asignar rol a usuario (solo RRHH)
 */
export async function assignUserRole(
  userId: string,
  newRole: 'technician' | 'administrator' | 'rrhh',
  assignedByRRHH: string
) {
  try {
    // Verificar que quien asigna es RRHH
    const assignerUser = await getUserById(assignedByRRHH);
    if (!assignerUser || assignerUser.role !== 'rrhh') {
      return {
        success: false,
        error: 'Solo usuarios de RRHH pueden asignar roles',
      };
    }

    // Actualizar rol del usuario
    const { data, error } = await supabase
      .from('users')
      .update({
        role: newRole,
        status: 'active',
        assigned_by_rrhh: assignedByRRHH,
        assigned_at: new Date().toISOString(),
      })
      .eq('supabase_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[assignUserRole] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      user: data,
      message: `Rol actualizado a ${newRole}`,
    };
  } catch (error) {
    console.error('[assignUserRole] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Obtener usuarios pendientes de asignación (para RRHH)
 */
export async function getPendingUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'pending_role')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getPendingUsers] Error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[getPendingUsers] Unexpected error:', error);
    return [];
  }
}

/**
 * Obtener todos los usuarios (para Administrador)
 */
export async function getAllUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getAllUsers] Error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[getAllUsers] Unexpected error:', error);
    return [];
  }
}
