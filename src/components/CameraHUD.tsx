import React, { useRef, useEffect, useState, useCallback } from 'react';
import { visionEngine, type VisuChordDetectionResult } from '../lib/visionEngine';
import { soundEngine } from '../lib/soundEngine';
import { 
  getChordNotes, 
  getChordFullName, 
  type ChromaticNote, 
  type ChordQuality,
  formatNoteName,
  CHORD_QUALITIES
} from '../lib/musicTheory';
import { AVAILABLE_GESTURES } from '../lib/gestureConfig';
import { VirtualPiano } from './VirtualPiano';
import { Sparkles, Camera, CameraOff, Volume2, HelpCircle, Settings2 } from 'lucide-react';
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

export const CameraHUD: React.FC<CameraHUDProps> = ({ onOpenGuide, onOpenSettings, playMode }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados musicais detectados
  const [currentRoot, setCurrentRoot] = useState<ChromaticNote>('C');
  const [currentQuality, setCurrentQuality] = useState<ChordQuality>('major');
  const [currentNotes, setCurrentNotes] = useState<string[]>(['C3', 'E3', 'G3']);
  const [lastStrumTriggered, setLastStrumTriggered] = useState(false);
  const [isHandsSustaining, setIsHandsSustaining] = useState(false);
  const isSustainingActive = playMode === 'sustain' && isHandsSustaining;

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

  // Inicia a webcam
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
      }
    } catch (err) {
      console.error('Erro ao acessar webcam:', err);
      setErrorMessage(
        'Permissão da webcam negada ou câmera ocupada por outro aplicativo. Por favor, libere o acesso.'
      );
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

  // Carrega o modelo de Visão Computacional
  useEffect(() => {
    async function load() {
      try {
        setModelLoading(true);
        await visionEngine.loadModel();
      } catch {
        setErrorMessage('Não foi possível carregar o modelo MediaPipe Hands.');
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

  // Loop de detecção e renderização a 60 FPS
  useEffect(() => {
    if (!cameraActive) return;

    let animationId: number;

    const renderLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // 1. Limpa o canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // 2. Executa a visão computacional
          const detection: VisuChordDetectionResult | null = visionEngine.processVideoFrame(
            video,
            performance.now()
          );

          // 3. Desenha guias de zona de altura para acidentes (# / natural / ♭)
          drawHeightZones(ctx, canvas.width, canvas.height);

          if (detection) {
            setCurrentRoot(detection.selectedRoot);
            setCurrentQuality(detection.selectedQuality);

            const notes = getChordNotes(detection.selectedRoot, detection.selectedQuality);
            setCurrentNotes(notes);

            // 4. Desenha as mãos no canvas
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

              // 5. Execução do Áudio (Sustentação vs Palhetada)
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

          // 6. Desenha a onda de choque visual caso ativa
          if (shockwaveRef.current) {
            drawShockwave(ctx, shockwaveRef.current);
            shockwaveRef.current.radius += 12;
            shockwaveRef.current.alpha -= 0.05;
            if (shockwaveRef.current.alpha <= 0) {
              shockwaveRef.current = null;
            }
          }
        }
      }

      animationId = requestAnimationFrame(renderLoop);
    };

    animationId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationId);
  }, [cameraActive]);

  const chordFullName = getChordFullName(currentRoot, currentQuality);

  return (
    <div className="relative w-full max-w-5xl mx-auto flex flex-col items-center gap-5">
      {/* Banner de Erro caso ocorra */}
      {errorMessage && (
        <div className="w-full bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm text-center">
          {errorMessage}
        </div>
      )}

      {/* Janela de Vídeo + HUD */}
      <div className="relative w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl group">
        {/* Vídeo da Webcam */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${cameraActive ? 'opacity-90' : 'opacity-0'}`}
        />

        {/* Canvas Holográfico de Detecção (Não espelhado no DOM para manter o texto legível) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* HUD de Acorde Atual (Holograma Central) */}
        {cameraActive && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all">
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

        {/* Botão de Iniciar quando a Câmera estiver Desligada */}
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-2xl shadow-cyan-500/30 mb-6">
              <Camera className="w-10 h-10" />
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
              Pronto para criar música no ar?
            </h3>
            <p className="text-sm text-slate-400 max-w-md mb-8">
              Ative sua webcam para que o MediaPipe rastreie os movimentos das suas mãos e gere acordes em tempo real.
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
                  Personalizar Posições
                </button>
              )}
            </div>
          </div>
        )}

        {/* Botão de Pausar / Parar Câmera no Canto */}
        {cameraActive && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <button
              onClick={() => {
                if (playMode === 'sustain') {
                  soundEngine.setSustainedChord(currentNotes);
                  setIsHandsSustaining(true);
                } else {
                  soundEngine.strumChord(currentNotes);
                }
              }}
              className="px-4 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white font-bold text-xs backdrop-blur-md transition-all shadow-lg flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" />
              {playMode === 'sustain' ? 'Testar Sustain' : 'Tocar Acorde'}
            </button>
            <button
              onClick={stopCamera}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-red-500 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition-all"
              title="Desativar câmera"
            >
              <CameraOff className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Teclado Virtual Polifônico */}
      <VirtualPiano activeNotes={currentNotes} />
    </div>
  );
};
