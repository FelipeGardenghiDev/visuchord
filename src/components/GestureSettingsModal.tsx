import React, { useState } from 'react';
import { 
  X, 
  Settings2, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  Hand, 
  Music2, 
  Sparkles 
} from 'lucide-react';
import { 
  AVAILABLE_GESTURES, 
  DEFAULT_GESTURE_CONFIG, 
  type GestureId, 
  type GestureMappingConfig 
} from '../lib/gestureConfig';
import { 
  NATURAL_NOTES, 
  CHORD_QUALITIES, 
  type NaturalNote, 
  type ChordQuality 
} from '../lib/musicTheory';

interface GestureSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GestureMappingConfig;
  onSaveConfig: (newConfig: GestureMappingConfig) => void;
}

const NOTE_NAMES_PT: Record<NaturalNote, string> = {
  C: 'Dó (C)',
  D: 'Ré (D)',
  E: 'Mi (E)',
  F: 'Fá (F)',
  G: 'Sol (G)',
  A: 'Lá (A)',
  B: 'Si (B)',
};

export const GestureSettingsModal: React.FC<GestureSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'left' | 'right'>('left');
  const [tempConfig, setTempConfig] = useState<GestureMappingConfig>(config);
  const [hasSavedFeedback, setHasSavedFeedback] = useState(false);

  if (!isOpen) return null;

  const handleLeftNoteChange = (note: NaturalNote, gesture: GestureId) => {
    setTempConfig((prev) => ({
      ...prev,
      leftHandNotes: {
        ...prev.leftHandNotes,
        [note]: gesture,
      },
    }));
  };

  const handleRightQualityChange = (quality: ChordQuality, gesture: GestureId) => {
    setTempConfig((prev) => ({
      ...prev,
      rightHandQualities: {
        ...prev.rightHandQualities,
        [quality]: gesture,
      },
    }));
  };

  const handleReset = () => {
    setTempConfig(DEFAULT_GESTURE_CONFIG);
  };

  const handleSave = () => {
    onSaveConfig(tempConfig);
    setHasSavedFeedback(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  // Contagem de duplicados para alertar conflitos
  const leftGestureCounts = Object.values(tempConfig.leftHandNotes).reduce<Record<string, number>>((acc, g) => {
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  const rightGestureCounts = Object.values(tempConfig.rightHandQualities).reduce<Record<string, number>>((acc, g) => {
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700/90 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Personalizar Posições das Mãos
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Custom Mappings
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Escolha qual gesto da mão aciona cada nota musical ou qualidade de acorde.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-800 bg-slate-950/20 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('left')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all ${
              activeTab === 'left'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hand className="w-4 h-4" />
            <span>Mão Esquerda (Tônica / Notas)</span>
          </button>
          <button
            onClick={() => setActiveTab('right')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all ${
              activeTab === 'right'
                ? 'border-purple-400 text-purple-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music2 className="w-4 h-4" />
            <span>Mão Direita (Qualidades de Acordes)</span>
          </button>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'left' ? (
            <div>
              <div className="p-3 mb-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" />
                <span>
                  A mão esquerda controla a nota base. Por padrão, <strong>Si (B)</strong> usa o punho fechado ✊. Se achar mais fácil, você pode trocar por <strong>Hang Loose 🤙</strong>, <strong>Polegar para Cima 👍</strong> ou qualquer outro gesto!
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {NATURAL_NOTES.map((note) => {
                  const currentGesture = tempConfig.leftHandNotes[note];
                  const isDuplicated = (leftGestureCounts[currentGesture] || 0) > 1;

                  return (
                    <div 
                      key={note}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 font-mono font-black text-cyan-400 flex items-center justify-center text-base">
                          {note}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-slate-200">
                            {NOTE_NAMES_PT[note]}
                          </div>
                          {isDuplicated && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-400">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Gesto repetido</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <select
                        value={currentGesture}
                        onChange={(e) => handleLeftNoteChange(note, e.target.value as GestureId)}
                        className="bg-slate-900 border border-slate-700 text-xs font-semibold text-white rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-cyan-400 hover:border-slate-600 transition-colors max-w-[170px]"
                      >
                        {Object.values(AVAILABLE_GESTURES).map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.emoji} {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="p-3 mb-4 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-purple-400" />
                <span>
                  A mão direita determina se o acorde é Maior, Menor, Sétima, Diminuto, etc. Associe cada acorde ao gesto que você achar mais intuitivo e anatômico!
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(CHORD_QUALITIES) as ChordQuality[]).map((quality) => {
                  const chordDef = CHORD_QUALITIES[quality];
                  const currentGesture = tempConfig.rightHandQualities[quality];
                  const isDuplicated = (rightGestureCounts[currentGesture] || 0) > 1;

                  return (
                    <div 
                      key={quality}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 font-mono font-bold text-purple-400 flex items-center justify-center text-xs text-center px-1">
                          {chordDef.symbol || 'Maj'}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-slate-200">
                            {chordDef.label}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            {chordDef.description}
                          </div>
                          {isDuplicated && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-400 mt-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Gesto repetido</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <select
                        value={currentGesture}
                        onChange={(e) => handleRightQualityChange(quality, e.target.value as GestureId)}
                        className="bg-slate-900 border border-slate-700 text-xs font-semibold text-white rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-purple-400 hover:border-slate-600 transition-colors max-w-[170px]"
                      >
                        {Object.values(AVAILABLE_GESTURES).map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.emoji} {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Ações */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
            >
              {hasSavedFeedback ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Salvo!</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar Mapeamento</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
