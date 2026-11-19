import NextLink from 'next/link';

export default function NotFound() {
  return <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
    <h1 className="font-serif text-4xl">404 — Page not found</h1>
    <p>The page you requested does not exist.</p>
    <NextLink href="/" className="underline">Return to home</NextLink>
  </main>;
}
