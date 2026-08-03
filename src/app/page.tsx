export default function Home() {
  return (
    <main className="bg-felt flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-cream font-heading text-5xl font-bold tracking-tight">Naija Whot</h1>
      <p className="text-cream/80 max-w-sm text-balance">
        The landing page, lobby, and game table are being built next — see{" "}
        <code className="rounded bg-black/20 px-1 py-0.5">TASKS.md</code> for progress.
      </p>
    </main>
  );
}
