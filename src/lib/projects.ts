import type { Project } from './types';

// This file is now deprecated in favor of Google Sheets integration.
// It is kept for reference and potential future use.

export const mockProjects: Project[] = [
  {
    id: 'proj-001',
    name: 'Torre Empresarial Atlántico',
    address: 'Av. Principal 123, Ciudad Capital',
    contactPerson: 'Ing. Roberto Diaz',
    assignedTo: ['admin', 'user1'],
  },
  {
    id: 'proj-002',
    name: 'Residencial Los Robles',
    address: 'Calle Los Pinos 456, Suburbia',
    contactPerson: 'Arq. Sofia Castillo',
    assignedTo: ['admin'],
  },
  {
    id: 'proj-003',
    name: 'Centro Comercial El Sol',
    address: 'Blvd. del Sol 789, Zona Comercial',
    contactPerson: 'Lic. Elena Paredes',
    assignedTo: ['user2'],
  },
  {
    id: 'proj-004',
    name: 'Hospital Metropolitano',
    address: 'Av. de la Salud 101, Sector Médico',
    contactPerson: 'Dra. Isabela Guzman',
    assignedTo: ['admin', 'user3'],
  },
  {
    id: 'proj-005',
    name: 'Edificio de Oficinas Quantum',
    address: 'Parque Tecnológico 202',
    contactPerson: 'Sr. Jorge Valerio',
    assignedTo: ['user1'],
  },
];

const filterProjectsForAdmin = (projects: Project[], userRole: string): Project[] => {
  return projects.filter((project: Project) => project.assignedTo?.includes(userRole) ?? false);
};
