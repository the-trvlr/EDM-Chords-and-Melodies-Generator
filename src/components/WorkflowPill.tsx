export type WorkflowStage = 'harmony' | 'idea' | 'groove' | 'arrange' | 'export';

const STAGES: { id: WorkflowStage; label: string; target: string }[] = [
  { id: 'harmony', label: 'Harmony', target: 'harmony' },
  { id: 'idea', label: 'Idea', target: 'tracks' },
  { id: 'groove', label: 'Groove', target: 'groove' },
  { id: 'arrange', label: 'Arrange', target: 'arrangement' },
  { id: 'export', label: 'Export', target: 'export-actions' },
];

interface WorkflowPillProps {
  active: WorkflowStage;
  onSelect: (stage: WorkflowStage) => void;
  onGuide: () => void;
}

export function WorkflowPill({ active, onSelect, onGuide }: WorkflowPillProps) {
  return (
    <nav aria-label="Workflow" className="mt-2 flex flex-wrap items-center gap-1 rounded-xl border border-gray-800 bg-gray-900/40 p-1">
      {STAGES.map((stage, index) => (
        <button
          key={stage.id}
          type="button"
          onClick={() => onSelect(stage.id)}
          aria-current={active === stage.id ? 'step' : undefined}
          className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition-colors ${
            active === stage.id
              ? 'bg-purple-500/20 text-purple-100 ring-1 ring-purple-400/50'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          }`}
        >
          <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] ${
            active === stage.id ? 'bg-purple-400 text-gray-950' : 'bg-gray-800 text-gray-400'
          }`}>{index + 1}</span>
          {stage.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onGuide}
        className="ml-auto flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-200"
      >
        <span aria-hidden="true">?</span> Guide
      </button>
    </nav>
  );
}
