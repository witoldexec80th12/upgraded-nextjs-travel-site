import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface AdminSession {
  authenticated: boolean;
  csrf_token: string;
}

export interface Hut {
  key: string;
  name: string;
  cluster: string;
  system: string;
  active: boolean;
  booking_url: string | null;
  notes: string | null;
}

export interface AvailabilityRecord {
  hut_key: string;
  name: string;
  cluster: string;
  booking_url: string;
  night: string;
  people: number;
  status: string;
  beds_free: number | null;
  detail: string | null;
  checked_at: string;
}

export interface CheckSummary {
  job_id: number;
  date_from: string;
  date_to: string;
  people: number;
  status: string;
  huts_done: number;
  huts_total: number;
  error: string | null;
  airtable_status: string;
  airtable_error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface SweepSettings {
  enabled: boolean;
  date_from: string;
  date_to: string;
  people: number;
  timezone: string;
  run_at: string;
  spreadsheet_id: string | null;
  spreadsheet_url: string | null;
}

export interface SweepRunSummary {
  run_id: number;
  run_date: string;
  date_from: string;
  date_to: string;
  people: number;
  status: string;
  sheets_status: string;
  sheets_error: string | null;
  error: string | null;
  huts_total: number;
  huts_done: number;
  manual_huts: number;
  batches_total: number;
  batches_done: number;
  batches_failed: number;
  error_count: number;
  created_at: string;
  finished_at: string | null;
}

export interface SweepPilotRequest {
  date_from: string;
  date_to: string;
  people: number;
}

export interface SweepPilotResponse {
  run_id: number;
  run_date: string;
  date_from: string;
  date_to: string;
  people: number;
  status: string;
  queued_batches: number;
  huts_total: number;
  manual_huts: number;
  schedule_enabled: false;
}

export interface AvailabilityFilters {
  date_from: string;
  date_to: string;
  people: number;
  cluster?: string;
}

export interface StartCheckRequest extends AvailabilityFilters {
  huts?: string[];
  clusters?: string[];
  force?: boolean;
}

interface CheckStarted {
  job_id: number;
  status: string;
}

const configuredOrigin = process.env.NEXT_PUBLIC_AVAILABILITY_API_URL?.trim();
const apiOrigin = configuredOrigin ? configuredOrigin.replace(/\/+$/, '') : '';
let csrfToken: string | null = null;

function url(path: string): string {
  return `${apiOrigin}${path}`;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url(path), {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (response.ok && !contentType.includes('application/json')) {
    throw new Error(
      'The admin API returned a web page instead of JSON. Check AVAILABILITY_API_URL on the Next.js host, then redeploy.',
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // Keep the status-based message when the server did not return JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export async function fetchAdminSession(): Promise<AdminSession> {
  const session = await requestJson<AdminSession>('/admin/auth/session');
  csrfToken = session.csrf_token;
  return session;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (!csrfToken) await fetchAdminSession();
  return requestJson<T>(path, {
    method: 'POST',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
    body: JSON.stringify(body),
  });
}

export async function loginAdmin(apiKey: string, token: string): Promise<AdminSession> {
  const session = await requestJson<AdminSession>('/admin/auth/login', {
    method: 'POST',
    headers: { 'X-CSRF-Token': token },
    body: JSON.stringify({ api_key: apiKey, csrf_token: token }),
  });
  csrfToken = session.csrf_token;
  return session;
}

export async function logoutAdmin(): Promise<void> {
  await postJson('/admin/auth/logout', { csrf_token: csrfToken });
  csrfToken = null;
}

export async function fetchHuts(): Promise<Hut[]> {
  return requestJson<Hut[]>('/api/huts');
}

export async function fetchAvailability(filters: AvailabilityFilters): Promise<AvailabilityRecord[]> {
  return requestJson<AvailabilityRecord[]>(`/api/availability?${queryString({ ...filters })}`);
}

export async function fetchRecentChecks(limit = 10): Promise<CheckSummary[]> {
  return requestJson<CheckSummary[]>(`/api/checks?${queryString({ limit })}`);
}

export async function fetchCheckStatus(jobId: number): Promise<CheckSummary> {
  return requestJson<CheckSummary>(`/api/checks/${jobId}`);
}

export async function fetchSweepSettings(): Promise<SweepSettings> {
  return requestJson<SweepSettings>('/api/sweep/settings');
}

export async function fetchLatestSweep(): Promise<SweepRunSummary | null> {
  return requestJson<SweepRunSummary | null>('/api/sweep/latest');
}

export async function saveSweepSettings(settings: Omit<SweepSettings, 'spreadsheet_id' | 'spreadsheet_url'>): Promise<SweepSettings> {
  return postJson<SweepSettings>('/api/sweep/settings', settings);
}

export async function setupSweepSheets(): Promise<SweepSettings> {
  return postJson<SweepSettings>('/api/sweep/sheets/setup', {});
}

export async function startSweepPilot(
  request: SweepPilotRequest,
): Promise<SweepPilotResponse> {
  return postJson<SweepPilotResponse>('/api/sweep/pilot', request);
}

export async function retrySweep(runId: number): Promise<void> {
  await postJson(`/api/sweep/runs/${runId}/retry`, {});
}

export async function retrySweepSheets(runId: number): Promise<void> {
  await postJson(`/api/sweep/runs/${runId}/sheets-retry`, {});
}

export async function retryAirtableSync(jobId: number): Promise<void> {
  await postJson(`/api/checks/${jobId}/airtable-sync`, {});
}

export async function fetchAvailabilityHistory(
  hutKey: string,
  night: string,
  people: number,
): Promise<AvailabilityRecord[]> {
  const query = queryString({ hut: hutKey, night, people });
  return requestJson<AvailabilityRecord[]>(`/api/availability/history?${query}`);
}

export async function startAvailabilityCheck(
  request: StartCheckRequest,
): Promise<CheckStarted> {
  const { cluster: _cluster, ...body } = request;
  return postJson<CheckStarted>('/api/checks', body);
}

export function getCsvExportUrl(filters: AvailabilityFilters): string {
  const query = queryString({ ...filters });
  return url(`/admin/export.csv?${query}`);
}

export function useAdminSession() {
  return useQuery({
    queryKey: ['admin', 'session'],
    queryFn: fetchAdminSession,
    staleTime: 15_000,
    retry: false,
  });
}

export function useHuts(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'huts'],
    queryFn: fetchHuts,
    enabled,
    staleTime: 60_000,
  });
}

export function useAvailability(filters: AvailabilityFilters, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'availability', filters],
    queryFn: () => fetchAvailability(filters),
    enabled,
  });
}

