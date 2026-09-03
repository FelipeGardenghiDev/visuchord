import React, { useState } from 'react';
import { soundEngine, type InstrumentPreset } from '../lib/soundEngine';
import { Volume2, VolumeX, HelpCircle, Music, Zap, Waves } from 'lucide-react';

export type PlayMode = 'strum' | 'sustain';

interface ControlsHeaderProps {
  onOpenGuide: () => void;
  playMode: PlayMode;
  onPlayModeChange: (mode: PlayMode) => void;
}

export const ControlsHeader: React.FC<ControlsHeaderProps> = ({ 
  onOpenGuide,
  playMode,
  onPlayModeChange,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<InstrumentPreset>('warmPad');
  const [volume, setVolume] = useState(-6);
  const [isMuted, setIsMuted] = useState(false);

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

  return (
    <header className="w-full max-w-5xl mx-auto py-6 px-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/80 mb-6">
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
              AI Vision &amp; Synth
            </span>
          </div>
          <p className="text-xs text-slate-400 m-0">
            Harmonia musical controlada por gestos da webcam via Google MediaPipe
          </p>
        </div>
      </div>

      {/* Controles de Som & Preset */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Seletor de Modo: Palhetada vs Sustentação */}
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
            Synth Lead
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
            className="w-16 sm:w-20 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        {/* Botão de Ajuda de Gestos */}
        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all shadow-sm"
        >
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
          <span>Gestos</span>
        </button>
      </div>
    </header>
  );
};
