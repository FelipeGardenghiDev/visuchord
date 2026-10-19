import React, { useState, useEffect } from 'react';
import { soundEngine, type InstrumentPreset } from '../lib/soundEngine';
import { rhythmEngine, type RhythmPattern } from '../lib/rhythmEngine';
import { midiEngine } from '../lib/midiEngine';
import { 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  Music, 
  Zap, 
  Waves, 
  Settings2, 
  Circle,
  Repeat,
  Radio,
  Drum,
  Sliders
} from 'lucide-react';

export type PlayMode = 'strum' | 'sustain';

interface ControlsHeaderProps {
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  playMode: PlayMode;
  onPlayModeChange: (mode: PlayMode) => void;
}

export const ControlsHeader: React.FC<ControlsHeaderProps> = ({ 
  onOpenGuide,
  onOpenSettings,
  playMode,
  onPlayModeChange,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<InstrumentPreset>('warmPad');
  const [volume, setVolume] = useState(-6);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Estados de Ritmo, Looper & Web MIDI
  const [rhythmPattern, setRhythmPattern] = useState<RhythmPattern>('off');
  const [bpm, setBpm] = useState<number>(100);
  const [isLoopRecording, setIsLoopRecording] = useState(false);
  const [isLoopPlaying, setIsLoopPlaying] = useState(false);
  const [midiReady, setMidiReady] = useState(false);

  // Inicializa Web MIDI e checa suporte
  useEffect(() => {
    async function setupMidi() {
      const ready = await midiEngine.init();
      setMidiReady(ready);
    }
    setupMidi();
  }, []);

  // Timer de gravação de áudio master
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleToggleRecord = async () => {
    if (!isRecording) {
      const started = await soundEngine.startRecording();
      if (started) {
        setIsRecording(true);
      }
    } else {
      const blob = await soundEngine.stopRecording();
      setIsRecording(false);
      if (blob && blob.size > 0) {
        soundEngine.downloadRecording(blob);
      }
    }
  };

  const formatRecordTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handlePresetChange = (preset: InstrumentPreset) => {
    setSelectedPreset(preset);
    soundEngine.applyPreset(preset);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (!isMuted) soundEngine.setVolume(val);
  };

  const toggleMute = () => {
    if (isMuted) {
      soundEngine.setVolume(volume);
      setIsMuted(false);
    } else {
      soundEngine.setVolume(-100);
      setIsMuted(true);
    }
  };

  // Controle de Ritmo
  const handleRhythmChange = (pattern: RhythmPattern) => {
    setRhythmPattern(pattern);
    rhythmEngine.start(pattern);
  };

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setBpm(val);
    rhythmEngine.setBpm(val);
  };

  // Controle do Looper de progressão
  const handleToggleLoopRecord = () => {
    if (!isLoopRecording) {
      rhythmEngine.startLoopRecording();
      setIsLoopRecording(true);
      setIsLoopPlaying(false);
    } else {
      rhythmEngine.stopLoopRecordingAndPlay();
      setIsLoopRecording(false);
      setIsLoopPlaying(true);
    }
  };

  const handleStopLoop = () => {
    rhythmEngine.stopLoop();
    setIsLoopRecording(false);
    setIsLoopPlaying(false);
  };

  return (
    <header className="w-full max-w-5xl mx-auto py-5 px-4 flex flex-col gap-4 border-b border-slate-800/80 mb-6">
      {/* Linha Superior: Brand, Status MIDI & Controles Primários */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Título */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white m-0">
                Visu<span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Chord</span>
              </h1>
              <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                AI Synth &amp; DAW Controller
              </span>
              {midiReady && (
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1" title="Controlador MIDI ativo para Ableton, FL Studio, Logic, Reaper">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  Web MIDI
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 m-0">
              Harmonia musical e controle MIDI sem fio via gestos da webcam no navegador
            </p>
          </div>
        </div>

        {/* Controles de Modo & Timbre */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Modo: Palhetada vs Sustentação */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => onPlayModeChange('strum')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                playMode === 'strum'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Dispara o acorde ao fazer um movimento rápido de descida com a mão direita"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Palhetada</span>
            </button>
            <button
              onClick={() => onPlayModeChange('sustain')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                playMode === 'sustain'
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Sustenta o acorde continuamente enquanto as mãos estiverem visíveis"
            >
              <Waves className="w-3.5 h-3.5" />
              <span>Sustentação</span>
            </button>
          </div>

          {/* Seletor de Timbre */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => handlePresetChange('warmPad')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedPreset === 'warmPad'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Warm Pad
            </button>
            <button
              onClick={() => handlePresetChange('electricPiano')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedPreset === 'electricPiano'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Piano Elétrico
            </button>
            <button
              onClick={() => handlePresetChange('ambientGuitar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedPreset === 'ambientGuitar'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Violão
            </button>
            <button
              onClick={() => handlePresetChange('synthLead')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedPreset === 'synthLead'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Lead
            </button>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-white transition-colors"
              title={isMuted ? 'Desmutar' : 'Mutar'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="-30"
              max="0"
              step="1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-16 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Gravação de Áudio */}
          <button
            onClick={handleToggleRecord}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
              isRecording
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
            title={isRecording ? 'Parar e baixar gravação (WAV/WebM)' : 'Gravar fluxo de áudio estéreo'}
          >
            <Circle className={`w-3.5 h-3.5 ${isRecording ? 'fill-rose-500 text-rose-500' : 'text-rose-400'}`} />
            <span>{isRecording ? `REC ${formatRecordTime(recordSeconds)}` : 'Gravar'}</span>
          </button>

          {/* Personalizar Mapeamento */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold text-cyan-300 transition-all shadow-sm"
            title="Personalizar quais gestos ativam cada nota e acorde"
          >
            <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Mapear</span>
          </button>

          {/* Guia */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all shadow-sm"
            title="Ver o guia de gestos e mecânica musical"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Guia</span>
          </button>
        </div>
      </div>

      {/* Linha Secundária: Metrônomo, Bateria Eletrônica & Looper Harmônico */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/50 text-xs">
        {/* Padrões Rítmicos */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-slate-400 font-medium">
            <Drum className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ritmo:</span>
          </div>
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => handleRhythmChange('off')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                rhythmPattern === 'off' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Desligado
            </button>
            <button
              onClick={() => handleRhythmChange('metronome')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                rhythmPattern === 'metronome' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              Metrônomo
            </button>
            <button
              onClick={() => handleRhythmChange('lofi')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                rhythmPattern === 'lofi' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              Lo-Fi Beat
            </button>
            <button
              onClick={() => handleRhythmChange('pulse')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                rhythmPattern === 'pulse' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pulse
            </button>
          </div>

          {/* Slider de BPM */}
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1">
            <Sliders className="w-3 h-3 text-slate-400" />
            <span className="font-mono text-cyan-400 font-bold">{bpm}</span>
            <span className="text-[10px] text-slate-400">BPM</span>
            <input
              type="range"
              min="60"
              max="180"
              value={bpm}
              onChange={handleBpmChange}
              className="w-14 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>

        {/* Looper Harmônico */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Repeat className="w-3.5 h-3.5 text-purple-400" />
            Looper:
          </span>

          <button
            onClick={handleToggleLoopRecord}
            className={`px-3 py-1 rounded-xl border font-semibold transition-all flex items-center gap-1.5 ${
              isLoopRecording
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Grava os acordes tocados para criar um loop contínuo de 4 compassos"
          >
            <Circle className={`w-3 h-3 ${isLoopRecording ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
            <span>{isLoopRecording ? 'Gravando Loop...' : 'Gravar Loop'}</span>
          </button>

          {isLoopPlaying && (
            <button
              onClick={handleStopLoop}
              className="px-2.5 py-1 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-semibold transition-all hover:bg-purple-500/30 flex items-center gap-1"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Loop Ativo (Parar)</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
