"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { authenticate, saveTimeEntry, getTechnicianTodaysEntries, getFacialDescriptor, saveFacialDescriptor } from "@/app/actions";
import { createSupabaseUser, validateActivaEmail } from "@/app/user-actions";
import { User } from '../lib/types'; // Asegúrate de que la ruta sea correcta

// Import facial components dynamically (client-side only, no SSR)
const FacialEnrollment = dynamic(() => import("./facial-enrollment").then(mod => ({ default: mod.FacialEnrollment })), { ssr: false });
const FacialVerification = dynamic(() => import("./facial-verification").then(mod => ({ default: mod.FacialVerification })), { ssr: false });
const FacialLiveness = dynamic(() => import("./facial-liveness").then(mod => ({ default: mod.FacialLiveness })), { ssr: false });

const loginSchema = z.object({
  username: z.string().min(1, { message: "El usuario es requerido." }),
  password: z.string().min(1, { message: "La contraseña es requerida." }),
});

const signupSchema = z.object({
  email: z.string().email({ message: "Email inválido." }).refine(
    (email) => email.toLowerCase().endsWith('@aktivacorp.com'),
    { message: "Solo se permiten emails @aktivacorp.com" }
  ),
  password: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres." }).regex(/[A-Z]/, { message: "Debe contener una mayúscula." }).regex(/[0-9]/, { message: "Debe contener un número." }).regex(/[^a-zA-Z0-9]/, { message: "Debe contener un carácter especial." }),
  confirmPassword: z.string(),
  fullName: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// Estados del flujo de facial recognition
type FacialFlowState = "idle" | "enrollment" | "verification" | "liveness" | "complete" | "skip";
type AuthMode = "welcome" | "login" | "signup" | "pending";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [facialFlowState, setFacialFlowState] = React.useState<FacialFlowState>("idle");
  const [authenticatedUser, setAuthenticatedUser] = React.useState<User | null>(null);
  const [storedDescriptor, setStoredDescriptor] = React.useState<number[] | null>(null);
  const [authMode, setAuthMode] = React.useState<AuthMode>("welcome" as AuthMode);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      phone: "",
    },
  });

  const handleLogin = (user: User) => {
    // Siempre redirigir a /dashboard - la lógica de qué mostrar está en el componente
    router.push('/dashboard');
  };

  // Manejo del flujo de facial recognition
  const handleFacialComplete = async () => {
    if (!authenticatedUser) return;

    toast({
      title: "Autenticación Facial Completada",
      description: "Iniciando sesión...",
    });

    login(authenticatedUser);
    handleLogin(authenticatedUser);
  };

  const handleSkipFacial = async () => {
    if (!authenticatedUser) return;

    toast({
      title: "Reconocimiento Facial Omitido",
      description: "Continuando con contraseña...",
    });

    login(authenticatedUser);
    handleLogin(authenticatedUser);
  };

  const startFacialFlow = async (user: User) => {
    setAuthenticatedUser(user);

    // Si es admin o recursos, no necesita facial - ir directamente al dashboard
    if (user.role === 'admin' || user.role === 'recursos' || user.role === 'contabilidad' || user.role === 'soporte' || user.role === 'ingenieria') {
      console.log(`[Auth] User is ${user.role}, skipping facial flow`);
      setFacialFlowState("skip");
      return;
    }

    try {
      // Verificar si el usuario tiene descriptor facial registrado
      const descriptor = await getFacialDescriptor(user.id);
      let parsed: number[] | null = null;
      if (descriptor) {
        try {
          parsed = Array.isArray(descriptor) ? descriptor : JSON.parse(descriptor as unknown as string);
        } catch (e) {
          console.warn('No se pudo parsear el descriptor facial:', e);
          parsed = null;
        }
      }

      if (parsed && parsed.length > 0) {
        // Usuario ya tiene cara registrada -> ir a verificación
        setStoredDescriptor(parsed);
        setFacialFlowState("verification");
      } else {
        // Usuario NO tiene cara registrada -> ir a enrolamiento
        setFacialFlowState("enrollment");
      }
    } catch (error) {
      console.warn("No se pudo verificar facial descriptor:", error);
      // Si hay error, permitir saltar
      setFacialFlowState("skip");
    }
  };

  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      const result = await authenticate(values.username, values.password);

      if (!result.success) {
        throw new Error(result.error || 'Autenticación fallida');
      }
      if (!result.user) {
        throw new Error('Error desconocido al iniciar sesión');
      }

      const user = result.user;
      console.log('User authenticated:', user); // Log para depuración

      // Contraseña correcta, iniciar flujo de facial recognition
      await startFacialFlow(user);

      toast({
        title: "Inicio de Sesión Exitoso",
        description: `¡Hola ${user.name}! Verifica tu identidad con facial recognition.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Inicio de Sesión Fallido",
        description: error.message || "Un error inesperado ocurrió. Por favor, inténtalo de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSignupSubmit(values: z.infer<typeof signupSchema>) {
    setIsLoading(true);
    try {
      // Validar email corporativo
      const isValid = await validateActivaEmail(values.email);
      if (!isValid) {
        throw new Error("Solo se permiten emails @aktivacorp.com");
      }

      // Crear usuario en Supabase Auth y tabla users
      const result = await createSupabaseUser(
        values.email,
        values.password,
        values.fullName,
        values.phone
      );

      if (!result.success) {
        throw new Error(result.error || "Error creando usuario");
      }

      toast({
        title: "Cuenta Creada Exitosamente",
        description: "Tu cuenta está pendiente de aprobación por el equipo de RRHH. Te notificaremos cuando sea aprobada.",
      });

      // Cambiar a modo pending
      setAuthMode("pending");

      // Resetear formulario
      signupForm.reset();

      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al Crear Cuenta",
        description: error.message || "No se pudo crear tu cuenta. Por favor intenta de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Mostrar estado actual del flujo
  if (facialFlowState === "enrollment" && authenticatedUser) {
    return (
      <Card className="w-full max-w-lg mt-8 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Registrar Rostro</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Para mayor seguridad, registra tu rostro. Esto es opcional pero recomendado.
          </p>
        </CardHeader>
        <CardContent>
          <FacialEnrollment
            onSuccess={async (descriptor) => {
              try {
                // Serializar y guardar en servidor
                const serialized = JSON.stringify(descriptor.descriptor || descriptor);
                await saveFacialDescriptor(authenticatedUser.id, serialized);
                // Set stored descriptor locally
                const parsed = Array.isArray(descriptor.descriptor) ? descriptor.descriptor : (descriptor as any).descriptor;
                setStoredDescriptor(parsed);
                setFacialFlowState("liveness");
              } catch (e) {
                console.error('Error guardando descriptor en enroll:', e);
                // permitir continuar al flujo de liveness pero avisar
                setFacialFlowState("liveness");
              }
            }}
            onCancel={() => setFacialFlowState("skip")}
          />
        </CardContent>
      </Card>
    );
  }

  if (facialFlowState === "verification" && authenticatedUser) {
    return (
      <Card className="w-full max-w-lg mt-8 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Verificar Rostro</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Verifica tu identidad mostrando tu rostro a la cámara.
          </p>
        </CardHeader>
        <CardContent>
          {storedDescriptor ? (
            <FacialVerification
              storedDescriptor={storedDescriptor}
              userName={authenticatedUser.name}
              onSuccess={() => setFacialFlowState("liveness")}
              onCancel={() => setFacialFlowState("skip")}
            />
          ) : (
            // Si por alguna razón no tenemos el descriptor local, volver a enrollment
            <div className="p-4">
              <p className="text-sm text-muted-foreground">No se encontró el descriptor localmente. Por favor registra tu rostro.</p>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => setFacialFlowState('enrollment')}>Registrar</Button>
                <Button variant="outline" onClick={() => setFacialFlowState('skip')}>Saltar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (facialFlowState === "liveness" && authenticatedUser) {
    return (
      <Card className="w-full max-w-lg mt-8 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Prueba de Vida</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Completa una acción simple para confirmar que eres una persona real.
          </p>
        </CardHeader>
        <CardContent>
          <FacialLiveness
            onSuccess={handleFacialComplete}
            onCancel={handleSkipFacial}
          />
        </CardContent>
      </Card>
    );
  }

  if (facialFlowState === "skip") {
    // Usuario eligió saltarse o no tiene cámara - permitir entrada normal
    setTimeout(() => {
      if (authenticatedUser) {
        login(authenticatedUser);
        handleLogin(authenticatedUser);
      }
    }, 500);

    return (
      <Card className="w-full max-w-sm mt-8 shadow-xl">
        <CardContent className="pt-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Entrando al dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  // Pantalla de bienvenida: elegir entre Login o Signup
  if (authMode === "welcome") {
    return (
      <Card className="w-full max-w-lg mt-8 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">¡Bienvenido!</CardTitle>
          <p className="text-sm text-muted-foreground mt-3">
            Elige cómo deseas acceder a Marcaje Aktiva
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            onClick={() => setAuthMode("login")}
            className="w-full bg-primary hover:bg-primary/90 h-12 text-base"
          >
            Iniciar Sesión
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              signupForm.reset();
              setAuthMode("signup");
            }}
            className="w-full h-12 text-base border-green-600 text-green-600 hover:bg-green-50"
          >
            Crear Cuenta Nueva
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-4">
            Solo se permiten correos corporativos @aktivacorp.com para crear cuenta
          </p>
        </CardContent>
      </Card>
    );
  }

  // Pantalla de pending
  if (authMode === "pending") {
    return (
      <Card className="w-full max-w-sm mt-8 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">¡Cuenta Creada!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Tu cuenta está pendiente de aprobación por el equipo de RRHH.
          </p>
          <p className="text-sm text-muted-foreground">
            Recibirás una notificación cuando sea aprobada.
          </p>
          <Button onClick={() => setAuthMode("welcome")} className="w-full">
            Volver al Inicio
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Formularios de Login/Signup
  if (authMode === "login") {
    return (
      <Card className="w-full max-w-sm mt-8 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Iniciar Sesión</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Accede con tu usuario y contraseña
          </p>
        </CardHeader>
        <CardContent>
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
              <FormField
                control={loginForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario</FormLabel>
                    <FormControl>
                      <Input placeholder="tu-usuario" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar Sesión
              </Button>
            </form>
          </Form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-center text-muted-foreground mb-4">
              ¿No tienes cuenta?
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                signupForm.reset();
                setAuthMode("signup");
              }}
            >
              Crear Cuenta
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Formulario de Signup
  return (
    <Card className="w-full max-w-sm mt-8 shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Crear Cuenta</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Solo se permiten correos @aktivacorp.com
        </p>
      </CardHeader>
      <CardContent>
        <Form {...signupForm}>
          <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
            <FormField
              control={signupForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Corporativo</FormLabel>
                  <FormControl>
                    <Input placeholder="tu-email@aktivacorp.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={signupForm.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Pérez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={signupForm.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="+502 7123 4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={signupForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mín. 8 caracteres, 1 mayúscula, 1 número, 1 carácter especial
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={signupForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Cuenta
            </Button>
          </form>
        </Form>

        <div className="mt-6 pt-6 border-t">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              signupForm.reset();
              loginForm.reset();
              setAuthMode("welcome");
            }}
          >
            ← Volver Atrás
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
