import { Printer } from 'lucide-react';

export function PrintIconButton() {
  return (
    <button
      type="button"
      aria-label="Print article"
      className="btn btn-ghost btn-square btn-sm sm:btn-lg text-base-content/80 flex items-center justify-center"
      onClick={() => window.print()}
      title="Print article"
    >
      <Printer className="size-4 sm:size-6" />
    </button>
  );
}
