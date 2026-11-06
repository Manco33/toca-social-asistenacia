"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building } from 'lucide-react';

interface ProjectStatusProps {
  projects: Array<{
    id: string;
    name: string;
    address: string;
    technicians: Array<{
      id: string;
      name: string;
      avatarUrl: string;
      status: string;
      since: Date;
    }>;
  }>;
}

export function ProjectStatus({ projects }: ProjectStatusProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [usage, setUsage] = useState<Record<string, any> | null>(null);

  // fetch usage data from API
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/projects/usage');
        const j = await res.json();
        if (mounted && j.ok) {
          const map: Record<string, any> = {};
          (j.projects || []).forEach((p: any) => { map[p.name] = p; });
          setUsage(map);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // listen for global updates so panel refreshes when projects change elsewhere
  React.useEffect(() => {
    const onUpdate = () => {
      (async () => {
        try {
          const res = await fetch('/api/projects/usage');
          const j = await res.json();
          if (j.ok) {
            const map: Record<string, any> = {};
            (j.projects || []).forEach((p: any) => { map[p.name] = p; });
            setUsage(map);
          }
        } catch (e) {
          // ignore
        }
      })();
    };
    window.addEventListener('projects:updated', onUpdate as EventListener);
    return () => { window.removeEventListener('projects:updated', onUpdate as EventListener); };
  }, []);

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.technicians.some(tech => tech.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Estado de Proyectos</span>
          <Input
            placeholder="Buscar por proyecto o técnico..."
            className="max-w-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Personal Asignado</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.map(project => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {project.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{project.address}</TableCell>
                <TableCell>
                  <div className="flex -space-x-2">
                    {project.technicians.map(tech => (
                      <Avatar key={tech.id} className="border-2 border-background">
                        <AvatarImage src={tech.avatarUrl} alt={tech.name} />
                        <AvatarFallback>{getInitials(tech.name)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={project.technicians.length > 0 ? 'default' : 'secondary'}>
                        {project.technicians.length > 0 ? 'Activo' : 'Sin personal'}
                      </Badge>
                      {usage && usage[project.name] && (
                        <div className="text-sm">
                          <span className="font-medium">Usado:</span> {usage[project.name].used_hours}h
                          {usage[project.name].horas_totales != null && (
                            <span className={`ml-3 ${usage[project.name].overrun ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {usage[project.name].remaining_hours}h restantes
                            </span>
                          )}
                          {usage[project.name].overrun && <span className="ml-2 text-destructive">(Excedido)</span>}
                        </div>
                      )}
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}