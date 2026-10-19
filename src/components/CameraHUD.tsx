import React, { useRef, useEffect, useState, useCallback } from 'react';
import { visionEngine, type VisuChordDetectionResult } from '../lib/visionEngine';
import { soundEngine } from '../lib/soundEngine';
import { rhythmEngine } from '../lib/rhythmEngine';
import { 
  getChordNotes, 
  getChordFullName, 
  getChromaticNote,
  type ChromaticNote, 
  type ChordQuality,
  type NaturalNote,
  type Accidental,
  formatNoteName,
  CHORD_QUALITIES
} from '../lib/musicTheory';
import { AVAILABLE_GESTURES, type GestureId } from '../lib/gestureConfig';
import { generateSimulatedHandLandmarks } from '../lib/virtualHandSimulator';
import { VirtualPiano } from './VirtualPiano';
import { 
  Sparkles, 
  Camera, 
  CameraOff, 
  Volume2, 
  HelpCircle, 
  Settings2, 
  Activity, 
  Play, 
  RefreshCw,
  Radio,
  Sliders
} from 'lucide-react';
import type { PlayMode } from './ControlsHeader';

interface CameraHUDProps {
  onOpenGuide: () => void;
  onOpenSettings?: () => void;
  playMode: PlayMode;
}

// Conexões anatômicas da mão para o esqueleto do MediaPipe
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Polegar
  [0, 5], [5, 6], [6, 7], [7, 8],       // Indicador
  [0, 9], [9, 10], [10, 11], [11, 12],  // Médio
  [0, 13], [13, 14], [14, 15], [15, 16],// Anelar
  [0, 17], [17, 18], [18, 19], [19, 20],// Mínimo
  [5, 9], [9, 13], [13, 17],            // Palma
];

// Desenha zonas sutis de altura para sustenido e bemol (Lado Esquerdo - Tônica)
function drawHeightZones(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

  // Linha de Sustenido (#)
  const sharpY = h * 0.35;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, sharpY);
  ctx.lineTo(w * 0.45, sharpY);
  ctx.stroke();
  ctx.fillText('▲ Zona Superior: Sustenido (#)', 16, sharpY - 8);

  // Linha de Bemol (♭)
  const flatY = h * 0.65;
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
  ctx.beginPath();
  ctx.moveTo(0, flatY);
  ctx.lineTo(w * 0.45, flatY);
  ctx.stroke();
  ctx.fillText('▼ Zona Inferior: Bemol (♭)', 16, flatY + 18);

  ctx.restore();
}

// Desenha os ossos e conexões da mão
function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number }[],
  w: number,
  h: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  // Desenha conexões
  HAND_CONNECTIONS.forEach(([i, j]) => {
    const p1 = landmarks[i];
    const p2 = landmarks[j];
    if (!p1 || !p2) return;
    ctx.beginPath();
    ctx.moveTo(p1.x * w, p1.y * h);
    ctx.lineTo(p2.x * w, p2.y * h);
    ctx.stroke();
  });

  // Desenha pontos das articulações
  landmarks.forEach((p, idx) => {
    ctx.beginPath();
    const isTip = [4, 8, 12, 16, 20].includes(idx);
    ctx.arc(p.x * w, p.y * h, isTip ? 6 : 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = isTip ? '#ffffff' : color;
    ctx.fill();
  });

  ctx.restore();
}

// Desenha a etiqueta flutuante sobre a mão (não invertida, legível)
function drawHandLabel(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  w: number,
  h: number,
  text: string,
  color: string
) {
  ctx.save();
  const x = center.x * w;
  const y = Math.max(32, center.y * h - 70);

  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  const textWidth = ctx.measureText(text).width;

  ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - textWidth / 2 - 10, y - 16, textWidth + 20, 26, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 3);
  ctx.restore();
}

// Desenha a onda visual ao palhetar
function drawShockwave(
  ctx: CanvasRenderingContext2D, 
  wave: { x: number; y: number; radius: number; alpha: number }
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(wave.x, wave.y, wave.radius, 0, 2 * Math.PI);
  ctx.strokeStyle = `rgba(192, 132, 252, ${wave.alpha})`;
  ctx.lineWidth = 4;
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 15;
  ctx.stroke();
  ctx.restore();
}

