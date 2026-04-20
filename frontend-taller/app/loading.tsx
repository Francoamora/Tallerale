export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-56 rounded-[32px] bg-white/70" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 rounded-[28px] bg-white/70" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="h-80 rounded-[30px] bg-white/70" />
          <div className="h-80 rounded-[30px] bg-white/70" />
        </div>
      </div>
    </main>
  );
}
