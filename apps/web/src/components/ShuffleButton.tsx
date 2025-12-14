import { Link } from '@tanstack/solid-router';
import ShuffleIcon from 'lucide-solid/icons/shuffle';
import { twMerge } from 'tailwind-merge';

interface ShuffleButtonProps {
  currentSeed?: string | number;
  class?: string;
}

export function ShuffleButton(props: ShuffleButtonProps) {
  const generateSeed = () => {
    // Generate a large random number (up to 10 digits)
    return Math.floor(Math.random() * 9999999999) + 1000000000;
  };

  const toggleShuffle = (search: Record<string, any>) => {
    if (search.seed) {
      return { ...search, seed: undefined };
    } else {
      // Add seed to turn on shuffle
      return { ...search, seed: generateSeed() };
    }
  };

  return (
    <Link to="." search={toggleShuffle}>
      <button
        class={twMerge(
          'btn btn-sm',
          props.currentSeed ? 'btn-primary' : 'btn-outline',
          props.class,
        )}
        title={props.currentSeed ? 'Turn off shuffle' : 'Shuffle article order'}
      >
        <ShuffleIcon size={16} />
        Shuffle
      </button>
    </Link>
  );
}
