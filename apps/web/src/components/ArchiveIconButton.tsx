import ArchiveIcon from 'lucide-solid/icons/archive';
import InboxIcon from 'lucide-solid/icons/inbox';
import { Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';

export function ArchiveIconButton(props: {
  read?: boolean;
  archived?: boolean;
  setArchived?: (archived: boolean) => void;
}) {
  const handleClick = () => {
    props.setArchived?.(!props.archived);
  };

  return (
    <button
      class={twMerge(
        'btn btn-ghost btn-square btn-sm sm:btn-lg flex items-center justify-center',
        props.read ? 'text-base-content/40' : 'text-base-content/80',
      )}
      onClick={handleClick}
      title={props.archived ? 'Unarchive (show in inbox)' : 'Archive'}
    >
      <Show when={props.archived} fallback={<ArchiveIcon class="size-4 sm:size-6" />}>
        <InboxIcon class="size-4 sm:size-6" />
      </Show>
    </button>
  );
}
