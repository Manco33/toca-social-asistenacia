/**
 * IndexedDB para almacenamiento offline
 * Cada técnico almacena sus registros de tiempo, proyectos y datos sincronizados
 */

const DB_NAME = 'aktiva-marcaje-offline';
const DB_VERSION = 1;

// Object stores
const STORES = {
  TIME_ENTRIES: 'timeEntries',
  SYNC_QUEUE: 'syncQueue',
  CACHE: 'cache',
  USER_DATA: 'userData',
};

let db: IDBDatabase | null = null;

/**
 * Inicializa la base de datos IndexedDB
 */
export async function initOfflineDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('IndexedDB initialized successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Registros de tiempo (time entries)
      if (!database.objectStoreNames.contains(STORES.TIME_ENTRIES)) {
        const store = database.createObjectStore(STORES.TIME_ENTRIES, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Cola de sincronización (cambios pendientes)
      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncStore.createIndex('userId', 'userId', { unique: false });
        syncStore.createIndex('action', 'action', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Caché de datos (proyectos, usuarios, etc.)
      if (!database.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = database.createObjectStore(STORES.CACHE, {
          keyPath: 'key',
        });
        cacheStore.createIndex('type', 'type', { unique: false });
      }

      // Datos del usuario actual
      if (!database.objectStoreNames.contains(STORES.USER_DATA)) {
        database.createObjectStore(STORES.USER_DATA, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Guarda un registro de tiempo localmente
 */
export async function saveTimeEntryLocally(entry: any): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([STORES.TIME_ENTRIES], 'readwrite');
  const store = transaction.objectStore(STORES.TIME_ENTRIES);

  const dataToSave = {
    ...entry,
    syncStatus: 'pending', // pending, synced, failed
    createdAt: new Date().toISOString(),
    isOfflineEntry: true,
  };

  return new Promise((resolve, reject) => {
    const request = store.add(dataToSave);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Agregar a cola de sincronización
      addToSyncQueue({
        action: 'create',
        data: dataToSave,
        timestamp: new Date().toISOString(),
        userId: entry.userId,
      });
      resolve();
    };
  });
}

/**
 * Obtiene registros de tiempo locales del usuario
 */
export async function getTimeEntriesLocally(userId: string): Promise<any[]> {
  const database = await initOfflineDB();
  const transaction = database.transaction([STORES.TIME_ENTRIES], 'readonly');
  const store = transaction.objectStore(STORES.TIME_ENTRIES);
  const index = store.index('userId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(userId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Agrega cambios a la cola de sincronización
 */
export async function addToSyncQueue(syncItem: any): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([STORES.SYNC_QUEUE], 'readwrite');
  const store = transaction.objectStore(STORES.SYNC_QUEUE);

  return new Promise((resolve, reject) => {
    const request = store.add({
      ...syncItem,
      timestamp: new Date().toISOString(),
      retries: 0,
    });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Obtiene la cola de sincronización pendiente
 */
export async function getSyncQueue(userId: string): Promise<any[]> {
  const database = await initOfflineDB();
  const transaction = database.transaction([STORES.SYNC_QUEUE], 'readonly');
  const store = transaction.objectStore(STORES.SYNC_QUEUE);
  const index = store.index('userId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(userId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Elimina un item de la cola de sincronización después de sincronizarse
 */
export async function removeSyncQueueItem(id: number): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([STORES.SYNC_QUEUE], 'readwrite');
  const store = transaction.objectStore(STORES.SYNC_QUEUE);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Guarda datos en caché local (proyectos, usuarios, etc.)
 */
export async function cacheData(
  type: string,
  key: string,
  data: any,
  ttl: number = 3600000 // 1 hora por defecto
): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([STORES.CACHE], 'readwrite');
  const store = transaction.objectStore(STORES.CACHE);

  const cacheItem = {
    key,
    type,
    data,
    expiresAt: Date.now() + ttl,
  };

  return new Promise((resolve, reject) => {
    const request = store.put(cacheItem);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Obtiene datos del caché
 */
export async function getCachedData(key: string): Promise<any | null> {
  const database = await initOfflineDB();
  const transaction = database.transaction([STORES.CACHE], 'readonly');
  const store = transaction.objectStore(STORES.CACHE);

  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const item = request.result;
      if (!item) {
        resolve(null);
        return;
      }

      // Verificar si expiró
      if (item.expiresAt < Date.now()) {
        // Eliminar del caché
        store.delete(key);
        resolve(null);
        return;
      }

      resolve(item.data);
    };
  });
}

/**
 * Guarda datos del usuario actual
 */
export async function saveUserData(user: any): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([STORES.USER_DATA], 'readwrite');
  const store = transaction.objectStore(STORES.USER_DATA);

  return new Promise((resolve, reject) => {
    const request = store.put({
      ...user,
      savedAt: new Date().toISOString(),
    });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Obtiene datos del usuario actual
 */
export async function getUserData(userId: string): Promise<any | null> {
  const database = await initOfflineDB();
  const transaction = database.transaction([STORES.USER_DATA], 'readonly');
  const store = transaction.objectStore(STORES.USER_DATA);

  return new Promise((resolve, reject) => {
    const request = store.get(userId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Marca un item sincronizado
 */
export async function markAsSynced(entryId: string | number): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([STORES.TIME_ENTRIES], 'readwrite');
  const store = transaction.objectStore(STORES.TIME_ENTRIES);

  return new Promise((resolve, reject) => {
    const request = store.get(entryId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const entry = request.result;
      if (entry) {
        entry.syncStatus = 'synced';
        entry.syncedAt = new Date().toISOString();
        const updateRequest = store.put(entry);
        updateRequest.onerror = () => reject(updateRequest.error);
        updateRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });
}

/**
 * Limpia la base de datos (uso en setups/testing)
 */
export async function clearOfflineDB(): Promise<void> {
  const database = await initOfflineDB();

  for (const storeName of Object.values(STORES)) {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}
