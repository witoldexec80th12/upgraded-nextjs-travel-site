'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Redirect, useLocation } from './navigation';
import {
  getCsvExportUrl,
  useAdminLogin,
  useAdminLogout,
  useAdminSession,
  useAvailability,
  useAvailabilityHistory,
  useCheckStatus,
  useHuts,
  useRecentChecks,
  useLatestSweep,
  useRetryAirtableSync,
  useRetrySweep,
  useRetrySweepSheets,
  useRunSweepPilot,
  useSaveSweepSettings,
  useSetupSweepSheets,
  useSweepSettings,
  useStartAvailabilityCheck,
  type AvailabilityFilters,
  type AvailabilityRecord,
  type CheckSummary,
  type Hut,
} from './api';
import './admin.css';

function localISODate(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayRange(start: string, end: string): string[] {
  if (!start || !end || start > end) return [];
  const days: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cursor <= last) {
    days.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function statusClass(status: string): string {
  return status.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function Brand() {
  return (
    <Link href="/admin" className="av-brand">
      <span className="av-mark" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="m3 18 6-10 3 5 2-3 7 8H3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="m7 18 4-6 4 6" stroke="currentColor" strokeWidth="1.2" /></svg>
      </span>
      <span className="av-brand-name">Alta Via 1</span>
      <span className="av-brand-tag">Operations</span>
    </Link>
  );
}

function StateMessage({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="av-state"><span className="av-state-mark" aria-hidden="true">i</span><strong>{title}</strong>{children && <p>{children}</p>}{action}</div>;
}

function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="av-loading-block" aria-label="Loading" aria-busy="true">{Array.from({ length: rows }, (_, i) => <div key={i} className={`av-skeleton ${i === 0 ? 'short' : i === 1 ? 'medium' : ''}`} />)}</div>;
}

function DailySweepPanel() {
  const settingsQuery = useSweepSettings();
  const latestQuery = useLatestSweep();
  const save = useSaveSweepSettings();
  const setupSheets = useSetupSweepSheets();
  const retryRun = useRetrySweep();
  const retrySheets = useRetrySweepSheets();
  const runPilot = useRunSweepPilot();
  const [form, setForm] = useState({
    enabled: false,
    date_from: '2026-06-01',
    date_to: '2027-10-31',
    people: 2,
    timezone: 'Europe/Madrid',
    run_at: '03:00',
  });
  const settings = settingsQuery.data;
  const latest = latestQuery.data;
  useEffect(() => {
    if (settings) {
      setForm({
        enabled: settings.enabled,
        date_from: settings.date_from,
        date_to: settings.date_to,
        people: settings.people,
        timezone: settings.timezone,
        run_at: settings.run_at,
      });
    }
  }, [settings]);

  function saveSettings(enabled = form.enabled) {
    save.mutate({ ...form, enabled });
  }

  const busy = save.isPending || setupSheets.isPending || retryRun.isPending || retrySheets.isPending || runPilot.isPending;
  const batchesDone = latest ? latest.batches_done : 0;
  const batchesTotal = latest ? latest.batches_total : 0;
  const progress = batchesTotal ? Math.round((batchesDone / batchesTotal) * 100) : 0;
  const pilotNightCount = dayRange(form.date_from, form.date_to).length;
  const pilotRangeValid = pilotNightCount >= 1 && pilotNightCount <= 7;

  function startPilot() {
    if (!pilotRangeValid || !settings?.spreadsheet_id || form.enabled || settings.enabled) return;
    const confirmed = window.confirm(
      `Run a live one-time scan for ${form.date_from} through ${form.date_to}, for ${form.people} people, with no children? It checks all automatic huts, saves results to Neon, then exports them to Sheets. The recurring schedule stays off.`,
    );
    if (confirmed) {
      runPilot.mutate({
        date_from: form.date_from,
        date_to: form.date_to,
        people: form.people,
      });
    }
  }

  return (
    <section className="av-panel">
      <div className="av-panel-head">
        <div><h2 className="av-panel-title">Daily availability matrix</h2><p className="av-panel-note">One automatic scan per day. Results are saved in PostgreSQL first, then written to Google Sheets.</p></div>
        <span className={`av-status ${form.enabled ? 'available' : 'closed'}`}>{form.enabled ? 'enabled' : 'paused'}</span>
      </div>
      {settingsQuery.isLoading ? <Loading rows={3} /> : settingsQuery.isError ? <ApiError message={settingsQuery.error.message} retry={() => void settingsQuery.refetch()} /> : <>
        <div className="av-form-row">
          <div className="av-field"><label htmlFor="sweep-from">First night</label><input id="sweep-from" type="date" value={form.date_from} onChange={(event) => setForm({ ...form, date_from: event.target.value })} /></div>
          <div className="av-field"><label htmlFor="sweep-to">Last night</label><input id="sweep-to" type="date" min={form.date_from} value={form.date_to} onChange={(event) => setForm({ ...form, date_to: event.target.value })} /></div>
          <div className="av-field"><label htmlFor="sweep-people">Group size</label><input id="sweep-people" type="number" min={1} max={12} value={form.people} onChange={(event) => setForm({ ...form, people: Number(event.target.value) })} /></div>
          <div className="av-field"><label htmlFor="sweep-time">Local run time</label><input id="sweep-time" type="time" value={form.run_at} onChange={(event) => setForm({ ...form, run_at: event.target.value })} /></div>
          <div className="av-field"><label htmlFor="sweep-timezone">Time zone</label><input id="sweep-timezone" type="text" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></div>
        </div>
        <p className="av-hint">Time zone: {form.timezone}. The range is split into safe batches; manual-only huts are labeled, not scraped. If enabled after today’s run time, today’s catch-up scan may start shortly.</p>

        <div className="av-run-footer">
          <div className="av-results-actions">
            <button className="av-button av-button-secondary" type="button" onClick={() => setupSheets.mutate(undefined)} disabled={busy}>
              {setupSheets.isPending ? 'Connecting…' : settings?.spreadsheet_url ? 'Refresh hut tabs' : 'Create Google workbook'}
            </button>
            {settings?.spreadsheet_url && <a className="av-button av-button-secondary" href={settings.spreadsheet_url} target="_blank" rel="noreferrer">Open workbook ↗</a>}
            <button
              className="av-button av-button-secondary"
              type="button"
              onClick={startPilot}
              disabled={busy || !settings?.spreadsheet_id || form.enabled || settings.enabled || !pilotRangeValid}
            >
              {runPilot.isPending ? 'Starting pilot…' : 'Run one-time pilot'}
            </button>
          </div>
          <div className="av-results-actions">
            <button className="av-button av-button-secondary" type="button" onClick={() => saveSettings()} disabled={busy || !form.date_from || form.date_from > form.date_to}>Save settings</button>
            <button className="av-button av-button-primary" type="button" onClick={() => saveSettings(!form.enabled)} disabled={busy || (!form.enabled && !settings?.spreadsheet_id) || form.date_from > form.date_to}>
              {save.isPending ? 'Saving…' : form.enabled ? 'Pause daily scan' : 'Enable daily scan'}
            </button>
          </div>
        </div>
        <p className="av-hint">
          The pilot uses the dates and group size above once, without saving them or enabling the daily schedule. Choose up to 7 future stay dates; all automatic huts are checked, while manual-only huts are skipped. Each date is a one-night stay with no children.
        </p>
        {runPilot.data && <p className="av-hint" role="status">Pilot {runPilot.data.run_id} queued for {runPilot.data.huts_total} automatic huts. The schedule remains paused.</p>}
        {runPilot.isError && <p className="av-error-text" role="alert">{runPilot.error.message}</p>}
        {setupSheets.isError && <p className="av-error-text" role="alert">{setupSheets.error.message}</p>}
        {save.isError && <p className="av-error-text" role="alert">{save.error.message}</p>}

        <hr style={{ margin: '22px 0', border: 0, borderTop: '1px solid var(--av-border, #e7e8e4)' }} />
        <div className="av-results-head">
          <div><h3 className="av-panel-title">Latest daily run</h3><p className="av-panel-note">{latest ? `${latest.run_date} · ${latest.date_from} to ${latest.date_to} · ${latest.people} people` : 'No daily scan has run yet.'}</p></div>
          {latest && <span className={`av-status ${statusClass(latest.status)}`}>{latest.status}</span>}
        </div>
        {latestQuery.isError ? <ApiError message={latestQuery.error.message} retry={() => void latestQuery.refetch()} /> : latest ? <>
          <p className="av-hint">{batchesDone} / {batchesTotal} batches complete · {latest.huts_done} / {latest.huts_total} automated huts · {latest.manual_huts} manual-only</p>
          {(latest.status === 'running' || latest.status === 'queued') && <div className="av-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="av-progress-fill" style={{ width: `${progress}%` }} /></div>}
          {latest.error && <p className="av-error-text" role="alert">{latest.error}</p>}
          <p className="av-hint">Google Sheets export: <strong>{latest.sheets_status}</strong>{latest.sheets_error ? ` · ${latest.sheets_error}` : ''}</p>
          <div className="av-results-actions">
            {latest.batches_failed > 0 || latest.error_count > 0 ? <button className="av-button av-button-secondary" type="button" onClick={() => retryRun.mutate(latest.run_id)} disabled={busy}>Retry failed checks</button> : null}
            {latest.sheets_status === 'failed' && <button className="av-button av-button-secondary" type="button" onClick={() => retrySheets.mutate(latest.run_id)} disabled={busy}>Retry Sheets export</button>}
          </div>
          {retryRun.isError && <p className="av-error-text" role="alert">{retryRun.error.message}</p>}
          {retrySheets.isError && <p className="av-error-text" role="alert">{retrySheets.error.message}</p>}
        </> : null}
      </>}
    </section>
  );
}

function ApiError({ message, retry }: { message: string; retry: () => void }) {
  return <StateMessage title="Couldn’t load this view" action={<button className="av-button av-button-secondary" onClick={retry}>Try again</button>}>{message || 'The availability service is not responding. Check your connection and retry.'}</StateMessage>;
}

function AdminLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const logout = useAdminLogout();
  return (
    <div className="av-admin av-auth-layout">
      <div className="av-shell">
        <header className="av-topbar">
          <Brand />
          <div className="av-top-actions"><span className="av-top-caption">Private availability console</span><button className="av-icon-button" onClick={() => logout.mutate(undefined, { onSuccess: () => setLocation('/admin/login') })} disabled={logout.isPending}>Sign out <span aria-hidden="true">↗</span></button></div>
        </header>
        {children}
      </div>
    </div>
  );
}

function LoginPage({ session }: { session: ReturnType<typeof useAdminSession> }) {
  const login = useAdminLogin();
  const [, setLocation] = useLocation();
  const [apiKey, setApiKey] = useState('');
  const token = session.data?.csrf_token ?? '';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token || !apiKey.trim()) return;
    login.mutate({ apiKey: apiKey.trim(), token }, { onSuccess: () => setLocation('/admin') });
  };

  if (session.isLoading) return <div className="av-admin av-auth-loading"><div className="av-panel"><div className="av-skeleton short" /><div className="av-skeleton" /><div className="av-skeleton medium" /></div></div>;
  const unavailable = session.isError;
  return (
    <div className="av-admin av-login">
      <aside className="av-login-aside">
        <Brand />
        <div className="av-login-copy">
          <p className="av-eyebrow">Dolomites · Field operations</p>
          <h1>Plan the nights.<br />Know the route.</h1>
          <p>A private console for checking hut availability along Alta Via 1. Read-only checks of public booking pages; no booking details are submitted.</p>
        </div>
        <div className="av-login-foot">ALTA VIA 1 &nbsp; / &nbsp; HUT AVAILABILITY</div>
      </aside>
      <main className="av-login-form-area">
        <form className="av-login-form av-enter" onSubmit={submit}>
          <p className="av-eyebrow">Restricted access</p>
          <h2>Operator sign in</h2>
          <p>Use your configured admin key to open the operations console.</p>
          {unavailable && (
            <>
              <div className="av-login-unavailable" role="alert">
                {session.error?.message || 'The admin session service is unavailable. Check the server connection and retry.'}
              </div>
              <button className="av-button av-button-secondary" type="button" onClick={() => void session.refetch()}>
                Retry connection
              </button>
            </>
          )}
          <div className="av-field"><label htmlFor="admin-key">Admin key</label><input id="admin-key" autoComplete="current-password" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} required disabled={unavailable} /></div>
          <button className="av-button av-button-primary" type="submit" disabled={unavailable || !token || login.isPending || !apiKey.trim()}>{login.isPending ? 'Authenticating…' : 'Continue'} <span aria-hidden="true">→</span></button>
          {login.isError && <p className="av-error-text" role="alert">{login.error.message || 'Authentication failed. Check the key and try again.'}</p>}
          <div className="av-login-help">Your access is protected by a secure server session.</div>
        </form>
      </main>
    </div>
  );
}

