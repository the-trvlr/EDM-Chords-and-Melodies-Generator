import { Modal } from './Modal';

interface FirstRunProps {
  open: boolean;
  onClose: () => void;
  onTour: () => void;
  onTarget: (target: string) => void;
}

export function FirstRun({ open, onClose, onTour, onTarget }: FirstRunProps) {
  if (!open) return null;
  return (
    <Modal
      title="Welcome to ∞ Melodies"
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-xs text-gray-400 hover:text-gray-200">
            Skip
          </button>
          <button type="button" onClick={onTour} className="h-9 rounded-md bg-purple-600 px-3 text-xs font-semibold text-white hover:bg-purple-500">
            Open the guide
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-gray-300">
        A generator-first workflow: choose harmony, shape the parts, set the groove, arrange sections and export.
        Everything stays local.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          { title: 'Start with a template', body: 'Use a Sketch or Song structure and edit from there.', target: 'arrangement' },
          { title: 'Shape a progression', body: 'Pick key, genre and chords, then audition them.', target: 'harmony' },
          { title: 'Generate parts', body: 'Bass, lead and drums each have their own generator.', target: 'tracks' },
        ].map(card => (
          <button
            key={card.title}
            type="button"
            onClick={() => onTarget(card.target)}
            className="rounded-lg border border-gray-700 bg-gray-900/60 p-3 text-left transition-colors hover:border-purple-500/60 hover:bg-gray-900"
          >
            <span className="block text-xs font-semibold text-gray-100">{card.title}</span>
            <span className="mt-1 block text-[11px] leading-snug text-gray-400">{card.body}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-gray-400">You can reopen this guide anytime with the Guide button.</p>
    </Modal>
  );
}
