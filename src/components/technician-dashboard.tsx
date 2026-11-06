
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { User, TimeEntry, Geolocation as Geo, TimeEntryType, Project } from '@/lib/types';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { STANDARD_WORK_HOURS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Clock, Building, Truck, Utensils, CheckCircle2, List, Activity, ChevronsUpDown, Check } from 'lucide-react';
import { format, differenceInMinutes, parseISO, isValid } from 'date-fns';
import { format as formatTz } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectList } from '@/components/project-list';
import TechnicianPerformance from '@/components/technician-performance';
import { InvoiceManager } from '@/components/invoice-manager';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from '@/hooks/use-auth';
import { saveTimeEntry, saveFinalHours, getProjects, getTechnicianTodaysEntries } from '@/app/actions';
import { saveTimeEntryLocally, cacheData, getCachedData, getTimeEntriesLocally } from '@/lib/offline-db';
import { SyncStatusBanner } from '@/components/sync-status';
import { InstallPrompt } from '@/components/install-prompt';

interface TechnicianDashboardProps {
  user: User;
}

const TechnicianMapView = dynamic(() => import('./technician-map-view'), {
  loading: () => <p>Cargando mapa...</p>,
  ssr: false
});

// GPS options: timeout after 12s, accept cached location up to 60s old
const GPS_OPTIONS: PositionOptions = {
  timeout: 12000,
  maximumAge: 60000,
  enableHighAccuracy: true,
};

