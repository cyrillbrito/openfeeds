import { Archive, Inbox } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export function ArchiveIconButton({
  read,
  archived,
  setArchived,
}: {
  read?: boolean;
  archived?: boolean;
  setArchived?: (archived: boolean) => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setArchived?.(!archived);
  };

  return (
    <button
      className={twMerge(
        'btn btn-ghost btn-square btn-sm sm:btn-lg flex items-center justify-center',
        read ? 'text-base-content/40' : 'text-base-content/80',
      )}
      onClick={handleClick}
      title={archived ? 'Unarchive (show in inbox)' : 'Archive'}
    >
      {archived ? (
        <Inbox className="size-4 sm:size-6" />
      ) : (
        <Archive className="size-4 sm:size-6" />
      )}
    </button>
  );
}
