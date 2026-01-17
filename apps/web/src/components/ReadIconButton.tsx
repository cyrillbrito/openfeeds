import { Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';
import { CircleDotIcon, CircleIcon } from './Icons';

export function ReadIconButton(props: { read?: boolean; setRead?: (read: boolean) => void }) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.setRead?.(!props.read);
  };

  return (
    <button
      class={twMerge(
        'p-2 rounded-full transition-colors hover:bg-primary/10 hover:text-primary',
        props.read ? 'text-base-content/40' : 'text-base-content/60',
      )}
      onClick={handleClick}
      title={props.read ? 'Mark as unread' : 'Mark as read'}
    >
      <Show when={props.read} fallback={<CircleDotIcon class="size-5" />}>
        <CircleIcon class="size-5" />
      </Show>
    </button>
  );
}
