import { Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';
import { CircleDotIcon, CircleIcon } from './Icons';

export function ReadIconButton(props: { read?: boolean; setRead?: (read: boolean) => void }) {
  const handleClick = () => {
    props.setRead?.(!props.read);
  };

  return (
    <button
      class={twMerge(
        'btn btn-ghost btn-square btn-sm sm:btn-lg flex items-center justify-center',
        props.read && 'text-base-content/40',
      )}
      onClick={handleClick}
      title={props.read ? 'Mark as unread' : 'Mark as read'}
    >
      <Show when={props.read} fallback={<CircleDotIcon class="size-5 sm:size-8" />}>
        <CircleIcon class="size-5 sm:size-8" />
      </Show>
    </button>
  );
}
