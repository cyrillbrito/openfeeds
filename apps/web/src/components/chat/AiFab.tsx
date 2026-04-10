import { useNavigate } from '@tanstack/solid-router';
import { Sparkles } from 'lucide-solid';

interface AiFabProps {
  onClick: () => void;
}

export function AiFab(props: AiFabProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    // Mobile: navigate to full-page /ai route
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      void navigate({ to: '/ai' });
      return;
    }
    // Desktop: open popover
    props.onClick();
  };

  return (
    <button
      class="btn btn-primary btn-circle fixed right-4 bottom-4 z-20 shadow-lg size-14"
      onClick={handleClick}
      title="Open AI chat (⌘J)"
    >
      <Sparkles size={24} />
    </button>
  );
}
