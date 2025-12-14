import { Link } from '@tanstack/solid-router';

export function NotFound({ children }: { children?: any }) {
  return (
    <div class="space-y-2 p-2">
      <div class="text-gray-600 dark:text-gray-400">
        {children || <p>The page you are looking for does not exist.</p>}
      </div>
      <p class="flex flex-wrap items-center gap-2">
        <button
          onClick={() => window.history.back()}
          class="rounded bg-emerald-500 px-2 py-1 text-sm font-black text-white uppercase"
        >
          Go back
        </button>
        <Link to="/" class="rounded bg-cyan-600 px-2 py-1 text-sm font-black text-white uppercase">
          Start Over
        </Link>
      </p>
    </div>
  );
}
