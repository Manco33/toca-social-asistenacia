/**
 * FacialVerification.tsx
 * 
 * Componente para verificación facial (Fase 2)
 * Compara la cara en vivo con el descriptor almacenado
 */

"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Camera, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import {
  loadFaceAPIModels,
  startCamera,
  stopCamera,
  verifyFace,
  drawDetections,
  performLivenessScans,
  type VerificationResult,
} from '@/lib/facial-recognition';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface FacialVerificationProps {
  storedDescriptor: number[];
  onSuccess: () => void;
  onCancel: () => void;
  userName?: string;
}

export function FacialVerification({
  storedDescriptor,
  onSuccess,
  onCancel,
  userName = 'Usuario',
}: FacialVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [livenessRunning, setLivenessRunning] = useState(false);
  const [livenessAttempts, setLivenessAttempts] = useState(0);
  const [livenessResult, setLivenessResult] = useState<any | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const animationFrameRef = useRef<number>();

  // Inicializar modelos y cámara
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);

        // Cargar modelos
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
        console.error('[Verification] Error en inicialización:', error);
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
    };
  }, [toast]);
  
  // Ensure camera is stopped when component unmounts
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      stopCamera(cameraStreamRef.current);
    };
  }, []);

  const handleVerify = async () => {
    if (!videoRef.current) return;

    try {
      setVerifying(true);

      // Verificar la cara
      const verificationResult = await verifyFace(videoRef.current, storedDescriptor);

      setResult(verificationResult);

      if (verificationResult.isMatch) {
        // Si coincide el descriptor, ejecutar el "juego" de 3 escaneos (sin parpadeos)
        setLivenessResult(null);
        setLivenessAttempts(0);

        const scans = 3;
        const requiredMatches = 2; // requiere al menos 2/3 matches
        setLivenessRunning(true);
        toast({ title: 'Verificando humano', description: `Iniciando juego de verificación (${scans} escaneos)` });

        const gameResult = await performLivenessScans(videoRef.current, storedDescriptor, scans, 600, requiredMatches);
        setLivenessRunning(false);
        setLivenessResult(gameResult);
        setLivenessAttempts(scans);

        if (gameResult.success) {
          toast({ title: 'Verificación completa', description: `Bienvenido, ${userName}` });
          setTimeout(() => {
            stopCamera(cameraStreamRef.current);
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            onSuccess();
          }, 800);
        } else {
          toast({ variant: 'destructive', title: 'Verificación fallida', description: gameResult.details || 'No se alcanzaron matches suficientes' });
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Verificación Fallida',
          description: `Distancia: ${verificationResult.distance.toFixed(3)} (umbral: 0.6)`,
        });
      }
    } catch (error) {
      console.error('[Verification] Error al verificar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error durante la verificación facial',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = () => {
    stopCamera(cameraStreamRef.current);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    onCancel();
  };

  const handleRetry = () => {
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Verificación Facial
          </CardTitle>
          <CardDescription>
            Verifica tu identidad con tu cara
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  <p className="text-white text-sm">Cargando modelos...</p>
                </div>
              </div>
            )}
          </div>

          {/* Resultado de verificación */}
          {result && (
            <div className="space-y-4">
              {result.isMatch ? (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    <strong>Verificación Exitosa!</strong> Tu cara coincide con el registro.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    <strong>Verificación Fallida.</strong> Tu cara no coincide con el registro.
                    <br />
                    <span className="text-sm">
                      Distancia: {result.distance.toFixed(3)} / Confianza: {result.confidence}%
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {/* Barra de confianza */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Nivel de Coincidencia</span>
                  <span className="font-semibold">{result.confidence}%</span>
                </div>
                <Progress value={result.confidence} className="h-2" />
              </div>

              {/* Detalles técnicos */}
              <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded">
                <p>
                  <strong>Distancia Euclidiana:</strong> {result.distance.toFixed(4)}
                </p>
                <p>
                  <strong>Umbral:</strong> 0.6 (menor = más similar)
                </p>
                <p>
                  <strong>Estado:</strong> {result.isMatch ? 'Coincidencia Aceptada' : 'Coincidencia Rechazada'}
                </p>
              </div>

              {/* Liveness game status */}
              <div className="text-sm space-y-2">
                {livenessRunning && (
                  <div className="flex items-center gap-2 text-blue-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verificando humano... realizando {livenessAttempts || 3} escaneos</span>
                  </div>
                )}

                {!livenessRunning && livenessResult && (
                  <div>
                    {livenessResult.success ? (
                      <div className="text-green-700">Juego pasado — {livenessResult.details}</div>
                    ) : (
                      <div className="text-red-700">Juego fallido — {livenessResult.details || 'No se alcanzaron matches suficientes'}</div>
                    )}

                    <div className="mt-2 text-xs text-muted-foreground">
                      <strong>Detalles por intento:</strong>
                      <ul className="list-disc list-inside">
                        {livenessResult.attempts && livenessResult.attempts.map((a: any, i: number) => (
                          <li key={i}>Intento {i+1}: distancia {a.distance.toFixed(3)} — {a.isMatch ? 'match' : 'no match'}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instrucciones cuando no hay resultado */}
          {!result && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <p className="text-blue-900 dark:text-blue-200 text-sm">
                ✓ Cámara lista. Colócate frente a la cámara de la misma manera que lo hiciste en el registro.
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3">
            {!result ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={loading || verifying}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={loading || verifying}
                  className="flex-1"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Verificar Cara'
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1"
                >
                  Salir
                </Button>
                {!result.isMatch && (
                  <Button
                    onClick={handleRetry}
                    className="flex-1"
                  >
                    Reintentar
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Instrucciones */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Instrucciones:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Colócate en la misma posición que en el registro</li>
              <li>Mantén buena iluminación frontal</li>
              <li>Mira directamente a la cámara</li>
              <li>Presiona "Verificar Cara" cuando estés listo</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