function Dashboard() {
  const [dateFrom, setDateFrom] = useState(localISODate());
  const [dateTo, setDateTo] = useState(localISODate(6));
  const [people, setPeople] = useState(2);
  const [clusterFilter, setClusterFilter] = useState('');
  const [clustersSelected, setClustersSelected] = useState<string[]>([]);
  const [hutsSelected, setHutsSelected] = useState<string[]>([]);
  const [force, setForce] = useState(false);
  const filters: AvailabilityFilters = useMemo(() => ({
    date_from: dateFrom,
    date_to: dateTo,
    people,
    ...(clusterFilter ? { cluster: clusterFilter } : {}),
  }), [dateFrom, dateTo, people, clusterFilter]);
  const hutsQuery = useHuts();
  const availability = useAvailability(filters, Boolean(dateFrom && dateTo && dateFrom <= dateTo));
  const recent = useRecentChecks();
  const startCheck = useStartAvailabilityCheck();
  const huts = hutsQuery.data ?? [];
  const activeHuts = huts.filter((hut) => hut.active);
  const automaticHuts = activeHuts.filter((hut) => hut.system !== 'manual' && (!clusterFilter || hut.cluster === clusterFilter));
  const manualHuts = activeHuts.filter((hut) => hut.system === 'manual' && (!clusterFilter || hut.cluster === clusterFilter));
  const clusters = [...new Set(activeHuts.map((hut) => hut.cluster))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const days = dayRange(dateFrom, dateTo);
  const rows = (availability.data ?? []).filter((record) => !clusterFilter || record.cluster === clusterFilter);
  const byCell = new Map(rows.map((record) => [`${record.hut_key}|${record.night}`, record]));
  const groupedHuts = clusters
    .filter((cluster) => !clusterFilter || clusterFilter === cluster)
    .map((cluster) => ({ cluster, huts: automaticHuts.filter((hut) => hut.cluster === cluster) }))
    .filter((group) => group.huts.length);

  function toggleValue(value: string, selected: string[], setSelected: (next: string[]) => void) {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }
  function queueCheck(event: FormEvent) {
    event.preventDefault();
    const request = {
      date_from: dateFrom,
      date_to: dateTo,
      people,
      ...(clustersSelected.length ? { clusters: clustersSelected } : {}),
      ...(hutsSelected.length ? { huts: hutsSelected } : {}),
      ...(force ? { force: true } : {}),
    };
    startCheck.mutate(request, {
      onSuccess: (result) => { window.location.href = `/admin/jobs/${result.job_id}`; },
    });
  }

  return (
    <AdminLayout>
      <main className="av-enter">
        <div className="av-page-head">
          <div><p className="av-eyebrow">Route planning · Availability</p><h1>Hut availability</h1><p>Read-only checks of public booking availability. No booking details are submitted.</p></div>
        </div>
        <div className="av-main">
          <section className="av-panel av-run-panel">
            <div className="av-panel-head"><div><h2 className="av-panel-title">Run an availability check</h2><p className="av-panel-note">Choose the nights and huts to include in this check.</p></div></div>
            {hutsQuery.isLoading ? <Loading rows={2} /> : hutsQuery.isError ? <ApiError message={hutsQuery.error.message} retry={() => void hutsQuery.refetch()} /> : (
              <form onSubmit={queueCheck}>
                <div className="av-form-row">
                  <div className="av-field"><label htmlFor="run-from">First night</label><input id="run-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} required /></div>
                  <div className="av-field"><label htmlFor="run-to">Last night</label><input id="run-to" type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} required /></div>
                  <div className="av-field"><label htmlFor="run-people">People</label><input id="run-people" type="number" min={1} max={12} value={people} onChange={(e) => setPeople(Number(e.target.value))} required /></div>
                </div>
                <div className="av-selection-area">
                  <div className="av-choice-box">
                    <div className="av-choice-heading">Clusters <small>{clustersSelected.length ? `${clustersSelected.length} selected` : 'optional'}</small></div>
                    <div className="av-check-grid">{clusters.map((cluster) => <label className="av-check-pill" key={cluster}><input type="checkbox" checked={clustersSelected.includes(cluster)} onChange={() => toggleValue(cluster, clustersSelected, setClustersSelected)} />{cluster}</label>)}</div>
                  </div>
                  <div className="av-choice-box">
                    <div className="av-choice-heading">Individual huts <small>{hutsSelected.length ? `${hutsSelected.length} selected` : 'optional'}</small></div>
                    {activeHuts.length === 0 ? <p className="av-hint">No active huts are configured.</p> : <div className="av-check-grid">{activeHuts.filter((hut) => hut.system !== 'manual').map((hut) => <label className="av-check-pill" key={hut.key}><input type="checkbox" checked={hutsSelected.includes(hut.key)} onChange={() => toggleValue(hut.key, hutsSelected, setHutsSelected)} /><span className="av-check-hut-name">{hut.name}</span><small>{hut.cluster}</small></label>)}</div>}
                  </div>
                </div>
                <p className="av-hint" style={{ marginTop: 11 }}>Leave clusters and huts blank to check every active, automated hut. Manual huts are listed below and are never scraped.</p>
                <label className="av-force"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Ignore the three-hour cache for this check</label>
                {startCheck.isError && <p className="av-error-text" role="alert">{startCheck.error.message || 'Could not queue this check.'}</p>}
                <div className="av-run-footer"><p className="av-hint">{startCheck.isSuccess ? 'Check queued. Opening progress…' : 'Requests are queued and processed in the background.'}</p><button className="av-button av-button-primary" type="submit" disabled={startCheck.isPending || dateFrom > dateTo || people < 1 || people > 12}>{startCheck.isPending ? 'Queueing…' : 'Queue check'} <span aria-hidden="true">→</span></button></div>
              </form>
            )}
          </section>

          <DailySweepPanel />

          <section className="av-panel av-results-panel">
            <div className="av-results-head">
              <div><h2 className="av-panel-title">Latest availability</h2><p className="av-panel-note">Showing {people} {people === 1 ? 'person' : 'people'} · {dateFrom} to {dateTo}{clusterFilter ? ` · cluster ${clusterFilter}` : ''}</p></div>
              <div className="av-results-actions">
                <a className="av-button av-button-secondary" href={getCsvExportUrl(filters)} download>Download CSV <span aria-hidden="true">↓</span></a>
                <div className="av-inline-filter"><label htmlFor="cluster-filter">Cluster</label><select id="cluster-filter" className="av-filter-select" value={clusterFilter} onChange={(e) => setClusterFilter(e.target.value)}><option value="">All clusters</option>{clusters.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}</select></div>
              </div>
            </div>
            {availability.isLoading ? <Loading rows={4} /> : availability.isError ? <ApiError message={availability.error.message} retry={() => void availability.refetch()} /> : (
              <div className="av-table-scroll">
                {groupedHuts.length === 0 ? <StateMessage title={availability.data?.length ? 'No automated huts in this cluster' : 'No availability has been recorded'}>{availability.data?.length ? 'Choose another cluster to view its huts.' : 'Run a check to populate the latest results for your selected nights.'}</StateMessage> :
                  <table className="av-table">
                    <thead><tr><th>Hut</th>{days.map((day) => <th className="av-day-head" key={day}><span className="av-day-name">{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span><span className="av-day-date">{day}</span></th>)}</tr></thead>
                    <tbody>{groupedHuts.map(({ cluster, huts: groupHuts }) => <GroupRows key={cluster} cluster={cluster} huts={groupHuts} days={days} byCell={byCell} />)}</tbody>
                  </table>}
              </div>
            )}
          </section>

          {manualHuts.length > 0 && <section className="av-panel av-manual-panel">
            <div><h2 className="av-panel-title">Check these huts by hand</h2><p className="av-panel-note">These booking pages are manual-only; the service will not attempt to scrape them.</p></div>
            <div className="av-manual-list">{manualHuts.map((hut) => <div className="av-manual-item" key={hut.key}><strong>{hut.name}</strong> · Cluster {hut.cluster}{hut.booking_url && <> · <a href={hut.booking_url} target="_blank" rel="noopener noreferrer">Booking page ↗</a></>}{hut.notes && <p>{hut.notes}</p>}</div>)}</div>
          </section>}

          <section className="av-panel av-jobs-panel">
            <div><h2 className="av-panel-title">Recent checks</h2><p className="av-panel-note">Latest queued and completed availability runs.</p></div>
            {recent.isLoading ? <Loading rows={2} /> : recent.isError ? <ApiError message={recent.error.message} retry={() => void recent.refetch()} /> : recent.data?.length ? <div className="av-job-list">{recent.data.map((job) => <JobRow key={job.job_id} job={job} />)}</div> : <StateMessage title="No checks have run yet">Your queued availability checks will appear here.</StateMessage>}
          </section>
        </div>
      </main>
    </AdminLayout>
  );
}

function GroupRows({ cluster, huts, days, byCell }: { cluster: string; huts: Hut[]; days: string[]; byCell: Map<string, AvailabilityRecord> }) {
  return <>
    <tr className="av-group-row"><th colSpan={days.length + 1}>Cluster {cluster}</th></tr>
    {huts.map((hut) => <tr key={hut.key}>
      <td className="av-hut-cell"><Link className="av-hut-link" href={`/admin/history/${encodeURIComponent(hut.key)}`}>{hut.name}</Link><span className="av-hut-system">{hut.system}</span></td>
      {days.map((day) => {
        const record = byCell.get(`${hut.key}|${day}`);
        return <td className="av-cell" key={day} title={record ? `${record.detail || ''}${record.detail ? ' · ' : ''}Checked ${formatDate(record.checked_at)}` : 'No result recorded'}>
          {record ? <><span className={`av-status ${statusClass(record.status)}`}>{record.status.replace(/_/g, ' ')}</span>{record.beds_free !== null && <small>{record.beds_free} beds</small>}</> : <span className="av-dash">—</span>}
        </td>;
      })}
    </tr>)}
  </>;
}

function JobRow({ job }: { job: CheckSummary }) {
  return <Link href={`/admin/jobs/${job.job_id}`} className="av-job-row">
    <div><div className="av-job-range">Check #{job.job_id} · {job.date_from} to {job.date_to}</div><div className="av-job-meta">{job.people} {job.people === 1 ? 'person' : 'people'} · {formatDate(job.created_at)}</div></div>
    <div className="av-job-count">{job.huts_done}/{job.huts_total} huts</div>
    <div className="av-job-right"><span className={`av-status ${statusClass(job.status)}`}>{job.status}</span><span aria-hidden="true">→</span></div>
  </Link>;
}

function JobPage({ jobId }: { jobId: string }) {
  const params = { jobId };
  const id = Number(params.jobId);
  const jobQuery = useCheckStatus(id, Number.isFinite(id) && id > 0);
  const job = jobQuery.data;
  const airtableRetry = useRetryAirtableSync();
  const running = job?.status === 'queued' || job?.status === 'running';
  const pct = job ? (job.huts_total ? Math.min(100, Math.round(job.huts_done / job.huts_total * 100)) : job.status === 'done' ? 100 : 0) : 0;
  return <AdminLayout><main className="av-detail-shell av-enter">
    <div className="av-page-head"><div><p className="av-eyebrow">Availability run</p><h1>Check #{params.jobId}</h1>{job && <p>{job.date_from} to {job.date_to} · {job.people} {job.people === 1 ? 'person' : 'people'}</p>}</div><Link href="/admin" className="av-button av-button-secondary">← Back to availability</Link></div>
    {jobQuery.isLoading ? <section className="av-panel"><Loading rows={3} /></section> : jobQuery.isError ? <section className="av-panel"><ApiError message={jobQuery.error.message} retry={() => void jobQuery.refetch()} /></section> : job ? <>
      <section className="av-panel av-detail-card">
        <div className="av-detail-summary"><span className={`av-status ${statusClass(job.status)}`}>{job.status}</span><span className="av-detail-status">Check progress</span></div>
        <div className="av-progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Huts checked"><div className="av-progress-fill" style={{ width: `${pct}%` }} /></div>
        <div className="av-progress-caption">{job.huts_done} of {job.huts_total} huts checked · {pct}%</div>
        {job.error && <div className="av-error-banner" role="alert">{job.error}</div>}
        {job.status === 'done' && <div className="av-panel-note" style={{ marginTop: 16 }}>
          Airtable sync: <strong>{job.airtable_status}</strong>{job.airtable_error ? ` · ${job.airtable_error}` : ''}
          {job.airtable_status === 'failed' && <button className="av-button av-button-secondary" style={{ marginLeft: 12 }} onClick={() => airtableRetry.mutate(id)}>Retry Airtable sync</button>}
          {airtableRetry.isError && <span className="av-error-text" role="alert"> · {airtableRetry.error.message}</span>}
        </div>}
        {running ? <p className="av-panel-note" style={{ marginTop: 18 }}>This view refreshes automatically while the check is queued or running.</p> : <p className="av-panel-note" style={{ marginTop: 18 }}>Created {formatDate(job.created_at)}{job.finished_at ? ` · Finished ${formatDate(job.finished_at)}` : ''}</p>}
      </section>
      <section className="av-panel av-detail-card" style={{ marginTop: 16 }}>
        <h2 className="av-panel-title">Check coverage</h2>
        <p className="av-panel-note">This run covers {job.huts_total} hut{job.huts_total === 1 ? '' : 's'} between {job.date_from} and {job.date_to}. Manual-only huts are not scraped.</p>
      </section>
    </> : <section className="av-panel"><StateMessage title="Check not found">No check summary is available for this job ID.</StateMessage></section>}
  </main></AdminLayout>;
}

function HistoryPage({ hutKey: routeHutKey }: { hutKey: string }) {
  const params = { hutKey: routeHutKey };
  const hutKey = decodeURIComponent(params.hutKey ?? '');
  const hutsQuery = useHuts();
  const hut = hutsQuery.data?.find((item) => item.key === hutKey);
  const [night, setNight] = useState('');
  const [people, setPeople] = useState(2);
  const [queryNight, setQueryNight] = useState('');
  const [queryPeople, setQueryPeople] = useState(2);
  const history = useAvailabilityHistory(hutKey, queryNight, queryPeople, Boolean(queryNight));
  const submit = (event: FormEvent) => { event.preventDefault(); setQueryNight(night); setQueryPeople(people); };
  return <AdminLayout><main className="av-detail-shell av-enter">
    <div className="av-page-head"><div><p className="av-eyebrow">Hut record · Availability history</p><h1>{hut?.name ?? (hutsQuery.isLoading ? 'Loading hut…' : hutKey)}</h1><p>{hut ? `Cluster ${hut.cluster} · ${hut.system}` : 'Review recorded checks for this hut.'}</p></div><Link href="/admin" className="av-button av-button-secondary">← Back to availability</Link></div>
    {hutsQuery.isError ? <section className="av-panel"><ApiError message={hutsQuery.error.message} retry={() => void hutsQuery.refetch()} /></section> : null}
    <section className="av-panel av-history-controls">
      <form className="av-form-row" onSubmit={submit}>
        <div className="av-field"><label htmlFor="history-night">Night</label><input id="history-night" type="date" value={night} onChange={(e) => setNight(e.target.value)} required /></div>
        <div className="av-field"><label htmlFor="history-people">People</label><input id="history-people" type="number" min={1} max={12} value={people} onChange={(e) => setPeople(Number(e.target.value))} required /></div>
        <button className="av-button av-button-primary" type="submit" disabled={!night || people < 1 || people > 12}>View history <span aria-hidden="true">→</span></button>
      </form>
    </section>
    <section className="av-panel av-results-panel" style={{ marginTop: 16 }}>
      <div className="av-results-head"><div><h2 className="av-panel-title">Checks for {queryNight || 'selected night'} · {queryPeople} {queryPeople === 1 ? 'person' : 'people'}</h2><p className="av-panel-note">{hut?.name ?? hutKey}</p></div></div>
      {!queryNight ? <StateMessage title="Choose a night">Select a night and group size to review recorded check history.</StateMessage> : history.isLoading ? <Loading rows={4} /> : history.isError ? <ApiError message={history.error.message} retry={() => void history.refetch()} /> : history.data?.length ? <div className="av-table-scroll"><table className="av-table av-history-table"><thead><tr><th>Checked at</th><th>Status</th><th>Beds free</th><th>Details</th></tr></thead><tbody>{history.data.map((record, index) => <tr key={`${record.checked_at}-${index}`}><td>{formatDate(record.checked_at)}</td><td><span className={`av-status ${statusClass(record.status)}`}>{record.status.replace(/_/g, ' ')}</span></td><td>{record.beds_free ?? '—'}</td><td className="av-history-detail">{record.detail || '—'}</td></tr>)}</tbody></table></div> : <StateMessage title="No checks recorded">No checks have been recorded for this hut, night, and group size.</StateMessage>}
    </section>
  </main></AdminLayout>;
}

function AuthenticatedApp() {
  const session = useAdminSession();
  const [location] = useLocation();
  if (location === '/admin/login') {
    if (session.isLoading) return <LoginPage session={session} />;
    if (session.data?.authenticated) return <Redirect to="/admin" />;
    return <LoginPage session={session} />;
  }
  if (session.isLoading) return <div className="av-admin av-auth-loading"><div className="av-panel"><div className="av-skeleton short" /><div className="av-skeleton" /><div className="av-skeleton medium" /></div></div>;
  if (session.isError) return <LoginPage session={session} />;
  if (!session.data?.authenticated) return <Redirect to="/admin/login" />;
  if (location === '/admin') return <Dashboard />;
  const job = location.match(/^\/admin\/jobs\/([^/]+)$/);
  if (job) return <JobPage jobId={job[1]} />;
  const history = location.match(/^\/admin\/history\/([^/]+)$/);
  if (history) return <HistoryPage hutKey={history[1]} />;
  return <div className="av-admin"><StateMessage title="Page not found" action={<Link href="/admin" className="av-button av-button-secondary">Return to availability</Link>} /></div>;
}

function AdminApp() {
  return <AuthenticatedApp />;
}

export default AdminApp;
