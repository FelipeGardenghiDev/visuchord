import React from 'react';

interface VirtualPianoProps {
  activeNotes: string[];
}

const PIANO_KEYS = [
  { note: 'C3', isBlack: false, label: 'C' },
  { note: 'C#3', isBlack: true, label: 'C#' },
  { note: 'D3', isBlack: false, label: 'D' },
  { note: 'D#3', isBlack: true, label: 'D#' },
  { note: 'E3', isBlack: false, label: 'E' },
  { note: 'F3', isBlack: false, label: 'F' },
  { note: 'F#3', isBlack: true, label: 'F#' },
  { note: 'G3', isBlack: false, label: 'G' },
  { note: 'G#3', isBlack: true, label: 'G#' },
  { note: 'A3', isBlack: false, label: 'A' },
  { note: 'A#3', isBlack: true, label: 'A#' },
  { note: 'B3', isBlack: false, label: 'B' },
  { note: 'C4', isBlack: false, label: 'C' },
  { note: 'C#4', isBlack: true, label: 'C#' },
  { note: 'D4', isBlack: false, label: 'D' },
  { note: 'D#4', isBlack: true, label: 'D#' },
  { note: 'E4', isBlack: false, label: 'E' },
  { note: 'F4', isBlack: false, label: 'F' },
  { note: 'F#4', isBlack: true, label: 'F#' },
  { note: 'G4', isBlack: false, label: 'G' },
  { note: 'G#4', isBlack: true, label: 'G#' },
  { note: 'A4', isBlack: false, label: 'A' },
  { note: 'A#4', isBlack: true, label: 'A#' },
  { note: 'B4', isBlack: false, label: 'B' },
];

export const VirtualPiano: React.FC<VirtualPianoProps> = ({ activeNotes }) => {
  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-slate-700/60 shadow-2xl">
      <div className="flex items-center justify-between px-2 mb-2 text-xs font-semibold text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          Teclado Polifônico em Tempo Real
        </span>
        <span className="font-mono text-cyan-300">
          {activeNotes.length > 0 ? activeNotes.join(' - ') : 'Nenhuma nota ativa'}
        </span>
      </div>

      <div className="relative flex justify-center h-28 bg-slate-950 rounded-xl p-1.5 overflow-hidden shadow-inner border border-slate-800">
        {PIANO_KEYS.map((k) => {
          const isActive = activeNotes.some(
            (active) => active.replace(/[0-9]/g, '') === k.note.replace(/[0-9]/g, '')
          );

          if (k.isBlack) {
            return (
              <div
                key={k.note}
                className={`w-5 h-16 -mx-2.5 z-10 rounded-b-md transition-all duration-150 flex items-end justify-center pb-1 ${
                  isActive
                    ? 'bg-gradient-to-b from-cyan-500 to-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.8)] scale-95'
                    : 'bg-slate-900 hover:bg-slate-800 border-x border-b border-black'
                }`}
              >
                <span className={`text-[9px] font-mono ${isActive ? 'text-black font-bold' : 'text-slate-500'}`}>
                  {k.label}
                </span>
              </div>
            );
          }

          return (
            <div
              key={k.note}
              className={`w-8 h-24 rounded-b-lg border-r border-slate-200/20 transition-all duration-150 flex items-end justify-center pb-1.5 ${
                isActive
                  ? 'bg-gradient-to-b from-emerald-400 to-cyan-400 shadow-[0_0_16px_rgba(52,211,153,0.7)] text-slate-950 scale-95 font-bold'
                  : 'bg-slate-100 hover:bg-white text-slate-600'
              }`}
            >
              <span className="text-[10px] font-mono">{k.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