export function useRecentChecks(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'checks', 'recent'],
    queryFn: () => fetchRecentChecks(),
    enabled,
    refetchInterval: 5_000,
  });
}

export function useSweepSettings() {
  return useQuery({
    queryKey: ['admin', 'sweep', 'settings'],
    queryFn: fetchSweepSettings,
    staleTime: 15_000,
  });
}

export function useLatestSweep() {
  return useQuery({
    queryKey: ['admin', 'sweep', 'latest'],
    queryFn: fetchLatestSweep,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 5_000 : 15_000;
    },
  });
}

export function useCheckStatus(jobId: number, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'checks', jobId],
    queryFn: () => fetchCheckStatus(jobId),
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const airtable = query.state.data?.airtable_status;
      return status === 'queued' || status === 'running' || airtable === 'pending' || airtable === 'syncing' ? 2_000 : false;
    },
  });
}

export function useAvailabilityHistory(
  hutKey: string,
  night: string,
  people: number,
  enabled = true,
) {
  return useQuery({
    queryKey: ['admin', 'history', hutKey, night, people],
    queryFn: () => fetchAvailabilityHistory(hutKey, night, people),
    enabled: enabled && Boolean(hutKey && night),
  });
}

export function useAdminLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ apiKey, token }: { apiKey: string; token: string }) =>
      loginAdmin(apiKey, token),
    onSuccess: (session) => {
      queryClient.setQueryData(['admin', 'session'], session);
    },
  });
}

export function useAdminLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutAdmin,
    onSuccess: () => {
      queryClient.setQueryData(['admin', 'session'], {
        authenticated: false,
        csrf_token: '',
      } satisfies AdminSession);
    },
  });
}

export function useStartAvailabilityCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startAvailabilityCheck,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'checks', 'recent'] });
    },
  });
}

function useSweepMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'sweep'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'checks'] });
    },
  });
}

export function useSaveSweepSettings() {
  return useSweepMutation(saveSweepSettings);
}

export function useSetupSweepSheets() {
  return useSweepMutation(setupSweepSheets);
}

export function useRunSweepPilot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startSweepPilot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'sweep'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'checks'] });
    },
  });
}

export function useRetrySweep() {
  return useSweepMutation(retrySweep);
}

export function useRetrySweepSheets() {
  return useSweepMutation(retrySweepSheets);
}

export function useRetryAirtableSync() {
  return useSweepMutation(retryAirtableSync);
}
