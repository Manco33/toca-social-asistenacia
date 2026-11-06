# Implementación: Filtrado de Datos por Rol de Usuario

## ✅ CAMBIOS REALIZADOS

### 1. **admin-dashboard.tsx** - Agregar contexto de autenticación

**Cambio 1**: Importar `useAuth` hook
```tsx
import { useAuth } from '@/hooks/use-auth';
```

**Cambio 2**: Obtener usuario y pasar ID a funciones
```tsx
export default function AdminDashboard(): JSX.Element {
  const { user } = useAuth();  // ← Nuevo
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'accounting'>('overview');
  
  const fetchInitial = useCallback(async () => {
    const [emps, todays, projs] = await Promise.all([
      getEmployees(user?.id),        // ← Pasar user.id
      getTodaysEntries(user?.id),    // ← Pasar user.id
      getProjects()
    ]);
```

---

### 2. **actions.ts** - Actualizar funciones para validar rol

#### **getEmployees(supabaseId?: string)**

**Lógica**:
- Si no se pasa `supabaseId` → retorna array vacío (seguridad)
- Obtiene el rol del usuario desde la BD
- Si role = 'admin' o 'recursos' → retorna TODOS los empleados
- Si role = otro → retorna array vacío (denied)

```typescript
export async function getEmployees(supabaseId?: string): Promise<...> {
  if (!supabaseId) {
    console.warn('[getEmployees] No supabaseId - retornando vacío');
    return [];
  }
  
  const { data: currentUser } = await supabase
    .from('empleados')
    .select('id, usuario, rol')
    .eq('supabase_id', supabaseId)
    .single();
  
  const isAdmin = rol === 'admin' || rol === 'administrador';
  const isRRHH = rol === 'recursos';
  
  if (isAdmin || isRRHH) {
    // Retorna todos
    return rows || [];
  }
  return [];  // Acceso denegado
}
```

#### **getTodaysEntries(supabaseId?: string)**

**Lógica**:
- Si no se pasa `supabaseId` → retorna array vacío
- Si role = admin/RRHH → retorna TODOS los registros de hoy
- Si role = técnico → retorna solo sus registros
- Includes `.eq('usuario', currentUser.usuario)`

```typescript
export async function getTodaysEntries(supabaseId?: string): Promise<any[]> {
  if (!supabaseId) return [];
  
  const { data: currentUser } = await supabase
    .from('empleados')
    .select('id, usuario, rol')
    .eq('supabase_id', supabaseId)
    .single();
  
  let query = supabase.from('horarios_gps').select(...).eq('fecha', today);
  
  if (!isAdmin && !isRRHH) {
    query = query.eq('usuario', currentUser.usuario);  // Filtrar por técnico
  }
  
  return rows || [];
}
```

#### **getRegistroHoras(usernameOrId?, supabaseId?, startDate?, endDate?)**

**Cambios**:
- Nuevo parámetro `supabaseId` (5ta posición)
- Valida que el usuario solicitante tenga permiso:
  - Admin/RRHH puede ver cualquier usuario
  - Técnico solo puede ver sus propios datos
- Si intenta accesar datos de otro sin permiso → lanza error

```typescript
export async function getRegistroHoras(
  usernameOrId?: string,
  supabaseId?: string,  // ← Nuevo parámetro
  startDate?: string,
  endDate?: string
) {
  // 🚨 VALIDACIÓN DE PERMISOS
  if (usernameOrId && !isAdmin && !isRRHH && usernameOrId !== currentUser.usuario) {
    throw new Error('No tienes permiso para ver los datos de otro empleado');
  }
}
```

---

## 🔐 Cómo funciona ahora

| Rol | getEmployees() | getTodaysEntries() | getRegistroHoras() |
|-----|----------------|--------------------|-------------------|
| **admin** | ✅ Ve TODOS | ✅ Ve TODOS | ✅ Ve TODOS |
| **recursos (RRHH)** | ✅ Ve TODOS | ✅ Ve TODOS | ✅ Ve TODOS |
| **technician** | ❌ Array vacío | ✅ Solo sus datos | ✅ Solo sus datos |
| **otros** | ❌ Array vacío | ❌ Array vacío | ❌ Error |

---

## 📊 Tabla de Seguridad

| Escenario | Antes | Después |
|-----------|-------|---------|
| Técnico accede admin-dashboard | ✅ Ve todos (inseguro) | ❌ No ve nada |
| Admin ve registros de técnico X | ✅ Sí | ✅ Sí |
| Técnico A ve datos de Técnico B | ✅ Sí (CRÍTICO) | ❌ Error |
| Sin user.id | N/A | ❌ Retorna vacío |

---

## 🧪 Cómo Probar

### Test 1: Admin ve todos
```bash
1. Login como admin@aktivacorp.com
2. Ir a /dashboard (admin-dashboard)
3. Deber ver lista completa de empleados y registros
```

### Test 2: Técnico accede admin-dashboard  
```bash
1. Login como técnico@aktivacorp.com
2. Ir a /dashboard
3. Debe ser redirigido (ver guardia en admin-dashboard.tsx línea ~1315)
```

### Test 3: Técnico ve sus propios registros
```bash
1. Login como técnico
2. Ir a /dashboard/pending-role o su panel
3. Ver solo registros de HOY del técnico actual
```

### Test 4: Validación en getRegistroHoras
```bash
(Backend only)
1. Admin solicita registros de Técnico A ✅ OK
2. Técnico A solicita registros de Técnico B ❌ Error
3. Técnico A solicita sus propios registros ✅ OK
```

---

## 📝 Calles donde se pasará user.id

Buscar estas funciones y actualizar llamadas:

```bash
# En admin-dashboard.tsx (YA HECHO)
✅ getEmployees(user?.id)
✅ getTodaysEntries(user?.id)

# Buscar otras llamadas
grep -r "getRegistroHoras(" src/components/ src/app/api/
# Actualizar: getRegistroHoras(userName, user?.id, start, end)
```

---

## 🚀 Próximos pasos

1. **Prueba en Supabase**: Crear 2 usuarios test (admin y técnico)
2. **Test completo**: Verificar tabla con 3 credenciales diferentes
3. **Logging**: Revisar logs en consola (browser DevTools)
4. **RLS (futuro)**: Implementar políticas RLS en BD para validación de servidor

---

## 🔗 Archivos modificados

- ✅ [src/components/admin-dashboard.tsx](src/components/admin-dashboard.tsx#L14-L26)
- ✅ [src/components/admin-dashboard.tsx](src/components/admin-dashboard.tsx#L30-L49)
- ✅ [src/app/actions.ts](src/app/actions.ts#L203)
- ✅ [src/app/actions.ts](src/app/actions.ts#L272)
- ✅ [src/app/actions.ts](src/app/actions.ts#L686)

