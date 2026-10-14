import { twMerge } from 'tailwind-merge';
import { CircleDotIcon, CircleIcon } from './Icons';

export function ReadIconButton({ read, setRead }: { read?: boolean; setRead?: (read: boolean) => void }) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRead?.(!read);
  };

  return (
    <button
      className={twMerge(
        'btn btn-ghost btn-square btn-sm sm:btn-lg flex items-center justify-center',
        read && 'text-base-content/40',
      )}
      onClick={handleClick}
      title={read ? 'Mark as unread' : 'Mark as read'}
    >
      {read ? (
        <CircleIcon className="size-5 sm:size-8" />
      ) : (
        <CircleDotIcon className="size-5 sm:size-8" />
      )}
    </button>
  );
}
