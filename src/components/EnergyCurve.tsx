import { useState } from 'react';
import { Drawer } from './Drawer';
import type { SongSection, SectionEnergy } from '../types';

const LEVELS: { id: SectionEnergy; label: string; height: string }[] = [
  { id: 'low', label: 'Low', height: 'h-8' },
  { id: 'medium', label: 'Medium', height: 'h-14' },
  { id: 'high', label: 'High', height: 'h-20' },
];

interface EnergyCurveProps {
  open: boolean;
  onClose: () => void;
  sections: SongSection[];
  bpm: number;
  onApply: (sections: SongSection[]) => void;
}

function autoEnergy(section: SongSection, index: number, total: number): SectionEnergy {
  if (section.kind === 'drop') return 'high';
  if (section.kind === 'build') return index < total - 1 ? 'medium' : 'high';
  if (section.kind === 'break' || section.kind === 'intro' || section.kind === 'outro') return 'low';
  return 'medium';
}

function durationLabel(bars: number, bpm: number): string {
  const seconds = Math.round(bars * 4 * 60 / Math.max(1, bpm));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function EnergyCurve({ open, onClose, sections, bpm, onApply }: EnergyCurveProps) {
  const [energies, setEnergies] = useState<SectionEnergy[]>(() => sections.map(section => section.energy ?? 'medium'));

  const auto = () => setEnergies(sections.map((section, index) => autoEnergy(section, index, sections.length)));
  const set = (index: number, energy: SectionEnergy) => setEnergies(current => current.map((value, i) => i === index ? energy : value));
  const totalBars = sections.reduce((sum, section) => sum + section.bars, 0);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Energy curve"
      description="Shape the intensity of each section, then apply it to the arrangement."
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-400">{totalBars} bars · ~{durationLabel(totalBars, bpm)}</span>
          <div className="flex gap-2">
            <button type="button" onClick={auto} className="h-9 rounded-md border border-amber-600/50 bg-amber-500/10 px-3 text-xs text-amber-100 hover:bg-amber-500/20">Auto shape</button>
            <button
              type="button"
              onClick={() => { onApply(sections.map((section, index) => ({ ...section, energy: energies[index] ?? 'medium' }))); onClose(); }}
              className="h-9 rounded-md bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500"
            >
              Apply curve
            </button>
          </div>
        </div>
      }
    >
      {sections.length === 0 ? (
        <p className="text-xs text-gray-400">Create a structure first; the curve needs sections.</p>
      ) : (
        <>
          <div className="flex h-28 items-end gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-2">
            {sections.map((section, index) => {
              const energy = energies[index] ?? 'medium';
              const height = LEVELS.find(level => level.id === energy)?.height ?? 'h-14';
              return (
                <div key={section.id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${section.kind} · ${energy}`}>
                  <div className={`w-full rounded-t bg-gradient-to-t ${energy === 'high' ? 'from-fuchsia-700 to-fuchsia-400' : energy === 'low' ? 'from-gray-700 to-gray-500' : 'from-cyan-700 to-cyan-400'} ${height}`} />
                  <span className="max-w-full truncate text-[9px] capitalize text-gray-400">{section.kind.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 space-y-2">
            {sections.map((section, index) => (
              <div key={section.id} className="rounded-lg border border-gray-800 bg-gray-900/50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium capitalize text-gray-100">{section.kind} · {section.bars} bars</span>
                  <span className="text-[10px] text-gray-400">{section.tracks.join(' · ')}</span>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1">
                  {LEVELS.map(level => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => set(index, level.id)}
                      aria-pressed={(energies[index] ?? 'medium') === level.id}
                      className={`h-8 rounded-md text-[11px] font-medium ${
                        (energies[index] ?? 'medium') === level.id
                          ? level.id === 'high' ? 'bg-fuchsia-500/25 text-fuchsia-100 ring-1 ring-fuchsia-400/60' : level.id === 'low' ? 'bg-gray-700 text-gray-100' : 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/60'
                          : 'border border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}
