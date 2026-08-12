export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        role="status"
        className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary"
        aria-label="Loading"
      />
    </div>
  );
}
