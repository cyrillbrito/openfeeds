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
        'btn btn-ghost btn-lg btn-square flex items-center justify-center',
        props.read && 'text-base-content/40',
      )}
      onClick={handleClick}
      title={props.read ? 'Mark as unread' : 'Mark as read'}
    >
      <Show when={props.read} fallback={<CircleDotIcon class="size-8" />}>
        <CircleIcon class="size-8" />
      </Show>
    </button>
  );
}
