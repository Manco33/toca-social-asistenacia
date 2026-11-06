import type { User } from './types';

// This file is now deprecated in favor of Google Sheets integration.
// It is kept for reference and potential future use.

export const mockUsers: User[] = [
  {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    avatarUrl: 'https://picsum.photos/seed/101/100/100',
  },
  {
    id: 'tech-1',
    name: 'Juan Perez',
    email: 'juan.perez@example.com',
    role: 'technician',
    avatarUrl: 'https://picsum.photos/seed/102/100/100',
  },
  {
    id: 'tech-2',
    name: 'Maria Garcia',
    email: 'maria.garcia@example.com',
    role: 'technician',
    avatarUrl: 'https://picsum.photos/seed/103/100/100',
  },
  {
    id: 'tech-3',
    name: 'Carlos Sanchez',
    email: 'carlos.sanchez@example.com',
    role: 'technician',
    avatarUrl: 'https://picsum.photos/seed/104/100/100',
  },
  {
    id: 'tech-4',
    name: 'Ana Martinez',
    email: 'ana.martinez@example.com',
    role: 'technician',
    avatarUrl: 'https://picsum.photos/seed/105/100/100',
  },
];
