'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
    <h1 className="font-serif text-3xl">This page couldn’t load</h1>
    <button onClick={reset} className="underline">Try again</button>
  </main>;
}
