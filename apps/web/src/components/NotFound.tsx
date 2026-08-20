import { Link } from '@tanstack/react-router';
import { FileX } from 'lucide-react';

export function NotFound() {
  return (
    <div className="hero bg-base-200 min-h-screen">
      <div className="hero-content text-center">
        <div className="w-full max-w-lg">
          <div className="mb-8 flex flex-col items-center gap-4">
            <FileX className="text-base-content/50 size-16" />
            <h1 className="text-base-content text-2xl font-bold">Page Not Found</h1>
          </div>

          <p className="text-base-content/70 mb-6">
            The page you are looking for does not exist or has been moved.
          </p>

          <Link to="/" className="btn btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
