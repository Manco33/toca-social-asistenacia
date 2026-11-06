/**
 * FacialEnrollment.tsx
 * 
 * Componente para el registro/enrolamiento facial (Fase 1)
 * Permite que el usuario capture su descriptor facial para futuros logins
 */

"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Camera, CheckCircle2, Loader2 } from 'lucide-react';
import {
  loadFaceAPIModels,
  startCamera,
  stopCamera,
  enrollMultipleSamples,
  drawDetections,
  serializeDescriptor,
  type EnrollmentResult,
  type FacialDescriptor,
} from '@/lib/facial-recognition';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FacialEnrollmentProps {
  onSuccess: (descriptor: FacialDescriptor) => void;
  onCancel: () => void;
}

export function FacialEnrollment({ onSuccess, onCancel }: FacialEnrollmentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [step, setStep] = useState<'init' | 'capture' | 'processing' | 'complete'>('init');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const animationFrameRef = useRef<number>();

  // Inicializar modelos y cámara
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);

        // Cargar modelos de face-api
        await loadFaceAPIModels();
        console.log('[Enrollment] Modelos cargados');

        // Iniciar cámara
        if (videoRef.current) {
          const stream = await startCamera(videoRef.current);
          setCameraStream(stream);
          cameraStreamRef.current = stream;
          setStep('capture');
          console.log('[Enrollment] Cámara iniciada');

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
        console.error('[Enrollment] Error en inicialización:', error);
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

  // Ensure camera is stopped on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      stopCamera(cameraStreamRef.current);
    };
  }, []);

  const handleEnroll = async () => {
    if (!videoRef.current) return;

    try {
      setEnrolling(true);
      setStep('processing');

      // Capturar 3 muestras de la cara del usuario
      const result = await enrollMultipleSamples(videoRef.current, 3, 500);

      if (!result.success || !result.descriptor) {
        toast({
          variant: 'destructive',
          title: 'Fallo en el Registro',
          description: result.error || 'No se pudo registrar la cara',
        });
        setStep('capture');
        return;
      }

      setStep('complete');
      toast({
        title: 'Registro Exitoso',
        description: 'Tu descriptor facial ha sido capturado',
      });

      // Simular envío al servidor
      console.log('[Enrollment] Descriptor serializado:', serializeDescriptor(result.descriptor.descriptor));

      // Llamar callback con el descriptor
      onSuccess(result.descriptor);
    } catch (error) {
      console.error('[Enrollment] Error al registrar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error durante el registro facial',
      });
      setStep('capture');
    } finally {
      setEnrolling(false);
    }
  };

  const handleCancel = () => {
    stopCamera(cameraStreamRef.current);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    onCancel();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Registro Facial
          </CardTitle>
          <CardDescription>
            Capturaremos tu descriptor facial para verificaciones futuras
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Advertencia de seguridad */}
          <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>Importante:</strong> Usa tu propia cara. No uses fotos ni videos de otras personas.
              Este sistema incluye detección básica de vida, pero utiliza tu rostro real en vivo.
            </AlertDescription>
          </Alert>

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

          {/* Estado del paso */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            {step === 'capture' && (
              <p className="text-blue-900 dark:text-blue-200">
                ✓ Cámara lista. Posiciónate frente a la cámara con buena iluminación.
              </p>
            )}
            {step === 'processing' && (
              <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p>Capturando y procesando tu cara...</p>
              </div>
            )}
            {step === 'complete' && (
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                <p>Registro completado exitosamente</p>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={enrolling}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnroll}
              disabled={loading || enrolling || step !== 'capture'}
              className="flex-1"
            >
              {enrolling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar Cara'
              )}
            </Button>
          </div>

          {/* Instrucciones */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Instrucciones:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Acércate a la cámara (25-30 cm de distancia)</li>
              <li>Busca buena iluminación frontal</li>
              <li>Mantén tu cara centrada en el recuadro verde</li>
              <li>Mira directamente a la cámara</li>
              <li>Se capturarán 3 muestras (espera los 1-2 segundos entre cada una)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
