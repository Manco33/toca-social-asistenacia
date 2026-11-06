import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Endpoint para sincronizar datos offline con el servidor
 * Recibe los cambios pendientes y los sincroniza con Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const bodyStr = await request.text();
    console.log('[API/sync] Sync request body:', bodyStr);

    let body;
    try {
      body = bodyStr ? JSON.parse(bodyStr) : {};
    } catch (parseError) {
      console.error('[API/sync] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { action, data, userId, originalTimestamp } = body;

    if (!action || !data || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, data, userId' },
        { status: 400 }
      );
    }

    console.log(`[API/sync] Processing ${action} for user ${userId}`);

    let result;

    // Procesar según el tipo de acción
    switch (action) {
      case 'create':
        // Crear nueva entrada de tiempo
        result = await syncCreateTimeEntry(data, userId);
        break;

      case 'update':
        // Actualizar entrada existente
        result = await syncUpdateTimeEntry(data, userId);
        break;

      case 'delete':
        // Eliminar entrada
        result = await syncDeleteTimeEntry(data, userId);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API/sync] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Sincronizar creación de entrada de tiempo
 */
async function syncCreateTimeEntry(data: any, userId: string) {
  let user;
  let usuarioText = '';

  if (userId.includes('-')) {
    // Es UUID
    const { data } = await supabase
      .from('empleados')
      .select('usuario, id')
      .eq('supabase_id', userId)
      .single();
    user = data;

    if (!user) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('email')
        .eq('supabase_id', userId)
        .single();

      if (userRecord?.email) {
        usuarioText = userRecord.email.split('@')[0];
        user = { usuario: usuarioText, id: userId };
      }
    }
  } else {
    // Legacy numeric ID
    const { data, error: userError } = await supabase
      .from('empleados')
      .select('usuario')
      .eq('id', Number(userId))
      .single();
    user = data;
  }

  if (!user) {
    throw new Error(`Usuario no encontrado: ${userId}`);
  }

  // Convertir timestamp de vuelta a fecha y hora
  const dateTime = new Date(data.timestamp);
  const fecha = dateTime.toISOString().split('T')[0];
  const hora_marcaje = dateTime.toISOString().split('T')[1].split('.')[0];

  // Coordenadas
  let coordenadas = 'N/A';
  if (data.location) {
    coordenadas = `${data.location.latitude},${data.location.longitude}`;
  }

  const dbEntry = {
    usuario: user.usuario,
    fecha: fecha,
    hora_marcaje: hora_marcaje,
    tipo_actividad: data.type || data.tipo_actividad,
    coordenadas: coordenadas,
    proyecto: data.projectId || data.projectName || ''
  };

  console.log('[Sync] Creating time entry:', dbEntry);

  const { data: inserted, error } = await supabase
    .from('horarios_gps')
    .insert([dbEntry])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    success: true,
    action: 'create',
    serverId: inserted.id,
    originalId: data.id,
    message: 'Time entry created successfully'
  };
}

/**
 * Sincronizar actualización de entrada de tiempo
 */
async function syncUpdateTimeEntry(data: any, userId: string) {
  // Por ahora, las entradas de tiempo normalmente no se actualizan
  // Pero preparamos el endpoint para futuros usos
  console.log('[Sync] Update requested for:', data);

  return {
    success: true,
    action: 'update',
    message: 'Time entry update logic not yet implemented'
  };
}

/**
 * Sincronizar eliminación de entrada de tiempo
 */
async function syncDeleteTimeEntry(data: any, userId: string) {
  // Por ahora, las entradas de tiempo normalmente no se eliminan
  // Pero preparamos el endpoint para futuros usos
  console.log('[Sync] Delete requested for:', data);

  return {
    success: true,
    action: 'delete',
    message: 'Time entry delete logic not yet implemented'
  };
}
