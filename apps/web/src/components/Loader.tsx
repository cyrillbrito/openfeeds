export function Loader() {
  return <span className="loading loading-spinner loading-xl"></span>;
}

export function CenterLoader() {
  return (
    <div className="flex justify-center py-12">
      <span className="loading loading-spinner loading-xl"></span>
    </div>
  );
}
