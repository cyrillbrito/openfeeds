import { Printer } from 'lucide-solid';

export function PrintIconButton() {
  return (
    <button
      type="button"
      aria-label="Print article"
      class="btn btn-ghost btn-square btn-sm sm:btn-lg text-base-content/80 flex items-center justify-center"
      onClick={() => window.print()}
      title="Print article"
    >
      <Printer class="size-4 sm:size-6" />
    </button>
  );
}
