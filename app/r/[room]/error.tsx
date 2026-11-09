'use client';

export default function RoomError({ error }: { error: Error }) {
  return (
    <main className="mx-auto max-w-xl p-8 text-center text-rose-700">
      <p>{error.message}</p>
      <p className="mt-2 text-sm text-slate-600">Refresh the page to try again.</p>
    </main>
  );
}
