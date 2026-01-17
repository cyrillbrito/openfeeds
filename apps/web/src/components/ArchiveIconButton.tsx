import ArchiveIcon from 'lucide-solid/icons/archive';
import InboxIcon from 'lucide-solid/icons/inbox';
import { Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';

export function ArchiveIconButton(props: {
  read?: boolean;
  archived?: boolean;
  setArchived?: (archived: boolean) => void;
}) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.setArchived?.(!props.archived);
  };

  return (
    <button
      class={twMerge(
        'p-2 rounded-full transition-colors hover:bg-warning/10 hover:text-warning',
        props.archived ? 'text-warning' : 'text-base-content/60',
      )}
      onClick={handleClick}
      title={props.archived ? 'Unarchive (show in inbox)' : 'Archive'}
    >
      <Show when={props.archived} fallback={<ArchiveIcon class="size-5" />}>
        <InboxIcon class="size-5" />
      </Show>
    </button>
  );
}