export function TechnicianDashboard({ user }: TechnicianDashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const { toast } = useToast();
  const { logout } = useAuth();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<TimeEntryType | null>(null);
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [modalNote, setModalNote] = useState('');
  const [standardHours, setStandardHours] = useState(9); // Default value
  const [lunchHours, setLunchHours] = useState(1); // Default value
  // when set, entries for this project should be marked as overtime until cleared
  const [overtimeProject, setOvertimeProject] = useState<Project | null>(null);
  // purpose controls how the project modal will behave when selecting a project
  const [projectModalPurpose, setProjectModalPurpose] = useState<'select' | 'overtime-activate'>('select');
  const [completionMessage, setCompletionMessage] = useState('');
  const [showFlowPanel, setShowFlowPanel] = useState(false);
  const [animateCounter, setAnimateCounter] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [finalModalText, setFinalModalText] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  // Missing states restored for Map Flow
  const [mapProject, setMapProject] = useState<Project | null>(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isInsideProject, setIsInsideProject] = useState(false); // Track if user is in range
  const [projectSearchTerm, setProjectSearchTerm] = useState(''); // State for project search
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingInitialEntries, setLoadingInitialEntries] = useState(true); // Nuevo estado
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('technician-dashboard-tab') || 'activity';
    }
    return 'activity';
  });

  // Estado para solicitud de horas extra
  const [overtimeRequests, setOvertimeRequests] = useState<any[]>([]);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [overtimeReason, setOvertimeReason] = useState('');
  const [overtimeStartTime, setOvertimeStartTime] = useState('');
  const [overtimeEndTime, setOvertimeEndTime] = useState('');
  const [overtimeProjectState, setOvertimeProjectState] = useState('');
  const [overtimeTasks, setOvertimeTasks] = useState('');
  const [openOvertimeCombobox, setOpenOvertimeCombobox] = useState(false);
  const [overtimeSearch, setOvertimeSearch] = useState('');

  // Real-time clock: update every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to reset flow state
  const resetFlow = useCallback(() => {
    setPendingAction(null);
    setIsFlowModalOpen(false);
    setIsProjectModalOpen(false);
    setModalNote('');
    setCompletionMessage('');
  }, []);

  // Cargar solicitudes de horas extra del técnico
  useEffect(() => {
    async function fetchOvertimeRequests() {
      try {
        const res = await fetch(`/api/horas-extras?usuario=${encodeURIComponent(user.email)}`);
        const j = await res.json();
        if (j.ok && j.solicitudes) setOvertimeRequests(j.solicitudes);
      } catch (e) { }
    }
    fetchOvertimeRequests();
  }, [user.email]);

  // Filter projects based on search term
  const filteredProjects = useMemo(() => {
    if (!projectSearchTerm) {
      return projects;
    }
    const searchTermLower = projectSearchTerm.toLowerCase();
    return projects.filter(p =>
      (p.name?.toLowerCase() || '').includes(searchTermLower) ||
      (p.address?.toLowerCase() || '').includes(searchTermLower)
    );
  }, [projects, projectSearchTerm]);



  // ... (lines 98-101 were the interval)
  // useEffect(() => {
  //   const timer = setInterval(() => setCurrentTime(new Date()), 1000);
  //   return () => clearInterval(timer);
  // }, []);

  // Memoize the user object for the child component to prevent re-renders
  const performanceUser = useMemo(() => ({
    email: user.email,
    name: user.name || user.email,
    id: user.id
  }), [user.email, user.name, user.id]);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoadingProjects(true);
        console.log('[TechnicianDashboard] Fetching projects...');
        const fetchedProjects = await getProjects();
        console.log('[TechnicianDashboard] Projects fetched:', fetchedProjects);
        
        if (!fetchedProjects || fetchedProjects.length === 0) {
          console.warn('[TechnicianDashboard] No projects returned from API');
          toast({ variant: 'destructive', title: 'Aviso', description: 'No hay proyectos disponibles. Por favor, contacta a tu administrador.' });
        }
        
        setProjects(fetchedProjects);
        await cacheData('projects', 'all', fetchedProjects);
      } catch (error) {
        console.error("[TechnicianDashboard] Failed to fetch projects:", error);

        // Offline fallback
        const cached = await getCachedData('projects');
        if (cached) {
          console.log('[TechnicianDashboard] Using cached projects:', cached);
          setProjects(cached);
          toast({ title: 'Modo Offline', description: 'Mostrando proyectos guardados localmente.' });
        } else {
          console.error('[TechnicianDashboard] No cached projects available');
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los proyectos.' });
        }
      } finally {
        setLoadingProjects(false);
      }
    }
    fetchProjects();
  }, [toast]);

  // Nuevo useEffect para cargar los registros del técnico para el día actual
  // function to load today's entries (exposed so we can refresh after saves)
  const refreshEntries = React.useCallback(async () => {
    // setLoadingInitialEntries(true); // Removed: Only show redundant loading on FIRST mount (handled by initial state)
    try {
      const entries = await getTechnicianTodaysEntries(user.id);
      const sanitized = entries.map(e => {
        let ts = e.timestamp ? new Date(e.timestamp as any) : new Date();
        if (!isValid(ts)) ts = new Date();
        return { ...e, timestamp: ts } as TimeEntry;
      });
      const sortedEntries = sanitized.sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0));
      setTimeEntries(sortedEntries);
      await cacheData('time_entries', user.id, sortedEntries);
    } catch (error) {
      console.error("Failed to load technician's entries:", error);

      // Fallback offline
      try {
        const cached = await getCachedData('time_entries') || [];
        const local = await getTimeEntriesLocally(user.id) || [];
        const todayString = formatTz(new Date(), 'yyyy-MM-dd', { timeZone: 'America/Guatemala' });

        const combined = [...cached];

        local.forEach(l => {
          const ts = l.timestamp ? new Date(l.timestamp) : new Date();
          const lDay = formatTz(ts, 'yyyy-MM-dd', { timeZone: 'America/Guatemala' });
          // Only add if it belongs to today and is not in cached array yet
          if (lDay === todayString && !combined.find(c => c.id === l.id)) {
            combined.push({ ...l, timestamp: ts });
          }
        });

        if (combined.length > 0) {
          const sortedEntries = combined.sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0));
          setTimeEntries(sortedEntries);
          toast({ title: 'Modo Offline', description: 'Mostrando tus registros guardados localmente.' });
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar tus registros del día.' });
        }
      } catch (offlineErr) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar tus registros del día.' });
      }
    } finally {
      setLoadingInitialEntries(false);
    }
  }, [user.id, toast]);

  useEffect(() => { refreshEntries(); }, [refreshEntries]);
  const lastEntry = timeEntries.length > 0 ? timeEntries[timeEntries.length - 1] : null;
  const isWorkdayComplete = useMemo(() => timeEntries.length > 0 && lastEntry?.type === 'Hora de salida', [timeEntries, lastEntry]);

  useEffect(() => {
    // Only show the completion message if the last 'Hora de salida' actually happened today
    if (!isWorkdayComplete || !lastEntry) return;

    try {
      const guatemalaToday = formatTz(new Date(), 'yyyy-MM-dd', { timeZone: 'America/Guatemala' });
      const lastEntryDay = lastEntry.timestamp ? formatTz(new Date(lastEntry.timestamp), 'yyyy-MM-dd', { timeZone: 'America/Guatemala' }) : null;

      if (lastEntryDay !== guatemalaToday) {
        // The last exit was on a different day — reset local flow so user starts fresh
        resetFlow();
        return;
      }

      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sunday, 5=Friday
      let message = "¡Excelente trabajo! Nos vemos mañana.";
      if (dayOfWeek === 5) { // Friday
        message = "¡Excelente trabajo! Que tengas un buen fin de semana.";
      }
      setCompletionMessage(message);
    } catch (e) {
      // If anything goes wrong, avoid showing a stale completion message
      console.error('[Debug] error computing completion message', e);
      setCompletionMessage('');
    }
  }, [isWorkdayComplete, lastEntry]);

  const isInProject = useMemo(() => {
    if (!lastEntry) return false;
    const projectArrivals = timeEntries.filter(e => e.type === 'Llegada a proyecto' || e.type === 'Inicio en proyecto').length;
    const projectDepartures = timeEntries.filter(e => e.type === 'Salida de proyecto' || e.type === 'Hacia otro proyecto').length;
    return projectArrivals > projectDepartures;
  }, [timeEntries, lastEntry]);

  const hasHadLunch = useMemo(() => {
    return timeEntries.some(e => e.type === 'Iniciar Almuerzo');
  }, [timeEntries]);

  const isOnLunch = useMemo(() => lastEntry?.type === 'Iniciar Almuerzo', [lastEntry]);

  const nextAction = useMemo((): TimeEntryType | null => {
    if (!lastEntry) {
      return null; // Handled directly in UI
    }

    const lastAction = lastEntry.type;

    switch (lastAction) {
      case 'Llegada a oficina':
        return 'Salida de oficina';
      case 'Salida de oficina':
        return 'Llegada a proyecto';
      case 'Inicio en proyecto': // New
      case 'Llegada a proyecto':
        return null;
      case 'Iniciar Almuerzo':
        return 'Terminar Almuerzo';
      case 'Terminar Almuerzo':
        return null;
      case 'Salida de proyecto':
      case 'Hacia otro proyecto':
        return 'Llegada a proyecto';
      case 'Regreso a oficina':
        return 'Hora de salida';
      case 'Hora de salida':
        return null;
      default:
        return null;
    }
  }, [lastEntry]);



  // Confirm handler for the central flow modal. For project-related actions, it will open the project selector.
  const confirmFlow = async () => {
    const action = pendingAction;
    if (!action) return;

    // If this is a project-type action, close flow and open project selector (project modal will continue flow)
    if (action === 'Inicio en proyecto' || action === 'Llegada a proyecto' || action === 'Hacia otro proyecto') {
      setIsFlowModalOpen(false);
      setIsProjectModalOpen(true);
      setProjectModalPurpose('select');
      return;
    }

    // Not a project action, just locate and save
    setIsFlowModalOpen(false);
    setIsLocating(true);

    console.log('[Debug] Requesting geolocation...');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          console.log('[Debug] Got geolocation:', position.coords);
          const { latitude, longitude } = position.coords;
          const location = { latitude, longitude };

          const lastEntry = timeEntries[timeEntries.length - 1];
          const isOnLunch = lastEntry?.type === 'Iniciar Almuerzo';

          // Handle special case: if departing from project while on lunch, close lunch first
          if (action === 'Salida de proyecto' && isOnLunch) {
            // ← fix: pass active project name so time-calculations sees it as "resume project"
            const activeProjectName =
              timeEntries.slice().reverse().find(e => e.projectName)?.projectName || null;
            const lunchEndEntry: TimeEntry = {
              id: `${user.id}-${Date.now()}-lunch-end`,
              userId: user.id,
              type: 'Terminar Almuerzo',
              timestamp: new Date(),
              location: location
            };
            // Persist and refresh entries
            try {
              await saveTimeEntry(user.id, lunchEndEntry.type, location, activeProjectName);
              await refreshEntries();
              // Recurse to process the original action now that lunch is ended
              // We delay slightly to ensure state updates if any
              setTimeout(() => confirmFlow(), 100);
              return;
            } catch (e) {
              console.error('Error saving lunch end entry (fallback offline):', e);
              await saveTimeEntryLocally(lunchEndEntry);
              setTimeEntries(prev => [...prev, lunchEndEntry]);
              toast({ title: 'Aviso', description: 'Fin de almuerzo guardado (modo sin conexión).' });
              setTimeout(() => confirmFlow(), 100);
              return;
            }
          }

          // determine projectName for 'Hora de salida' from last project arrival
          const inferredProjectName = (action === 'Hora de salida')
            ? timeEntries.slice().reverse().find(e => e.projectName)?.projectName || ''
            : null;

          console.log('[Debug] Creating new entry...');
          const newEntry: TimeEntry = {
            id: `${user.id}-${Date.now()}`,
            userId: user.id,
            type: action,
            timestamp: new Date(),
            location: location,
            projectName: inferredProjectName || undefined,
          };

          try {
            console.log('[Debug] Saving time entry...', {
              userId: user.id,
              action,
              location,
              projectName: inferredProjectName
            });

            const result = await saveTimeEntry(
              user.id,
              action,
              location,
              inferredProjectName || null
            );

            console.log('[Debug] Save result:', result);
            // Refresh entries from server so the persisted log appears in the table
            try {
              await refreshEntries();
            } catch (e) {
              // if refresh fails, fall back to optimistic append
              setTimeEntries(prev => [...prev, newEntry]);
            }
            toast({ title: "¡Éxito!", description: `"${action}" marcado a las ${formatTz(newEntry.timestamp, 'p', { locale: es, timeZone: 'America/Guatemala' })}.` });
          } catch (error: any) {
            console.error("[Debug] Error saving time entry (fallback offline):", error);
            try {
              await saveTimeEntryLocally(newEntry);
              setTimeEntries(prev => [...prev, newEntry]); // Vista optimista
              setCompletionMessage('Guardado sin conexión. Se sincronizará automáticamente.');
              toast({
                title: "Guardado Offline",
                description: `"${action}" guardado localmente a las ${formatTz(newEntry.timestamp, 'p', { locale: es, timeZone: 'America/Guatemala' })}. (${error?.message || 'Error de red'})`
              });
            } catch (offlineErr) {
              toast({
                variant: 'destructive',
                title: 'Error al Guardar',
                description: error?.message || 'No se pudo guardar ni local ni online.'
              });
            }
          } finally {
            setIsLocating(false);
            setModalNote('');
            setPendingAction(null);
          }
        } catch (outerError) {
          console.error('[Debug] Outer error:', outerError);
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Error de geolocalización:", error);
        toast({ variant: 'destructive', title: 'Error de Geolocalización', description: 'No se pudo obtener tu ubicación. Por favor, activa los servicios de ubicación.' });
        setIsLocating(false);
        setPendingAction(null);
      },
      GPS_OPTIONS
    );
  };

  const handleProjectSelection = (project: Project) => {
    console.log("[Debug] HandleProjectSelection: Selected", project.name, "Pending:", pendingAction);
    setIsProjectModalOpen(false);

    if (!pendingAction && projectModalPurpose !== 'overtime-activate') {
      console.warn("[Debug] No pending action.");
      return;
    }

    const action = pendingAction;
    setIsLocating(true);

    console.log("[Debug] Requesting Geolocation...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        console.log("[Debug] Geolocation OK", position.coords);
        const { latitude, longitude } = position.coords;
        const location = { latitude, longitude };

        try {
          if (projectModalPurpose === 'overtime-activate') {
            setOvertimeProject(project);
            toast({ title: 'Modo horas extra activado', description: `Horas extra contarán para el proyecto "${project.name}" hasta que salgas de él.` });
            setProjectModalPurpose('select');
            setModalNote('');
            setPendingAction(null);
            setIsLocating(false);
            return;
          }

          if (action === 'Inicio en proyecto' || action === 'Llegada a proyecto' || action === 'Hacia otro proyecto') {
            console.log("[Debug] Opening Map Modal for confirmation...");
            setMapProject({
              ...project,
              latitud: project.latitud,
              longitud: project.longitud,
              radio: project.radio
            });
            setCurrentCoords({ latitude, longitude });
            setIsMapModalOpen(true);
            setIsLocating(false);
            return;
          }

          // Fallback logic if needed (should not be reached for project actions if map is active)

        } catch (error) {
          console.error("[Debug] Error in project selection:", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al seleccionar el proyecto.' });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("[Debug] Geolocation Error:", error);
        toast({ variant: 'destructive', title: 'Error de Ubicación', description: 'No se pudo obtener la ubicación.' });
        setPendingAction(null);
        setIsLocating(false);
      },
      GPS_OPTIONS
    );
  };

  // Direct action performer used by the flow panel to reduce steps for the tech
  const performActionFromPanel = (action: TimeEntryType) => {
    if (!action) return;

    // Project arrival/start actions need project selection
    if (action === 'Inicio en proyecto' || action === 'Llegada a proyecto') {
      setPendingAction(action);
      setProjectModalPurpose('select');
      setIsProjectModalOpen(true);
      return;
    }

    // 'Salida de proyecto' should record the departure.
    if (action === 'Salida de proyecto') {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const location = { latitude, longitude };
          console.log('[TechnicianDashboard] Ubicación obtenida:', latitude, longitude);

          try {
            const currentProjectName = timeEntries.slice().reverse().find(e => e.type === 'Llegada a proyecto' || e.type === 'Inicio en proyecto')?.projectName || '';
            const departureEntry: TimeEntry = {
              id: `${user.id}-${Date.now()}-departure`,
              userId: user.id,
              type: 'Salida de proyecto',
              timestamp: new Date(),
              location: location,
              projectName: currentProjectName || undefined,
            };
            try {
              console.log('[TechnicianDashboard] Guardando Salida de proyecto');
              await saveTimeEntry(user.id, 'Salida de proyecto', location, currentProjectName || null);
              console.log('[TechnicianDashboard] ✅ Salida de proyecto guardada');
              await refreshEntries();
              toast({ title: '¡Éxito!', description: `Salida de proyecto marcada.` });
            } catch (e: any) {
              console.error('[TechnicianDashboard] ❌ Error saving departure, offline fallback', e);
              await saveTimeEntryLocally(departureEntry);
              setTimeEntries(prev => [...prev, departureEntry]);
              toast({ title: 'Guardado Offline', description: `Salida de proyecto guardada sin conexión. (${e?.message || 'Error'})` });
            }
            if (overtimeProject && currentProjectName === overtimeProject.name) {
              setOvertimeProject(null);
              toast({ title: 'Modo horas extra desactivado', description: `Horas extra desactivadas al salir de "${currentProjectName}".` });
            }
          } finally {
            setIsLocating(false);
          }
        },
        (error) => {
          console.error('[TechnicianDashboard] ❌ Geolocation error', error);
          toast({ variant: 'destructive', title: 'Error de Geolocalización', description: 'No se pudo obtener tu ubicación.' });
          setIsLocating(false);
        },
        GPS_OPTIONS
      );
      return;
    }

    // For other actions, do geo and save directly (fewer clicks)
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const location = { latitude, longitude };

        // For Hora de salida we compute/save final hours then animate and reset local counter
        try {
          if (action === 'Hora de salida') {
            const inferredProjectName = timeEntries.slice().reverse().find(e => e.projectName)?.projectName || '';
            const exitTimestamp = new Date();
            const exitEntry: TimeEntry = {
              id: `${user.id}-${Date.now()}-exit`,
              userId: user.id,
              type: 'Hora de salida',
              timestamp: exitTimestamp,
              location: location,
              projectName: inferredProjectName || undefined,
            };
            try {
              await calculateAndSaveWorkHours(inferredProjectName, exitTimestamp);
            } catch (e) {
              console.error('Error calculating/saving final hours in panel flow:', e);
            }
            try {
              await saveTimeEntry(user.id, 'Hora de salida', location, inferredProjectName || null);
              await refreshEntries();
              toast({ title: '¡Éxito!', description: 'Hora de salida marcada.' });
            } catch (saveErr: any) {
              console.error('Error saving Hora de salida entry in panel flow (fallback offline):', saveErr);
              await saveTimeEntryLocally(exitEntry);
              toast({ title: 'Guardado Offline', description: `Hora de salida guardada sin conexión. (${saveErr?.message || 'Error'})` });
            }
            // Animation: pulse the counter, then reset the local counter after animation
            setAnimateCounter(true);
            setTimeout(() => {
              setAnimateCounter(false);
              setTimeEntries([]); // reset worked-hours counter (UI) while logs remain saved server-side
              setOvertimeProject(null);
              setCompletionMessage('Jornada finalizada. Buen trabajo.');
            }, 1400);
          } else {
            const projectName = timeEntries.slice().reverse().find(e => e.projectName)?.projectName || null;
            const otherEntry: TimeEntry = {
              id: `${user.id}-${Date.now()}-${action}`,
              userId: user.id,
              type: action,
              timestamp: new Date(),
              location: location,
              projectName: projectName || undefined,
            };
            try {
              await saveTimeEntry(user.id, action, location, projectName);
              await refreshEntries();
              toast({ title: '¡Éxito!', description: `${action} marcado.` });
            } catch (e: any) {
              console.error(`Error saving ${action} entry, falling back offline:`, e);
              await saveTimeEntryLocally(otherEntry);
              setTimeEntries(prev => [...prev, otherEntry]);
              toast({ title: 'Guardado Offline', description: `${action} guardado sin conexión. (${e?.message || 'Error'})` });
            }
          }
        } catch (outerError) {
          console.error('[TechnicianDashboard] Error in action flow:', outerError);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error('Geolocation error', error);
        toast({ variant: 'destructive', title: 'Error de Geolocalización', description: 'No se pudo obtener tu ubicación.' });
        setIsLocating(false);
      },
      GPS_OPTIONS
    );
  };

  const { regularHours, overtimeHours, totalHours } = useMemo(() => {
    const startTimeEntry = timeEntries.find(e => e.type === 'Llegada a oficina' || e.type === 'Inicio en proyecto');
    const endTimeEntry = timeEntries.find(e => e.type === 'Hora de salida');
    const lunchStart = timeEntries.find(e => e.type === 'Iniciar Almuerzo');
    const lunchEnd = timeEntries.find(e => e.type === 'Terminar Almuerzo');

    if (!startTimeEntry) {
      return { regularHours: 0, overtimeHours: 0, totalHours: 0 };
    }

    const effectiveEndTime = endTimeEntry ? endTimeEntry.timestamp : new Date();

    let totalMinutes = differenceInMinutes(effectiveEndTime, startTimeEntry.timestamp);
    if (lunchStart) {
      const effectiveLunchEnd = lunchEnd ? lunchEnd.timestamp : new Date();
      if (lastEntry?.type === 'Iniciar Almuerzo') {
        // Lunch is ongoing, don't subtract yet
      } else if (lunchEnd) {
        totalMinutes -= differenceInMinutes(effectiveLunchEnd, lunchStart.timestamp);
      }
    }

    const totalHrs = totalMinutes / 60;

    if (!endTimeEntry) {
      return { regularHours: Math.max(0, totalHrs), overtimeHours: 0, totalHours: Math.max(0, totalHrs) };
    }

    // Use employee-specific standard hours + lunch hours for overtime calculation
    const totalStandardHours = standardHours + lunchHours;
    const overtime = Math.max(0, totalHrs - totalStandardHours);
    const regular = totalHrs - overtime;

    return { regularHours: regular, overtimeHours: overtime, totalHours: totalHrs };
  }, [timeEntries, lastEntry]);

  const calculateAndSaveWorkHours = async (projectName: string, endTimestamp?: Date) => {
    try {
      const startTimeEntry = timeEntries.find(e => e.type === 'Llegada a oficina' || e.type === 'Inicio en proyecto');
      if (!startTimeEntry) return;

      const effectiveEnd = endTimestamp || new Date();
      let totalMinutes = differenceInMinutes(effectiveEnd, startTimeEntry.timestamp);

      const lunchStart = timeEntries.find(e => e.type === 'Iniciar Almuerzo');
      const lunchEnd = timeEntries.find(e => e.type === 'Terminar Almuerzo');

      if (lunchStart) {
        const effectiveLunchEnd = lunchEnd ? lunchEnd.timestamp : effectiveEnd;
        totalMinutes -= differenceInMinutes(effectiveLunchEnd, lunchStart.timestamp);
      }

      const totalHrs = totalMinutes / 60;
      const totalStandardHours = standardHours + lunchHours;
      const overtime = Math.max(0, totalHrs - totalStandardHours);

      const formatH = (h: number) => {
        const hh = Math.floor(h);
        const mm = Math.round((h - hh) * 60);
        return `${hh}h ${mm}m`;
      };

      const totalHoursStr = formatH(totalHrs);
      const overtimeStr = formatH(overtime);

      console.log('[calculateAndSaveWorkHours] Calculado - totalHrs:', totalHrs, 'formatHoras:', totalHoursStr, 'overtime:', overtimeStr);
      console.log('[calculateAndSaveWorkHours] user object:', { id: user.id, name: user.name, email: user.email, role: user.role });

      await saveFinalHours(
        user.id,
        totalHoursStr,
        overtimeStr
      );

      console.log('[calculateAndSaveWorkHours] Éxito - resumen guardado');
      toast({ title: 'Resumen del día guardado', description: `${totalHoursStr} trabajadas, ${overtimeStr} extras.` });
    } catch (e) {
      console.error("[calculateAndSaveWorkHours] Error saving final hours:", e);
      toast({ variant: 'destructive', title: 'Error al Guardar Resumen', description: (e as Error).message || 'No se pudo guardar el resumen de horas.' });
    }
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatSafe = (d: Date | undefined | null, fmt: string) => {
    if (!d) return 'N/A';
    if (!isValid(d)) return 'N/A';
    try { return formatTz(d, fmt, { locale: es, timeZone: 'America/Guatemala' }); } catch { return 'N/A'; }
  };

  // Helpers to show quick project summary and details
  const getCurrentProjectName = () => {
    const active = lastEntry?.projectName || timeEntries.slice().reverse().find(e => e.projectName)?.projectName;
    if (active) return active;
    // fallback: pick first project in the list
    return projects && projects.length > 0 ? projects[0].name : null;
  };

  const getIconForEntry = (type: TimeEntry['type']) => {
    switch (type) {
      case 'Llegada a oficina':
      case 'Regreso a oficina':
        return <Building className="h-5 w-5" />;
      case 'Salida de oficina':
        return <Building className="h-5 w-5" />;
      case 'Llegada a proyecto':
      case 'Salida de proyecto':
      case 'Hacia otro proyecto':
        return <Truck className="h-5 w-5" />;
      case 'Iniciar Almuerzo':
      case 'Terminar Almuerzo':
        return <Utensils className="h-5 w-5" />;
      case 'Hora de salida':
        return <Clock className="h-5 w-5" />;
      default:
        return <MapPin className="h-5 w-5" />;
    }
  };

  // Helper to parse the nota field written by the overtime API
  const parseOvertimeNota = (nota?: string | null) => {
    if (!nota) return { status: null as string | null, requestId: null as string | null, reason: null as string | null, estimatedHours: null as string | null };
    const statusMatch = nota.match(/Estado:\s*([^|]+)/i);
    const idMatch = nota.match(/overtime_request_id:(\d+)/i);
    const reasonMatch = nota.match(/Motivo:\s*([^|]+)/i);
    const hoursMatch = nota.match(/Horas estimadas:\s*([^|]+)/i);
    return {
      status: statusMatch ? statusMatch[1].trim() : null,
      requestId: idMatch ? idMatch[1] : null,
      reason: reasonMatch ? reasonMatch[1].trim() : null,
      estimatedHours: hoursMatch ? hoursMatch[1].trim() : null,
    };
  };

  // If there are pending overtime entries, poll periodically to pick up admin decisions
  useEffect(() => {
    let intervalId: any = null;
    const hasPending = timeEntries.some(e => {
      if (e.type !== 'Solicitud Horas Extra') return false;
      const s = parseOvertimeNota(e.note || '').status;
      if (!s) return false;
      return /pendiente|esperando|pending/i.test(s);
    });
    if (hasPending) {
      intervalId = setInterval(() => {
        refreshEntries().catch(() => { });
      }, 8000); // every 8s
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [timeEntries, refreshEntries]);

  // Mostrar un estado de carga mientras se recuperan los registros iniciales
  if (loadingInitialEntries) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Cargando tu jornada...</p>
      </div>
    );
  }

  // Guard: RRHH should not access this dashboard
  if (user.role === 'recursos' || user.role === 'admin' || user.role === 'contabilidad' || user.role === 'soporte' || user.role === 'ingenieria') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <div className="text-3xl font-bold text-slate-700">⚠️</div>
        <p className="text-lg text-slate-600">Este panel es solo para técnicos.</p>
        <p className="text-sm text-slate-500">Por favor, dirígete a tu panel correspondiente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SyncStatusBanner userId={user.id} />
      <InstallPrompt variant="compact" className="md:hidden" />

      <div>
        <h2 className="text-4xl font-extrabold tracking-tight font-headline bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8e] bg-clip-text text-transparent">
          ¡Hola, {user.name.split(' ')[0]}!
        </h2>
        <p className="text-slate-500 mt-2 text-lg">Tu panel de control personal.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-0 shadow-xl ring-1 ring-slate-100 dark:ring-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1e3a5f] to-[#3b6ea5]"></div>
          <CardHeader className="pb-2">
            <CardTitle className="font-headline text-slate-700 dark:text-slate-200">Tu Próxima Acción</CardTitle>
            <CardDescription className="capitalize font-medium text-slate-400">
              {formatTz(currentTime, "eeee, d 'de' MMMM", { locale: es, timeZone: 'America/Guatemala' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-6 py-6">
            <div className="text-6xl font-black font-mono tracking-tighter text-slate-800 dark:text-slate-100 drop-shadow-sm">
              {formatTz(currentTime, 'HH:mm:ss', { locale: es, timeZone: 'America/Guatemala' })}
            </div>
            {isWorkdayComplete ? (
              <div className="text-center p-4 rounded-md bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 w-full">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2" />
                <p className="font-semibold">¡Jornada Completa!</p>
                <p className="text-sm mb-4">{completionMessage}</p>
                <div className="flex flex-col gap-2">
                  <Button onClick={resetFlow} variant="secondary" className="w-full">
                    Reiniciar flujo
                  </Button>
                  <Button onClick={logout} className="w-full">
                    Cerrar Sesión
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-4">

                {/* ── PRIMARY ACTION ────────────────────────────────── */}
                {(() => {
                  // Determine the label + icon for the primary smart button
                  let primaryLabel: string;
                  let primaryIcon: React.ReactNode;
                  let primaryAction: TimeEntryType;
                  let primaryColor: string;

                  if (!lastEntry) {
                    primaryLabel = 'Llegada a oficina';
                    primaryIcon = <Building className="h-6 w-6" />;
                    primaryAction = 'Llegada a oficina';
                    primaryColor = 'from-[#1e3a5f] to-[#2d5a8e]';
                  } else if (lastEntry.type === 'Llegada a oficina') {
                    primaryLabel = 'Salir a proyecto';
                    primaryIcon = <Truck className="h-6 w-6" />;
                    primaryAction = 'Llegada a proyecto';
                    primaryColor = 'from-blue-500 to-cyan-600';
                  } else if (lastEntry.type === 'Llegada a proyecto' || lastEntry.type === 'Inicio en proyecto') {
                    primaryLabel = 'Salida de proyecto';
                    primaryIcon = <MapPin className="h-6 w-6" />;
                    primaryAction = 'Salida de proyecto';
                    primaryColor = 'from-orange-500 to-amber-600';
                  } else if (lastEntry.type === 'Salida de proyecto' || lastEntry.type === 'Hacia otro proyecto') {
                    primaryLabel = 'Próximo proyecto';
                    primaryIcon = <Truck className="h-6 w-6" />;
                    primaryAction = 'Llegada a proyecto';
                    primaryColor = 'from-blue-500 to-cyan-600';
                  } else if (lastEntry.type === 'Iniciar Almuerzo') {
                    primaryLabel = 'Terminar Almuerzo';
                    primaryIcon = <Utensils className="h-6 w-6" />;
                    primaryAction = 'Terminar Almuerzo';
                    primaryColor = 'from-green-500 to-green-600';
                  } else if (lastEntry.type === 'Terminar Almuerzo') {
                    primaryLabel = 'Salida de proyecto';
                    primaryIcon = <MapPin className="h-6 w-6" />;
                    primaryAction = 'Salida de proyecto';
                    primaryColor = 'from-orange-500 to-amber-600';
                  } else if (lastEntry.type === 'Regreso a oficina') {
                    primaryLabel = 'Hora de salida';
                    primaryIcon = <Clock className="h-6 w-6" />;
                    primaryAction = 'Hora de salida';
                    primaryColor = 'from-red-500 to-rose-600';
                  } else if (lastEntry.type === 'Salida de oficina') {
                    primaryLabel = 'Llegada a proyecto';
                    primaryIcon = <Truck className="h-6 w-6" />;
                    primaryAction = 'Llegada a proyecto';
                    primaryColor = 'from-blue-500 to-cyan-600';
                  } else {
                    primaryLabel = 'Hora de salida';
                    primaryIcon = <Clock className="h-6 w-6" />;
                    primaryAction = 'Hora de salida';
                    primaryColor = 'from-red-500 to-rose-600';
                  }

                  return (
                    <button
                      disabled={isLocating}
                      onClick={() => performActionFromPanel(primaryAction)}
                      className={`
                        w-full flex items-center justify-center gap-3 py-5 px-6 rounded-2xl
                        text-white font-bold text-lg
                        bg-gradient-to-br ${primaryColor}
                        shadow-lg transform transition-all duration-200
                        hover:scale-[1.03] hover:shadow-xl
                        active:scale-[0.98]
                        disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100
                        focus:outline-none focus:ring-4 focus:ring-white/30
                      `}
                    >
                      {isLocating
                        ? <><Loader2 className="h-5 w-5 animate-spin" /> Localizando...</>
                        : <>{primaryIcon} {primaryLabel} →</>
                      }
                    </button>
                  );
                })()}

                {/* ── SECONDARY ACTIONS (icon grid) ─────────────────── */}
                <div>
                  <button
                    onClick={() => setShowFlowPanel(prev => !prev)}
                    className="w-full text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 py-1 transition-colors"
                  >
                    <ChevronsUpDown className="h-3 w-3" />
                    {showFlowPanel ? 'Ocultar acciones' : 'Otras acciones'}
                  </button>

                  {showFlowPanel && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {([
                        { key: 'Llegada a oficina', label: 'Llegada oficina', icon: <Building className="h-4 w-4" />, color: 'bg-blue-50 text-[#1e3a5f] border-blue-200 hover:bg-blue-100' },
                        { key: 'Salida de oficina', label: 'Salida oficina', icon: <Building className="h-4 w-4" />, color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
                        { key: 'Llegada a proyecto', label: 'Llegada proy.', icon: <Truck className="h-4 w-4" />, color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
                        { key: 'Salida de proyecto', label: 'Salida proy.', icon: <MapPin className="h-4 w-4" />, color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
                        { key: 'Iniciar Almuerzo', label: 'Ini. almuerzo', icon: <Utensils className="h-4 w-4" />, color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' },
                        { key: 'Terminar Almuerzo', label: 'Fin almuerzo', icon: <Utensils className="h-4 w-4" />, color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
                        { key: 'Regreso a oficina', label: 'Regreso ofic.', icon: <Building className="h-4 w-4" />, color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
                        { key: 'Hora de salida', label: 'Hora de salida', icon: <Clock className="h-4 w-4" />, color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
                      ] as { key: TimeEntryType; label: string; icon: React.ReactNode; color: string }[]).map(item => (
                        <button
                          key={item.key}
                          disabled={isLocating}
                          onClick={() => { setShowFlowPanel(false); performActionFromPanel(item.key); }}
                          className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all ${item.color} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {item.icon}
                          <span className="text-center leading-tight">{item.label}</span>
                        </button>
                      ))}

                      {/* Horas extra */}
                      {(() => {
                        const now = new Date();
                        const h = now.getHours() + now.getMinutes() / 60;
                        const OVERRIDE = typeof process !== 'undefined' && (
                          process.env.NEXT_PUBLIC_ENABLE_OVERTIME_ALWAYS === 'true' || process.env.NODE_ENV === 'development'
                        );
                        const available = OVERRIDE || h >= 16.5 || h < 6.5;
                        return (
                          <button
                            disabled={!available || isLocating}
                            onClick={() => { setShowFlowPanel(false); setShowOvertimeModal(true); }}
                            title={available ? 'Solicitar horas extra' : 'Disponible a partir de las 4:30 PM'}
                            className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all ${available
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                              : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              } disabled:opacity-50`}
                          >
                            <Clock className="h-4 w-4" />
                            <span className="text-center leading-tight">Horas extra</span>
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </div>

              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">Resumen de Horas</CardTitle>
            <CardDescription>Tus horas de trabajo calculadas para hoy.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-background rounded-lg border">
              <p className="text-sm font-medium text-muted-foreground">Horas Totales</p>
              <p className={`text-4xl font-bold font-mono ${animateCounter ? 'transform scale-105 animate-pulse' : ''}`}>{formatHours(totalHours)}</p>
            </div>
            <div className="p-4 bg-background rounded-lg border">
              <p className="text-sm font-medium text-muted-foreground">Horas Regulares</p>
              <p className="text-4xl font-bold font-mono">{formatHours(regularHours)}</p>
            </div>
            <div className="p-4 bg-background rounded-lg border">
              <p className="text-sm font-medium text-muted-foreground">Horas Extra</p>
              <p className="text-4xl font-bold font-mono text-orange-500">{formatHours(overtimeHours)}</p>

            </div>
          </CardContent>
        </Card>

      </div>

      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        localStorage.setItem('technician-dashboard-tab', val);
      }}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg h-auto">
          <TabsTrigger
            value="activity"
            className="flex items-center justify-center gap-1 px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap
              data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm
              data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:text-slate-800
              transition-all duration-200 rounded"
          >
            <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Actividad</span>
            <span className="sm:hidden">Actividad</span>
          </TabsTrigger>

          <TabsTrigger
            value="rendimiento"
            className="flex items-center justify-center gap-1 px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap
              data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm
              data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:text-slate-800
              transition-all duration-200 rounded"
          >
            <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Rendimiento</span>
            <span className="sm:hidden">Rendimiento</span>
          </TabsTrigger>

          <TabsTrigger
            value="facturas"
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1 px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap
              data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm
              data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:text-slate-800
              transition-all duration-200 rounded"
          >
            <List className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span>Facturas</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline">Registro de Actividad de Hoy</CardTitle>
              <CardDescription>Un registro de todas tus entradas de tiempo para hoy.</CardDescription>
            </CardHeader>
            <CardContent>
              {timeEntries.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Acción</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Ubicación / Proyecto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...timeEntries].reverse().map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                          {getIconForEntry(entry.type)}
                          <div className="flex items-center gap-2">
                            <span>{entry.type}</span>
                            {entry.type === 'Solicitud Horas Extra' && (
                              (() => {
                                // Buscar la solicitud en overtimeRequests por el id embebido en la nota
                                const parsed = parseOvertimeNota(entry.note || '');
                                let req = null as any;
                                if (parsed.requestId) {
                                  req = overtimeRequests.find(r => String(r.id) === String(parsed.requestId));
                                }
                                if (!req) {
                                  // fallback: intentar encontrar la solicitud por fecha y horas (más confiable), luego por fecha general
                                  const entryDate = formatTz(entry.timestamp, 'yyyy-MM-dd', { timeZone: 'America/Guatemala' });
                                  // primero por fecha + horas
                                  req = overtimeRequests.find(r => r.fecha === entryDate && String(r.horas) === String(parsed.estimatedHours || r.horas));
                                  // si no se encuentra, tomar la primera solicitud del mismo día (posible duplicado pero mejor que nada)
                                  if (!req) req = overtimeRequests.find(r => r.fecha === entryDate);
                                }
                                let estado = parsed.status || 'Esperando respuesta';
                                if (!parsed.status && req) {
                                  if (req.aceptado === true) estado = 'Aceptado';
                                  else if (req.aceptado === false) estado = 'Negado';
                                }
                                const color = estado === 'Aceptado' ? 'bg-green-100 text-green-800' : estado === 'Negado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
                                return (
                                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{estado}</span>
                                );
                              })()
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{entry.rawTime ? entry.rawTime : formatSafe(entry.timestamp, 'p')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.projectName ? (
                            <div className='flex flex-col gap-1'>
                              <div className='flex items-center gap-2'>
                                <Building className="h-4 w-4" /> <span>{entry.projectName}</span>
                              </div>
                              {entry.location && (
                                <div className='flex items-center gap-2 pl-1'>
                                  <MapPin className="h-3 w-3" />
                                  <span>{entry.location.latitude.toFixed(4)}, {entry.location.longitude.toFixed(4)}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            entry.location ? (
                              <div className='flex flex-col gap-1'>
                                <div className='flex items-center gap-2'>
                                  <MapPin className="h-4 w-4" />
                                  <span>{entry.location.latitude.toFixed(4)}, {entry.location.longitude.toFixed(4)}</span>
                                </div>
                                {entry.type === 'Solicitud Horas Extra' && (() => {
                                  const parsed = parseOvertimeNota(entry.note || '');
                                  let req = null as any;
                                  if (parsed.requestId) {
                                    req = overtimeRequests.find(r => String(r.id) === String(parsed.requestId));
                                  }
                                  if (!req) {
                                    const entryDate = formatTz(entry.timestamp, 'yyyy-MM-dd', { timeZone: 'America/Guatemala' });
                                    req = overtimeRequests.find(r => r.fecha === entryDate && String(r.horas) === String(parsed.estimatedHours || r.horas));
                                    if (!req) req = overtimeRequests.find(r => r.fecha === entryDate);
                                  }
                                  return req ? (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      <div><strong>Motivo:</strong> {req.motivo}</div>
                                      <div><strong>Horas solicitadas:</strong> {req.horas}</div>
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            ) : 'N/A'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No hay registros para hoy.</p>
                  <p>Presiona el botón de arriba para comenzar tu día.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rendimiento" className="p-4">
          <TechnicianPerformance user={performanceUser} />
        </TabsContent>
        <TabsContent value="facturas" className="p-4">
          <InvoiceManager userId={user.id} />
        </TabsContent>
      </Tabs>

      <Dialog open={isProjectModalOpen} onOpenChange={(isOpen) => {
        setIsProjectModalOpen(isOpen);
        if (!isOpen) {
          setProjectSearchTerm(''); // Clear search on close
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleccionar Proyecto</DialogTitle>
            <DialogDescription>
              {pendingAction === 'Hacia otro proyecto'
                ? 'Elige el nuevo proyecto al que te diriges.'
                : 'Elige el proyecto al que estás llegando.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Input
              placeholder="Buscar por nombre o dirección..."
              value={projectSearchTerm}
              onChange={(e) => setProjectSearchTerm(e.target.value)}
              disabled={loadingProjects}
            />
            <Input placeholder="Nota (opcional)" value={modalNote} onChange={(e) => setModalNote(e.target.value)} disabled={loadingProjects} />
          </div>
          <div className="flex flex-col space-y-2 max-h-[60vh] overflow-y-auto">
            {loadingProjects ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Cargando proyectos...</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Building className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">No hay proyectos disponibles</p>
              </div>
            ) : (
              filteredProjects.map(p => (
                <Button
                  key={p.id}
                  variant="outline"
                  className="w-full justify-start p-4 h-auto"
                  onClick={() => { console.log("Button Clicked!"); handleProjectSelection(p); }}
                >
                  <div className="flex items-center gap-4">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{p.address}</p>
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Final confirmation modal shown after Hora de salida */}
      <Dialog open={showFinalModal} onOpenChange={(isOpen) => setShowFinalModal(isOpen)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-2">
              <CheckCircle2 className="text-primary h-12 w-12" />
              <span className="text-xl">Jornada finalizada</span>
            </DialogTitle>
            <DialogDescription className="text-center">{finalModalText}</DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex justify-center">
            <Button onClick={() => { setShowFinalModal(false); setCompletionMessage(''); }}>{'Cerrar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Central flow modal for confirming action and adding note/overtime */}
      <Dialog open={isFlowModalOpen} onOpenChange={(isOpen) => setIsFlowModalOpen(isOpen)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar acción</DialogTitle>
            <DialogDescription>Agrega una nota opcional y marca si corresponde como horas extra.</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Input placeholder="Nota (opcional)" value={modalNote} onChange={(e) => setModalNote(e.target.value)} />
            <div className="text-sm text-muted-foreground">Si quieres activar el modo "Horas extra", selecciona esa opción en el menú Flujo y elige el proyecto.</div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => { setIsFlowModalOpen(false); setPendingAction(null); setModalNote(''); }}>Cancelar</Button>
            <Button onClick={confirmFlow} disabled={isLocating}>{isLocating ? 'Procesando...' : 'Confirmar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de solicitud de horas extra */}
      <Dialog open={showOvertimeModal} onOpenChange={setShowOvertimeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Horas Extra</DialogTitle>
            <DialogDescription>Describe brevemente el motivo de las horas extra. El administrador debe autorizar antes de continuar.</DialogDescription>
          </DialogHeader>
          {/* Overtime Request Modal Content */}
          <div className="py-2 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Motivo</label>
              <Input
                placeholder="Ej: Instalación extendida"
                value={overtimeReason}
                onChange={e => setOvertimeReason(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Hora Inicio</label>
                <Input
                  type="time"
                  value={overtimeStartTime}
                  onChange={e => setOvertimeStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Hora Fin</label>
                <Input
                  type="time"
                  value={overtimeEndTime}
                  onChange={e => setOvertimeEndTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Proyecto</label>
              <Popover open={openOvertimeCombobox} onOpenChange={setOpenOvertimeCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openOvertimeCombobox}
                    className="w-full justify-between"
                  >
                    {overtimeProjectState
                      ? projects.find((p) => String(p.id) === String(overtimeProjectState))?.name
                      : "Seleccionar Proyecto..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Buscar proyecto..."
                      value={overtimeSearch}
                      onChange={(e) => setOvertimeSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    {projects.filter(p => !overtimeSearch || p.name.toLowerCase().includes(overtimeSearch.toLowerCase())).map((p) => (
                      <div
                        key={p.id}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                          String(overtimeProjectState) === String(p.id) ? "bg-accent" : ""
                        )}
                        onClick={() => {
                          setOvertimeProjectState(String(p.id));
                          setOpenOvertimeCombobox(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            String(overtimeProjectState) === String(p.id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {p.name}
                      </div>
                    ))}
                    {projects.filter(p => !overtimeSearch || p.name.toLowerCase().includes(overtimeSearch.toLowerCase())).length === 0 && (
                      <div className="py-6 text-center text-sm text-muted-foreground">No se encontraron proyectos.</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Detalles / Tareas</label>
              <textarea
                placeholder="Describe brevemente las tareas a realizar..."
                className="w-full p-2 border rounded resize-none"
                rows={3}
                value={overtimeTasks}
                onChange={(e) => setOvertimeTasks(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowOvertimeModal(false)}>Cancelar</Button>
            <Button onClick={async () => {
              setOvertimeLoading(true);
              if (!overtimeReason || !overtimeReason.trim()) {
                toast({ variant: 'destructive', title: 'Faltan datos', description: 'Ingresa el motivo de la solicitud.' });
                setOvertimeLoading(false);
                return;
              }
              if (!overtimeStartTime || !overtimeEndTime) {
                toast({ variant: 'destructive', title: 'Faltan datos', description: 'Ingresa la hora de inicio y fin.' });
                setOvertimeLoading(false);
                return;
              }
              if (!overtimeProjectState) {
                toast({ variant: 'destructive', title: 'Faltan datos', description: 'Selecciona el proyecto.' });
                setOvertimeLoading(false);
                return;
              }

              let coords: Geo | null = null;
              try {
                coords = await new Promise<Geo | null>((resolve) => {
                  if (!navigator.geolocation) return resolve(null);
                  navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    () => resolve(null),
                    { timeout: 5000 }
                  );
                });
              } catch (e) {
                coords = null;
              }

              try {
                // Locate project name for payload display/audit
                const selectedProjObj = projects.find((p: any) => String(p.id) === String(overtimeProjectState));
                const projName = selectedProjObj ? selectedProjObj.name : '';

                const payloadToSend = {
                  usuario: user.email,
                  fecha: format(new Date(), 'yyyy-MM-dd'),
                  hora_inicio: overtimeStartTime,
                  hora_fin: overtimeEndTime,
                  motivo: overtimeReason,
                  tareas: overtimeTasks,
                  latitud: coords?.latitude,
                  longitud: coords?.longitude,
                  proyecto_id: overtimeProjectState,
                  proyecto: projName // Send name for legacy/log compatibility
                };

                const res = await fetch('/api/horas-extras', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payloadToSend)
                });
                const j = await res.json().catch(() => ({}));
                console.log('[Overtime] Response:', j);

                if (res.ok && j.ok) {
                  if (!j.auditWritten) {
                    console.warn('[Overtime] WARNING: Solicitud guardada pero no en log.', j.auditError);
                    toast({ variant: 'destructive', title: 'Advertencia', description: 'Solicitud guardada con advertencias.' });
                  } else {
                    await refreshEntries();
                    setOvertimeReason('');
                    setOvertimeStartTime('');
                    setOvertimeEndTime('');
                    setOvertimeProjectState('');
                    setOvertimeTasks('');
                    setShowOvertimeModal(false);
                    toast({ title: 'Solicitud enviada', description: 'Tu solicitud ha sido enviada para autorización.' });
                  }
                } else {
                  toast({ variant: 'destructive', title: 'Error', description: j?.error || 'Error al enviar solicitud.' });
                }
              } catch (e) {
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar la solicitud.' });
              } finally {
                setOvertimeLoading(false);
              }
            }} disabled={overtimeLoading}>{overtimeLoading ? 'Enviando...' : 'Solicitar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Confirmar Ubicación</DialogTitle>
            <DialogDescription>
              Verifica que estás dentro del rango del proyecto {mapProject?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 relative w-full bg-slate-100 overflow-hidden flex flex-col items-center justify-center">
            {isMapModalOpen && mapProject && (mapProject.latitud && mapProject.longitud) ? (
              <TechnicianMapView
                projectLat={mapProject.latitud}
                projectLng={mapProject.longitud}
                projectRadius={mapProject.radio || 50}
                projectName={mapProject.name}
                onLocationUpdate={(inZone) => setIsInsideProject(inZone)}
              />
            ) : (
              <div className="p-8 text-center">
                <div className="bg-yellow-100 text-yellow-800 p-4 rounded-full inline-block mb-4">
                  <MapPin className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Ubicación Flexible</h3>
                <p className="text-slate-600 max-w-md">
                  Este proyecto no tiene una ubicación GPS definida de forma estricta.
                  Puedes registrar tu entrada desde cualquier lugar.
                </p>
              </div>
            )}
          </div>

          {/* Footer stuck to bottom */}
          <div className="p-4 bg-white border-t flex flex-col gap-3 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-center gap-2 pb-2 border-b border-gray-100">
              {mapProject && (!mapProject.latitud || !mapProject.longitud) ? (
                <>
                  <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-sm font-medium text-blue-700">Registro habilitado (Sin restricción GPS)</p>
                </>
              ) : (
                <>
                  <div className={cn("h-3 w-3 rounded-full animate-pulse", isInsideProject ? "bg-green-500" : "bg-red-500")} />
                  <p className={cn("text-sm font-medium", isInsideProject ? "text-green-700" : "text-red-600")}>
                    {isInsideProject ? "Estás en la zona correcta" : "Estás fuera del rango"}
                  </p>
                </>
              )}
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setIsMapModalOpen(false)}>Cancelar</Button>
              <Button
                className={cn("flex-[2]", (isInsideProject || (mapProject && !mapProject.latitud)) ? "bg-green-600 hover:bg-green-700 text-white" : "")}
                disabled={!!(mapProject && mapProject.latitud && mapProject.longitud && !isInsideProject)}
                onClick={async () => {
                  try {
                    const action = pendingAction;
                    if (!action) return;

                    // Use the coords we have (or update them from map callback if needed, but currentCoords is stale? 
                    // Actually TechnicianMapView has the latest coords but only passes them to onLocationUpdate.
                    // Let's rely on the fact we are "inside" and just use the project location or the last known location.
                    // For now, let's just use currentCoords (which was set when we opened the map). 
                    // Ideally we'd update currentCoords from onLocationUpdate too.
                    const location = currentCoords || { latitude: mapProject?.latitud || 0, longitude: mapProject?.longitud || 0 };

                    if (action === 'Hacia otro proyecto') {
                      const currentProjectName = timeEntries.slice().reverse().find(e => e.type === 'Llegada a proyecto' || e.type === 'Inicio en proyecto')?.projectName || '';
                      const departureEntry: TimeEntry = {
                        id: `${user.id}-${Date.now()}-departure`,
                        userId: user.id,
                        type: 'Salida de proyecto',
                        timestamp: new Date(),
                        location: location,
                        projectName: currentProjectName
                      };
                      await saveTimeEntry(user.id, departureEntry.type, location, departureEntry.projectName);
                      setTimeEntries(prev => [...prev, departureEntry]);
                    }

                    const arrivalEntry: TimeEntry = {
                      id: `${user.id}-${Date.now()}-arrival`,
                      userId: user.id,
                      type: action === 'Inicio en proyecto' ? 'Inicio en proyecto' : 'Llegada a proyecto',
                      timestamp: new Date(),
                      location: location,
                      projectName: mapProject?.name || ''
                    };

                    await saveTimeEntry(user.id, arrivalEntry.type, location, arrivalEntry.projectName);
                    setTimeEntries(prev => [...prev, arrivalEntry]);
                    toast({ title: '¡Éxito!', description: `Llegada a ${mapProject?.name} registrada.` });

                    setIsMapModalOpen(false);
                    setPendingAction(null);
                    setMapProject(null);
                  } catch (e) {
                    console.error("Map confirmation error:", e);
                    toast({ variant: 'destructive', title: 'Error', description: 'No se pudo registrar la entrada.' });
                  }
                }}
              >
                {/* Text logic */}
                {mapProject && (!mapProject.latitud || !mapProject.longitud)
                  ? "CONFIRMAR LLEGADA"
                  : (isInsideProject ? "CONFIRMAR LLEGADA" : "Acércate más")
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
