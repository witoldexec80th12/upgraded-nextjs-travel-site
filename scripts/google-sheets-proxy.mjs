import { ReplitConnectors } from '@replit/connectors-sdk';

let input = '';
for await (const chunk of process.stdin) input += chunk;

try {
  const request = JSON.parse(input);
  const method = request.method ?? 'GET';
  const hasBody =
    request.body !== undefined &&
    request.body !== null &&
    !['GET', 'HEAD'].includes(method.toUpperCase());
  const response = await new ReplitConnectors().proxy(
    'google-sheet',
    request.path,
    {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(request.body) : undefined,
    },
  );
  const raw = await response.text();
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { message: 'The Sheets service returned an unreadable response.' };
  }
  const output = { status: response.status, body };
  process.stdout.write(`${JSON.stringify(output)}\n`);
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : 'Connector request failed.';
  process.stdout.write(`${JSON.stringify({ status: 0, error: message.slice(0, 300) })}\n`);
  process.exitCode = 1;
}
