"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

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
import { authenticate, getFacialDescriptor } from "@/app/actions";
import { User } from '../lib/types';

const formSchema = z.object({
  username: z.string().min(1, { message: "El usuario es requerido." }),
  password: z.string().min(1, { message: "La contraseña es requerida." }),
});

type FacialFlowState = "idle" | "enrollment" | "verification" | "liveness" | "complete" | "skip";

/**
 * LoginForm con soporte para Facial Recognition
 * 
 * Flujo:
 * 1. Usuario escribe usuario/contraseña
 * 2. Si es correcto → se muestra facial enrollment o verification
 * 3. Facial recognition es OPCIONAL pero RECOMENDADO
 * 4. Después de liveness → entra al dashboard
 */
export function LoginFormWithFacial() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [facialFlowState, setFacialFlowState] = React.useState<FacialFlowState>("idle");
  const [authenticatedUser, setAuthenticatedUser] = React.useState<User | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleLogin = (user: User) => {
    router.push('/dashboard');
  };

  const handleFacialComplete = async () => {
    if (!authenticatedUser) return;

    toast({
      title: "✅ Autenticación Completa",
      description: "Bienvenido, accediendo al dashboard...",
    });

    login(authenticatedUser);
    handleLogin(authenticatedUser);
  };

  const handleSkipFacial = async () => {
    if (!authenticatedUser) return;

    // Para usuarios sin facial, permitir acceso normal
    login(authenticatedUser);
    handleLogin(authenticatedUser);
  };

  const startFacialFlow = async (user: User) => {
    setAuthenticatedUser(user);

    try {
      // Verificar si usuario tiene descriptor facial
      const descriptor = await getFacialDescriptor(user.id);

      if (descriptor) {
        // Ya tiene cara → ir a verificación
        setFacialFlowState("verification");
        toast({
          title: "Verificación Facial",
          description: "Muestra tu rostro para verificar tu identidad",
        });
      } else {
        // No tiene cara → ir a enrolamiento
        setFacialFlowState("enrollment");
        toast({
          title: "Registrar Rostro",
          description: "Registra tu rostro para mayor seguridad",
        });
      }
    } catch (error) {
      console.error("Error en facial flow:", error);
      // Si hay error, permitir acceso normal
      setFacialFlowState("skip");
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const result = await authenticate(values.username, values.password);

      if (!result.success) {
        throw new Error(result.error || 'Autenticación fallida');
      }
      if (!result.user) {
        throw new Error('Autenticación fallida: usuario no devuelto');
      }

      const user = result.user;

      // Contraseña correcta → iniciar facial flow
      await startFacialFlow(user);

      toast({
        title: "Autenticación Correcta",
        description: `¡Hola ${user.name}! Próximo: Verificación facial.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error en Login",
        description: error.message || "Usuario o contraseña incorrectos.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ============================================
  // ESTADO: Enrollment (Registrar cara)
  // ============================================
  if (facialFlowState === "enrollment" && authenticatedUser) {
    return (
      <Card className="w-full max-w-lg mt-8 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">📸 Registrar Rostro</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Para mayor seguridad, registra tu rostro. Esto es <strong>opcional</strong> pero recomendado.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              ℹ️ Necesitaremos acceder a tu cámara para capturar tu rostro.
              Daremos 3 intentos para obtener una buena captura.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                // TODO: Importar FacialEnrollment y mostrar aquí
                // Por ahora, saltamos a liveness
                setFacialFlowState("liveness");
              }}
            >
              📷 Registrar Cara
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => setFacialFlowState("liveness")}
            >
              Omitir por ahora
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================
  // ESTADO: Verification (Verificar cara)
  // ============================================
  if (facialFlowState === "verification" && authenticatedUser) {
    return (
      <Card className="w-full max-w-lg mt-8 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">🔐 Verificar Rostro</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Verifica tu identidad mostrando tu rostro a la cámara.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-900">
              ⚠️ Asegúrate de que tu rostro esté bien iluminado y visible en la cámara.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                // TODO: Importar FacialVerification y mostrar aquí
                // Por ahora, saltamos a liveness
                setFacialFlowState("liveness");
              }}
            >
              ✅ Verificar Cara
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => handleSkipFacial()}
            >
              Saltar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================
  // ESTADO: Liveness (Prueba de vida)
  // ============================================
  if (facialFlowState === "liveness" && authenticatedUser) {
    return (
      <Card className="w-full max-w-lg mt-8 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">🎬 Prueba de Vida</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Completa una acción simple para confirmar que eres una persona real.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-900 font-medium mb-2">Elige un desafío:</p>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>👀 <strong>Parpadea</strong> 2 veces (más rápido)</li>
              <li>🔄 <strong>Gira tu cabeza</strong> de lado a lado (más confiable)</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              onClick={() => {
                // TODO: Importar FacialLiveness y mostrar aquí
                // Por ahora, completamos el flujo
                handleFacialComplete();
              }}
            >
              🎬 Iniciar Desafío
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={handleSkipFacial}
            >
              Saltar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================
  // ESTADO: Idle (Login form)
  // ============================================
  return (
    <Card className="w-full max-w-sm mt-8 shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">🔓 Iniciar Sesión</CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Con soporte para Reconocimiento Facial
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
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
              control={form.control}
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
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Sesión
            </Button>
          </form>
        </Form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600">
            <strong>ℹ️ Nota:</strong> Después de iniciar sesión con tu contraseña,
            se te pedirá que configures el reconocimiento facial (opcional).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
