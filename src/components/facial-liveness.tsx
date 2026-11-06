/**
 * FacialLiveness.tsx
 * 
 * Componente para detección de vida (Fase 3)
 * Detecta parpadeos naturales para verificar que es una persona real
 */

"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Camera, CheckCircle2, Loader2, Eye } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';
import {
  loadFaceAPIModels,
  startCamera,
  stopCamera,
  detectFaceScans,
  drawDetections,
  type LivenessResult,
} from '@/lib/facial-recognition';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface FacialLivenessProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function FacialLiveness({
  onSuccess,
  onCancel,
}: FacialLivenessProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<LivenessResult | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const { toast } = useToast();
  const animationFrameRef = useRef<number>();
  const timerIntervalRef = useRef<NodeJS.Timeout>();

  // Inicializar modelos y cámara
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);

        // Cargar modelos faciales
        await loadFaceAPIModels();

        // Iniciar cámara
        if (videoRef.current) {
          const stream = await startCamera(videoRef.current);
          setCameraStream(stream);
            cameraStreamRef.current = stream;

          // Iniciar dibujo de detecciones
          const drawFrame = async () => {
            if (videoRef.current && canvasRef.current) {
              await drawDetections(videoRef.current, canvasRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(drawFrame);
          };
          drawFrame();
        }
      } catch (error) {
        console.error('[Liveness] Error en inicialización:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'Error al inicializar',
        });
      } finally {
        setLoading(false);
      }
    };

    initialize();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [toast]);
  
  // Ensure camera is stopped on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopCamera(cameraStreamRef.current);
    };
  }, []);

  const handleStartTest = async () => {
    if (!videoRef.current) return;

    try {
      setTesting(true);
      const scans = 3;
      const delay = 600;
      const required = 2;

      setTimeRemaining(scans * Math.ceil(delay / 1000));

      // Iniciar temporizador (informativo)
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
          }
          return Math.max(0, prev - 1);
        });
      }, 1000);

      const liveness = await detectFaceScans(videoRef.current, scans, delay, required);
      setResult(liveness);

      if (liveness.passed) {
        toast({
          title: 'Prueba Completada',
          description: 'Tu identidad ha sido verificada como real.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Prueba Fallida',
          description: liveness.details || 'No se completó el desafío correctamente',
        });
      }
    } catch (error) {
      console.error('[Liveness] Error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error durante la prueba de vida',
      });
    } finally {
      setTesting(false);
      setTimeRemaining(0);
    }
  };  const handleCancel = () => {
    stopCamera(cameraStreamRef.current);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    onCancel();
  };

  const handleRetry = () => {
    setResult(null);
  };

  const getInstructions = () => {
    return [
      'Mira directamente a la cámara',
      'Mantente quieto durante los escaneos',
      'Evita movimientos bruscos o giros de cabeza',
      'Se harán 3 escaneos rápidos automáticamente',
    ];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
               Verificación Rápida
          </CardTitle>
          <CardDescription>
               Realizaremos tres escaneos rápidos para verificar tu presencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Advertencia de seguridad */}
          <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>Seguridad:</strong> Este paso previene ataques con fotos o videos.
              Debes usar tu rostro real en vivo.
            </AlertDescription>
          </Alert>

          {/* Instrucciones de Parpadeo */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-lg flex flex-col items-center gap-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Instrucciones:</p>
            <div className="flex items-center justify-center">
              <Eye className="h-12 w-12 text-blue-600" />
            </div>
               <p className="text-xl font-bold text-blue-700 dark:text-blue-300">Mantente quieto</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                 Mantente frente a la cámara durante los tres escaneos. Evita movimientos bruscos.
            </p>
          </div>

          {/* Video y Canvas */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ display: loading ? 'none' : 'block' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-2" />
                  <p className="text-white text-sm">Cargando...</p>
                </div>
              </div>
            )}

            {/* Temporizador */}
            {testing && timeRemaining > 0 && (
              <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-lg font-bold">
                {timeRemaining}s
              </div>
            )}
          </div>

          {/* Resultado */}
          {result && (
            <div className="space-y-4">
              {result.passed ? (
                <>
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      <strong>Prueba Completada!</strong> Se detectó que eres una persona real.
                    </AlertDescription>
                  </Alert>
                  <Button onClick={onSuccess} className="w-full">
                    Continuar
                  </Button>
                </>
              ) : (
                <>
                  <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      <strong>Prueba No Completada.</strong> {result.details}
                    </AlertDescription>
                  </Alert>
                  <Button onClick={handleRetry} className="w-full" variant="outline">
                    Reintentar
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Estado */}
          {!result && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              {!testing ? (
                <p className="text-blue-900 dark:text-blue-200 text-sm">
                  ✓ Cámara lista. Presiona el botón abajo para iniciar la prueba.
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-900 dark:text-blue-200" />
                     <p className="text-blue-900 dark:text-blue-200 text-sm">
                       Verificando presencia... Mantente quieto.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Instrucciones */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Instrucciones:</p>
            <ul className="list-disc list-inside space-y-1">
              {getInstructions().map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ul>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={testing}
              className="flex-1"
            >
              Cancelar
            </Button>
            {!result && (
              <Button
                onClick={handleStartTest}
                disabled={loading || testing}
                className="flex-1"
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Probando...
                  </>
                ) : (
                  'Iniciar Prueba'
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
