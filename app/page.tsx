'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <main className="mx-auto max-w-xl p-8 text-center text-slate-600">Restoring this room…</main>
  ),
});

export default function Page() {
  return <App />;
}
