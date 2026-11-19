import { mkdirSync, writeFileSync } from 'node:fs';
import type { LinkReport } from './foundation-links';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Generated reports are ignored by both Git and deployment packaging. */
export function writeLinkReport(report: LinkReport) {
  const directory = 'generated-artifacts';
  mkdirSync(directory, { recursive: true });
  const json = `${directory}/foundation-links.json`;
  const html = `${directory}/foundation-links.html`;
  writeFileSync(json, JSON.stringify(report, null, 2) + '\n');
  const errors = report.issues.filter((item) => item.severity === 'error');
  const warnings = report.issues.filter((item) => item.severity === 'warning');
  const counts = new Map<string, number>();
  for (const item of report.issues) {
    const key = `${item.severity}: ${item.kind}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  writeFileSync(html, `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Foundation internal-link audit</title><style>
body{font:15px/1.5 system-ui,sans-serif;margin:32px;color:#182434;background:#fafafa}
h1{font-size:28px}table{border-collapse:collapse;width:100%;background:white;margin:20px 0}
th,td{text-align:left;vertical-align:top;padding:12px;border:1px solid #ddd;overflow-wrap:anywhere}
th{background:#eef1f5}td:first-child{white-space:nowrap}.error{color:#a21414}.warning{color:#805200}
code{font-size:12px}small{display:block;color:#5d6670}p{max-width:1000px}
</style><h1>Foundation internal-link audit</h1>
<p>${report.pages} registered public pages; ${report.links} internal references checked;
${report.destinations} distinct destination requests. <strong>${errors.length} errors;
${warnings.length} warnings.</strong></p>
<p>All checks inspect initial HTML from the production server, without executing JavaScript.
URLs below use the configured canonical origin; requests were made only to the test server.
External sites, private/API endpoints, downloads, static asset links, and non-navigation schemes were excluded.
Potential language changes are warnings, not proof that an intentional editorial choice is wrong.</p>
<p>${escape(report.bookingPolicy)}</p>
<ul>${[...counts].map(([key, count]) => `<li>${escape(key)}: ${count}</li>`).join('')}</ul>
<p>Repeated identical findings on the same page/context are deduplicated. No links were repaired.</p>
<table><thead><tr><th>Severity / check</th><th>Source</th><th>Destination / link text</th><th>Finding</th></tr></thead><tbody>
${report.issues.map((item) => `<tr><td class="${item.severity}">${item.severity}<small>${escape(item.kind)}</small></td>
<td><code>${escape(item.sourceUrl ?? item.source)}</code><small>${escape(item.context)}</small></td>
<td><code>${escape(item.destinationUrl)}</code><br>${escape(item.linkText)}</td><td>${escape(item.detail)}</td></tr>`).join('\n')}
</tbody></table></html>`);
  console.log(`Cross-page links: ${report.pages} registered pages, ${report.links} internal references, ${report.destinations} destination requests.`);
  for (const [key, count] of counts) console.log(`  ${key}: ${count}`);
  // The full HTML/JSON reports retain every finding. Keep console output useful
  // even when one repeated footer link affects hundreds of page variants.
  for (const severity of ['error', 'warning'] as const) {
    const groups = new Map<string, typeof report.issues>();
    for (const item of report.issues.filter((issue) => issue.severity === severity)) {
      const key = `${item.kind} ${item.destinationUrl}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const group of groups.values()) {
      const item = group[0];
      console.log(`  ${severity.toUpperCase()} ${item.kind}: ${item.sourceUrl ?? item.source} → ${item.destinationUrl} ` +
        `[${JSON.stringify(item.linkText)}; ${item.context}; ${group.length} source/context finding(s)] ${item.detail}`);
    }
  }
  console.log(`Full cross-page link reports: ${html} and ${json}`);
  return { errors: errors.length, warnings: warnings.length, html, json };
}
