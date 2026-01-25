import { Link } from '@tanstack/solid-router';
import FileQuestion from 'lucide-solid/icons/file-question';

export function NotFound() {
  return (
    <div class="hero bg-base-200 min-h-screen">
      <div class="hero-content text-center">
        <div class="w-full max-w-lg">
          <div class="mb-8 flex flex-col items-center gap-4">
            <FileQuestion class="text-base-content/50 size-16" />
            <h1 class="text-base-content text-2xl font-bold">Page Not Found</h1>
          </div>

          <p class="text-base-content/70 mb-6">
            The page you are looking for does not exist or has been moved.
          </p>

          <Link to="/" class="btn btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