// Desenha o osciloscópio neon com a forma de onda do som em tempo real
function drawOscilloscope(
  ctx: CanvasRenderingContext2D,
  wave: Float32Array,
  w: number,
  h: number
) {
  if (!wave || wave.length === 0) return;

  let hasSignal = false;
  for (let i = 0; i < wave.length; i++) {
    if (Math.abs(wave[i]) > 0.005) {
      hasSignal = true;
      break;
    }
  }
  if (!hasSignal) return;

  ctx.save();
  ctx.beginPath();
  const sliceWidth = w / (wave.length - 1);
  const centerY = h - 28;

  for (let i = 0; i < wave.length; i++) {
    const x = i * sliceWidth;
    const y = centerY + wave[i] * 24;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.restore();
}

const NATURAL_NOTES: NaturalNote[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACCIDENTALS: { value: Accidental; label: string; shortcut: string }[] = [
  { value: 'flat', label: '♭ Bemol', shortcut: 'Z' },
  { value: 'natural', label: '♮ Natural', shortcut: 'X' },
  { value: 'sharp', label: '# Sustenido', shortcut: 'C' },
];
const QUALITIES: ChordQuality[] = [
  'major', 
  'minor', 
  'dominant7', 
  'major7', 
  'minor7', 
  'diminished', 
  'sus4'
];

export const CameraHUD: React.FC<CameraHUDProps> = ({ onOpenGuide, onOpenSettings, playMode }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modo Virtual de Contingência (Hardware Resilience & Fallback Playground)
  const [isVirtualMode, setIsVirtualMode] = useState(false);
  const [virtualBaseNote, setVirtualBaseNote] = useState<NaturalNote>('C');
  const [virtualAccidental, setVirtualAccidental] = useState<Accidental>('natural');
  const [virtualQuality, setVirtualQuality] = useState<ChordQuality>('major');
  const [virtualFilterVal, setVirtualFilterVal] = useState<number>(0.75);

  // Telemetria em tempo real (FPS, Latência Neural, Latência de Áudio, Filtro Moog)
  const [telemetry, setTelemetry] = useState({
    fps: 60,
    neuralLatencyMs: 0,
    audioLatencyMs: 10,
    filterCutoffHz: 8000,
  });
  const frameTimesRef = useRef<number[]>([]);
  const lastTelemetryUpdateRef = useRef<number>(0);

  // Estados musicais detectados
  const [currentRoot, setCurrentRoot] = useState<ChromaticNote>('C');
  const [currentQuality, setCurrentQuality] = useState<ChordQuality>('major');
  const [currentNotes, setCurrentNotes] = useState<string[]>(['C3', 'E3', 'G3']);
  const [lastStrumTriggered, setLastStrumTriggered] = useState(false);
  const [isHandsSustaining, setIsHandsSustaining] = useState(false);
  const isSustainingActive = playMode === 'sustain' && (isHandsSustaining || isVirtualMode);

  // Referência atualizada do modo de execução para uso dentro do requestAnimationFrame
  const playModeRef = useRef(playMode);
  useEffect(() => {
    playModeRef.current = playMode;
    if (playMode !== 'sustain') {
      soundEngine.stopSustainedChord();
    }
  }, [playMode]);

  // Efeito de onda visual ao palhetar
  const shockwaveRef = useRef<{ x: number; y: number; radius: number; alpha: number } | null>(null);

  // Inicia a webcam com tratamento de erros de hardware resiliente
  const startCamera = useCallback(async () => {
    try {
      setErrorMessage(null);
      await soundEngine.init();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setIsVirtualMode(false);
      }
    } catch (err: unknown) {
      console.error('Erro ao acessar webcam:', err);
      const error = err as { name?: string };
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Permissão da câmera negada no navegador. Habilite a câmera nas permissões da página ou use o Playground Virtual interativo abaixo!'
        );
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        setErrorMessage(
          'Nenhuma câmera foi detectada no seu dispositivo. Você pode tocar normalmente pelo Modo Playground Virtual abaixo!'
        );
      } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        setErrorMessage(
          'A câmera está sendo utilizada por outro aplicativo ou aba. Feche outros apps ou aproveite o Modo Playground Virtual!'
        );
      } else {
        setErrorMessage(
          'Não foi possível inicializar a webcam. Experimente o Modo Playground Virtual interativo abaixo.'
        );
      }
    }
  }, []);

  // Para a webcam
  const stopCamera = useCallback(() => {
    soundEngine.stopSustainedChord();
    setIsHandsSustaining(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  }, []);

  // Ativa o Playground Virtual (Sem Câmera)
  const startVirtualPlayground = useCallback(async () => {
    stopCamera();
    await soundEngine.init();
    setIsVirtualMode(true);
    setErrorMessage(null);

    const root = getChromaticNote(virtualBaseNote, virtualAccidental);
    const notes = getChordNotes(root, virtualQuality);
    setCurrentRoot(root);
    setCurrentQuality(virtualQuality);
    setCurrentNotes(notes);

    if (playModeRef.current === 'sustain') {
      soundEngine.setSustainedChord(notes);
      setIsHandsSustaining(true);
    }
  }, [stopCamera, virtualBaseNote, virtualAccidental, virtualQuality]);

  // Carrega o modelo de Visão Computacional
  useEffect(() => {
    async function load() {
      try {
        setModelLoading(true);
        await visionEngine.loadModel();
      } catch {
        setErrorMessage('Não foi possível carregar o modelo MediaPipe Hands via CDN.');
      } finally {
        setModelLoading(false);
      }
    }
    load();

    return () => {
      stopCamera();
      soundEngine.stopSustainedChord();
    };
  }, [stopCamera]);

  // Atualização de acordes no Modo Virtual
  useEffect(() => {
    if (!isVirtualMode) return;
    const root = getChromaticNote(virtualBaseNote, virtualAccidental);
    const notes = getChordNotes(root, virtualQuality);
    setCurrentRoot(root);
    setCurrentQuality(virtualQuality);
    setCurrentNotes(notes);

    if (playModeRef.current === 'sustain') {
      soundEngine.setSustainedChord(notes);
      setIsHandsSustaining(true);
    }
  }, [isVirtualMode, virtualBaseNote, virtualAccidental, virtualQuality]);

  // Disparo manual no Modo Virtual (Strum)
  const triggerVirtualStrum = useCallback(() => {
    soundEngine.strumChord(currentNotes);
    rhythmEngine.recordChord(currentNotes);
    setLastStrumTriggered(true);
    setTimeout(() => setLastStrumTriggered(false), 200);

    const canvas = canvasRef.current;
    if (canvas) {
      shockwaveRef.current = {
        x: 0.72 * canvas.width,
        y: 0.52 * canvas.height,
        radius: 12,
        alpha: 1,
      };
    }
  }, [currentNotes]);

  // Atalhos de teclado no Modo Virtual
  useEffect(() => {
    if (!isVirtualMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.key.toUpperCase();

      // Notas Naturais: 1 a 7
      if (['1', '2', '3', '4', '5', '6', '7'].includes(key)) {
        const noteIndex = Number(key) - 1;
        setVirtualBaseNote(NATURAL_NOTES[noteIndex]);
        return;
      }

      // Acidentes: Z, X, C
      if (key === 'Z') {
        setVirtualAccidental('flat');
        return;
      }
      if (key === 'X') {
        setVirtualAccidental('natural');
        return;
      }
      if (key === 'C') {
        setVirtualAccidental('sharp');
        return;
      }

      // Qualidades: Q, W, E, R, T, Y, U
      const qualityKeys: Record<string, ChordQuality> = {
        Q: 'major',
        W: 'minor',
        E: 'dominant7',
        R: 'major7',
        T: 'minor7',
        Y: 'diminished',
        U: 'sus4',
      };
      if (qualityKeys[key]) {
        setVirtualQuality(qualityKeys[key]);
        return;
      }

      // Barra de espaço para disparar palhetada ou pulsar sustain
      if (e.code === 'Space') {
        e.preventDefault();
        if (playModeRef.current === 'strum') {
          triggerVirtualStrum();
        } else {
          soundEngine.setSustainedChord(currentNotes);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVirtualMode, currentNotes, triggerVirtualStrum]);

  // Loop de detecção e renderização a 60 FPS com Telemetria e Visualizador FFT
  useEffect(() => {
    if (!cameraActive && !isVirtualMode) return;

    let animationId: number;

    const renderLoop = (time: number) => {
      const now = performance.now();
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // 1. Cálculo de FPS em janela deslizante de 1000ms
      frameTimesRef.current.push(now);
      while (frameTimesRef.current.length > 0 && frameTimesRef.current[0] < now - 1000) {
        frameTimesRef.current.shift();
      }
      const currentFps = frameTimesRef.current.length;

      // Modo Câmera Real
      if (cameraActive && video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // Limpa o canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Executa a visão computacional
          const detection: VisuChordDetectionResult | null = visionEngine.processVideoFrame(
            video,
            now
          );

          // Desenha guias de zona de altura para acidentes (# / natural / ♭)
          drawHeightZones(ctx, canvas.width, canvas.height);

          if (detection) {
            setCurrentRoot(detection.selectedRoot);
            setCurrentQuality(detection.selectedQuality);

            const notes = getChordNotes(detection.selectedRoot, detection.selectedQuality);
            setCurrentNotes(notes);

            // Modulação Expressiva Contínua: Altura da mão direita modula o filtro passa-baixas (Moog Cutoff)
            if (detection.rightHand) {
              const normHeight = 1 - Math.max(0.1, Math.min(0.9, detection.rightHand.handCenter.y));
              soundEngine.setFilterCutoff(normHeight);
            }

            // Desenha mãos no canvas
            if (detection.leftHand) {
              drawHandSkeleton(ctx, detection.leftHand.landmarks, canvas.width, canvas.height, '#06b6d4');
              const gInfo = AVAILABLE_GESTURES[detection.leftHand.detectedGesture];
              const gName = gInfo ? ` [${gInfo.emoji} ${gInfo.name}]` : '';
              drawHandLabel(
                ctx, 
                detection.leftHand.handCenter, 
                canvas.width, 
                canvas.height, 
                `Tônica: ${formatNoteName(detection.selectedRoot)} (${detection.selectedAccidental})${gName}`,
                '#06b6d4'
              );
            }

            if (detection.rightHand) {
              drawHandSkeleton(ctx, detection.rightHand.landmarks, canvas.width, canvas.height, '#c084fc');
              const gInfo = AVAILABLE_GESTURES[detection.rightHand.detectedGesture];
              const gName = gInfo ? ` [${gInfo.emoji} ${gInfo.name}]` : '';
              drawHandLabel(
                ctx, 
                detection.rightHand.handCenter, 
                canvas.width, 
                canvas.height, 
                `Qualidade: ${CHORD_QUALITIES[detection.selectedQuality].label}${gName}`,
                '#c084fc'
              );

              // Execução do Áudio (Sustentação vs Palhetada)
              if (playModeRef.current === 'sustain') {
                const canSustain = Boolean(detection.leftHand && detection.rightHand);
                if (canSustain) {
                  soundEngine.setSustainedChord(notes);
                } else {
                  soundEngine.stopSustainedChord();
                }
                setIsHandsSustaining((prev) => (prev !== canSustain ? canSustain : prev));
              } else {
                setIsHandsSustaining((prev) => (prev ? false : prev));
                if (detection.shouldTriggerStrum) {
                  soundEngine.strumChord(notes);
                  rhythmEngine.recordChord(notes);
                  setLastStrumTriggered(true);
                  setTimeout(() => setLastStrumTriggered(false), 200);

                  // Dispara efeito visual de onda de choque
                  shockwaveRef.current = {
                    x: detection.rightHand.handCenter.x * canvas.width,
                    y: detection.rightHand.handCenter.y * canvas.height,
                    radius: 10,
                    alpha: 1,
                  };
                }
              }
            }
          } else {
            if (playModeRef.current === 'sustain') {
              soundEngine.stopSustainedChord();
              setIsHandsSustaining((prev) => (prev ? false : prev));
            }
          }

          // Onda de choque visual
          if (shockwaveRef.current) {
            drawShockwave(ctx, shockwaveRef.current);
            shockwaveRef.current.radius += 12;
            shockwaveRef.current.alpha -= 0.05;
            if (shockwaveRef.current.alpha <= 0) {
              shockwaveRef.current = null;
            }
          }

          // Visualizador FFT / Osciloscópio de Som
          const wave = soundEngine.getWaveformData();
          drawOscilloscope(ctx, wave, canvas.width, canvas.height);

          // Atualização de telemetria throttled (a cada 400ms para manter 60 FPS)
          if (now - lastTelemetryUpdateRef.current > 400) {
            lastTelemetryUpdateRef.current = now;
            setTelemetry({
              fps: currentFps,
              neuralLatencyMs: detection?.inferenceTimeMs || visionEngine.getLastInferenceTime(),
              audioLatencyMs: soundEngine.getAudioLatency(),
              filterCutoffHz: soundEngine.getFilterCutoff(),
            });
          }
        }
      }

      // Modo Playground Virtual (Sem Câmera)
      else if (isVirtualMode && canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (canvas.width !== 1280 || canvas.height !== 720) {
            canvas.width = 1280;
            canvas.height = 720;
          }

          // Limpa o canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Fundo holográfico de grade cibernética
          ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Linhas de grade
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
          ctx.lineWidth = 1;
          for (let x = 0; x < canvas.width; x += 80) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }
          for (let y = 0; y < canvas.height; y += 60) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
          }

          // Zonas de altura
          drawHeightZones(ctx, canvas.width, canvas.height);

          // Configuração de gestos ativa
          const gestureConfig = visionEngine.getGestureConfig();
          const leftGesture: GestureId = gestureConfig.leftHandNotes[virtualBaseNote] || 'one_finger';
          const rightGesture: GestureId = gestureConfig.rightHandQualities[virtualQuality] || 'five_fingers';

          // Animação sutil de flutuação senoidal
          const floatOffset = Math.sin(time / 400) * 0.015;
          const leftY = (virtualAccidental === 'sharp' ? 0.30 : virtualAccidental === 'flat' ? 0.70 : 0.50) + floatOffset;
          const rightY = 0.50 + Math.cos(time / 400) * 0.015;

          // Gera landmarks sintéticos
          const leftLandmarks = generateSimulatedHandLandmarks(leftGesture, 'Left', 0.28, leftY);
          const rightLandmarks = generateSimulatedHandLandmarks(rightGesture, 'Right', 0.72, rightY);

          // Renderiza esqueleto da mão esquerda (Ciano)
          drawHandSkeleton(ctx, leftLandmarks, canvas.width, canvas.height, '#06b6d4');
          const leftInfo = AVAILABLE_GESTURES[leftGesture];
          drawHandLabel(
            ctx,
            { x: 0.28, y: leftY },
            canvas.width,
            canvas.height,
            `Tônica: ${formatNoteName(currentRoot)} (${virtualAccidental}) [${leftInfo?.emoji || ''} ${leftInfo?.name || ''}]`,
            '#06b6d4'
          );

          // Renderiza esqueleto da mão direita (Púrpura)
          drawHandSkeleton(ctx, rightLandmarks, canvas.width, canvas.height, '#c084fc');
          const rightInfo = AVAILABLE_GESTURES[rightGesture];
          drawHandLabel(
            ctx,
            { x: 0.72, y: rightY },
            canvas.width,
            canvas.height,
            `Qualidade: ${CHORD_QUALITIES[virtualQuality].label} [${rightInfo?.emoji || ''} ${rightInfo?.name || ''}]`,
            '#c084fc'
          );

          // Onda de choque
          if (shockwaveRef.current) {
            drawShockwave(ctx, shockwaveRef.current);
            shockwaveRef.current.radius += 12;
            shockwaveRef.current.alpha -= 0.05;
            if (shockwaveRef.current.alpha <= 0) {
              shockwaveRef.current = null;
            }
          }

          // Visualizador FFT / Osciloscópio de Som
          const wave = soundEngine.getWaveformData();
          drawOscilloscope(ctx, wave, canvas.width, canvas.height);

          // Telemetria virtual
          if (now - lastTelemetryUpdateRef.current > 400) {
            lastTelemetryUpdateRef.current = now;
            setTelemetry({
              fps: currentFps,
              neuralLatencyMs: 0.2,
              audioLatencyMs: soundEngine.getAudioLatency(),
              filterCutoffHz: soundEngine.getFilterCutoff(),
            });
          }
        }
      }

      animationId = requestAnimationFrame(renderLoop);
    };

    animationId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationId);
  }, [cameraActive, isVirtualMode, currentRoot, virtualAccidental, virtualQuality, virtualBaseNote]);

  const chordFullName = getChordFullName(currentRoot, currentQuality);

  return (
    <div className="relative w-full max-w-5xl mx-auto flex flex-col items-center gap-5">
      {/* Banner de Erro Resiliente com Atalho para Playground Virtual */}
      {errorMessage && (
        <div className="w-full bg-rose-500/15 border border-rose-500/40 text-rose-200 px-5 py-3.5 rounded-2xl text-sm flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
            <span>{errorMessage}</span>
          </div>
          {!isVirtualMode && (
            <button
              onClick={startVirtualPlayground}
              className="px-4 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              Ativar Playground Virtual
            </button>
          )}
        </div>
      )}

      {/* Janela de Vídeo + HUD */}
      <div className="relative w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl group">
        {/* Vídeo da Webcam */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
            cameraActive ? 'opacity-90' : 'opacity-0'
          }`}
        />

        {/* Canvas Holográfico de Detecção */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Monitor de Telemetria e Desempenho em Tempo Real */}
        {(cameraActive || isVirtualMode) && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] font-mono select-none shadow-xl">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                telemetry.fps >= 50 
                  ? 'bg-emerald-400 animate-pulse' 
                  : telemetry.fps >= 30 
                  ? 'bg-amber-400' 
                  : 'bg-rose-400'
              }`} />
              <span className="font-bold text-white tracking-wide">{telemetry.fps}</span>
              <span className="text-slate-400 text-[10px]">FPS</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span className="text-slate-500">IA:</span>
              <span className="text-cyan-300 font-semibold">{telemetry.neuralLatencyMs.toFixed(1)}ms</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-500">Áudio:</span>
              <span className="text-purple-300 font-semibold">{telemetry.audioLatencyMs.toFixed(1)}ms</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span className="text-slate-500">Filtro:</span>
              <span className="text-cyan-300 font-semibold">{(telemetry.filterCutoffHz / 1000).toFixed(1)}k</span>
            </div>
            {isVirtualMode && (
              <>
                <span className="text-slate-700">|</span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold uppercase tracking-wider">
                  VIRTUAL
                </span>
              </>
            )}
          </div>
        )}

        {/* HUD de Acorde Atual (Holograma Central) */}
        {(cameraActive || isVirtualMode) && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all z-20">
            <div className={`px-6 py-2 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-150 ${
              lastStrumTriggered
                ? 'bg-purple-600/60 border-purple-300 scale-110 shadow-[0_0_30px_rgba(192,132,252,0.8)]'
                : isSustainingActive
                ? 'bg-cyan-600/50 border-cyan-300 scale-105 shadow-[0_0_35px_rgba(6,182,212,0.7)]'
                : 'bg-slate-900/75 border-slate-700/80 shadow-cyan-500/10'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight bg-gradient-to-r from-cyan-300 via-white to-purple-300 bg-clip-text text-transparent">
                  {chordFullName}
                </span>
                {isSustainingActive && (
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs font-mono tracking-widest text-cyan-300/90 uppercase font-semibold bg-slate-950/80 px-3 py-1 rounded-full border border-cyan-500/20 shadow-sm m-0">
                {CHORD_QUALITIES[currentQuality].description}
              </p>
              <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                playMode === 'sustain'
                  ? isSustainingActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
              }`}>
                {playMode === 'sustain'
                  ? (isSustainingActive ? '● Sustentando' : 'Modo Sustain')
                  : 'Modo Palhetada'}
              </span>
            </div>
          </div>
        )}

        {/* Botão de Iniciar quando a Câmera e o Playground estiverem Desligados */}
        {!cameraActive && !isVirtualMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6 text-center z-10">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-2xl shadow-cyan-500/30 mb-6">
              <Camera className="w-10 h-10" />
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
              Pronto para criar música no ar?
            </h3>
            <p className="text-sm text-slate-400 max-w-md mb-8">
              Ative sua webcam para que o MediaPipe rastreie os movimentos das suas mãos ou experimente o Playground Virtual sem câmera.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={startCamera}
                disabled={modelLoading}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-base shadow-xl shadow-cyan-500/25 transition-all flex items-center gap-2.5 disabled:opacity-50 hover:scale-105"
              >
                <Sparkles className="w-5 h-5" />
                {modelLoading ? 'Carregando IA...' : 'Ativar Câmera & Áudio'}
              </button>

              <button
                onClick={startVirtualPlayground}
                className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-cyan-300 font-semibold text-sm border border-cyan-500/30 hover:border-cyan-500/50 shadow-lg shadow-cyan-500/10 transition-all flex items-center gap-2"
                title="Tocar sem câmera utilizando atalhos e simulação visual"
              >
                <Play className="w-4 h-4 text-cyan-400" />
                Playground Virtual (Sem Câmera)
              </button>

              <button
                onClick={onOpenGuide}
                className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all flex items-center gap-2"
              >
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                Guia de Gestos
              </button>

              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="px-6 py-3.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-semibold text-sm border border-cyan-500/30 transition-all flex items-center gap-2"
                >
                  <Settings2 className="w-4 h-4 text-cyan-400" />
                  Mapeamentos
                </button>
              )}
            </div>
          </div>
        )}

        {/* Botões Flutuantes de Ação no Canto Inferior Direito */}
        {(cameraActive || isVirtualMode) && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 z-20">
            <button
              onClick={() => {
                if (playMode === 'sustain') {
                  soundEngine.setSustainedChord(currentNotes);
                  setIsHandsSustaining(true);
                } else {
                  triggerVirtualStrum();
                }
              }}
              className="px-4 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white font-bold text-xs backdrop-blur-md transition-all shadow-lg flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" />
              {playMode === 'sustain' ? 'Pulsar Sustain' : 'Palhetar (Espaço)'}
            </button>

            {isVirtualMode && (
              <button
                onClick={startCamera}
                className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
                title="Tentar inicializar a webcam"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Usar Câmera
              </button>
            )}

            <button
              onClick={() => {
                if (cameraActive) stopCamera();
                if (isVirtualMode) {
                  soundEngine.stopSustainedChord();
                  setIsVirtualMode(false);
                }
              }}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-red-500 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition-all"
              title={cameraActive ? 'Desativar câmera' : 'Sair da simulação'}
            >
              <CameraOff className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Controles Interativos Exclusivos do Playground Virtual */}
      {isVirtualMode && (
        <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h4 className="text-sm font-bold text-white tracking-wide">
                Controles do Playground Virtual
              </h4>
              <span className="text-[10px] text-slate-400">
                (Use os botões na tela ou os atalhos do teclado)
              </span>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-semibold bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
              Espaço: {playMode === 'strum' ? 'Palhetar' : 'Sustentar'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Seletor de Tônica (1 a 7) */}
            <div>
              <span className="text-xs font-semibold text-slate-400 mb-1.5 block">
                1. Tônica (1 - 7):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {NATURAL_NOTES.map((note, idx) => (
                  <button
                    key={note}
                    onClick={() => setVirtualBaseNote(note)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      virtualBaseNote === note
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {note} <span className="opacity-60 text-[10px]">({idx + 1})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seletor de Acidente (Z, X, C) */}
            <div>
              <span className="text-xs font-semibold text-slate-400 mb-1.5 block">
                2. Acidente (Z, X, C):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ACCIDENTALS.map((acc) => (
                  <button
                    key={acc.value}
                    onClick={() => setVirtualAccidental(acc.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      virtualAccidental === acc.value
                        ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {acc.label} <span className="opacity-60 text-[10px]">({acc.shortcut})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seletor de Qualidade (Q a U) */}
            <div>
              <span className="text-xs font-semibold text-slate-400 mb-1.5 block">
                3. Qualidade do Acorde:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUALITIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => setVirtualQuality(q)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      virtualQuality === q
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {CHORD_QUALITIES[q].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modulação Expressiva (Filtro Moog Cutoff) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-400 block">
                  4. Filtro Moog:
                </span>
                <span className="text-[11px] font-mono text-cyan-400 font-bold">
                  {(soundEngine.getFilterCutoff() / 1000).toFixed(1)} kHz
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={virtualFilterVal}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setVirtualFilterVal(val);
                  soundEngine.setFilterCutoff(val);
                }}
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Na câmera, mova a mão direita para cima/baixo para modular o filtro no ar!
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Teclado Virtual Polifônico */}
      <VirtualPiano activeNotes={currentNotes} />
    </div>
  );
};
