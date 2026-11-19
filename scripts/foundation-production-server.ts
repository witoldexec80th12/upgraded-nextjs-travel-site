import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

/** A finite test server, not a workflow or replacement for the development preview. */
export async function withProductionServer(check: (base: string) => Promise<void>) {
  const buildId = readFileSync('.next/BUILD_ID', 'utf8').trim();
  if (!buildId) throw new Error('Production build missing. Run npm run build first.');
  const configured = process.env.TEST_BASE_URL;
  let child: ReturnType<typeof spawn> | undefined;
  let log = '';
  let spawnError: Error | undefined;
  let base: string;
  if (configured) {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) {
      throw new Error('TEST_BASE_URL must be an HTTP(S) origin without credentials or a path.');
    }
    base = url.origin;
  } else {
    const reservation = createServer();
    await new Promise<void>((resolve, reject) => {
      reservation.once('error', reject);
      reservation.listen(0, '127.0.0.1', resolve);
    });
    const address = reservation.address();
    if (!address || typeof address === 'string') throw new Error('Could not reserve a production-test port.');
    const port = address.port;
    await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
    base = `http://127.0.0.1:${port}`;
    const require = createRequire(import.meta.url);
    child = spawn(process.execPath, [
      require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port),
    ], { env: { ...process.env, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.on('error', (error) => { spawnError = error; });
    const capture = (data: Buffer) => { log = (log + data.toString()).slice(-8000); };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);
  }
  try {
    let ready = false;
    const deadline = Date.now() + 30000;
    do {
      if (spawnError) throw spawnError;
      if (child && (child.exitCode !== null || child.signalCode !== null)) throw new Error(`Production test server exited:\n${log}`);
      try {
        const response = await fetch(`${base}/en`, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
        const html = await response.text();
        if (response.status === 200) {
          if (!html.includes(buildId) || /next-devtools|webpack-hmr|\/@vite\/client/.test(html)) {
            throw new Error(`Expected the current production build at ${base}; development or stale HTML was returned.`);
          }
          ready = true;
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Expected the current production')) throw error;
        if (configured) throw error;
      }
      if (!ready) await delay(100);
    } while (!ready && Date.now() < deadline);
    if (!ready) throw new Error(`Production test server was not ready at ${base}:\n${log}`);
    const manifest = await fetch(`${base}/_next/static/${buildId}/_buildManifest.js`, {
      redirect: 'manual', signal: AbortSignal.timeout(10000),
    });
    if (manifest.status !== 200 || !(await manifest.text()).includes('__BUILD_MANIFEST')) {
      throw new Error(`Production build identity could not be verified at ${base}.`);
    }
    console.log(`HTTP foundation checks: production build ${buildId} at ${base} (no JavaScript execution).`);
    await check(base);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise<void>((resolve) => child!.once('exit', () => resolve()));
      child.kill('SIGTERM');
      await Promise.race([exited, delay(5000, undefined, { ref: false })]);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await exited;
      }
    }
  }
}
