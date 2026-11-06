"use client";

import React, { useEffect, useState } from 'react';
import type { Project } from '@/lib/types';
import { getProjects } from '@/app/actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2 } from "lucide-react";
import { Skeleton } from './ui/skeleton';

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchProjects() {
      try {
        setLoading(true);
        const fetched = await getProjects();
        if (mounted) setProjects(fetched);
      } catch (e: any) {
        console.error("Failed to fetch projects:", e);
        if (mounted) setError("No se pudieron cargar los proyectos. Verifique la configuración de la hoja de cálculo.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchProjects();
    return () => { mounted = false; };
  }, []);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">Lista de Proyectos</CardTitle>
        <CardDescription>
          Proyectos activos asignados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-12 text-destructive">
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <Skeleton className="h-6 w-1/3 mx-auto mb-3" />
            <Skeleton className="h-6 w-1/2 mx-auto mb-3" />
            <Skeleton className="h-6 w-2/3 mx-auto" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Contacto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length > 0 ? (
                projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{project.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{project.address}</TableCell>
                    <TableCell>{project.contactPerson}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No hay proyectos para mostrar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
