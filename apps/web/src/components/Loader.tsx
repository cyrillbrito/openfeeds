export function Loader() {
  return <span class="loading loading-spinner loading-xl"></span>;
}

export function CenterLoader() {
  return (
    <div class="flex justify-center py-12">
      <span class="loading loading-spinner loading-xl"></span>
    </div>
  );
}
