import { Sparkles } from 'lucide-solid';

interface AiFabProps {
  onClick: () => void;
}

function shortcutLabel() {
  if (typeof navigator === 'undefined') return '⌘J';
  return navigator.platform?.includes('Mac') ? '⌘J' : 'Ctrl+J';
}

export function AiFab(props: AiFabProps) {
  return (
    <button
      class="btn btn-primary btn-circle fixed right-4 bottom-4 z-20 size-14 shadow-lg"
      onClick={() => props.onClick()}
      title={`Open AI chat (${shortcutLabel()})`}
    >
      <Sparkles size={24} />
    </button>
  );
}
