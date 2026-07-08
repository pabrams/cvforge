export const API_BASE = 'http://localhost:5170/api';

export interface SecretFinding { rule: string; preview: string; index: number; length: number; }
export interface Tag { id: number; name: string; kind: string; }
export interface Blurb {
  id: number; title: string; category: string; body: string;
  org?: string; location?: string; roleTitle?: string; dates?: string;
  strength: number; publicSafe: boolean; tags: Tag[]; secrets: SecretFinding[];
}
export interface BlurbInput {
  title: string; category: string; body: string;
  org?: string; location?: string; roleTitle?: string; dates?: string;
  strength: number; publicSafe: boolean; tags: string[];
}
export interface CvItem { id: number; blurbId: number; order: number; title: string; category: string; }
export interface Cv { id: number; name: string; tagline: string; roleNotes: string; items: CvItem[]; }
export interface ScanResult { findings: SecretFinding[]; redacted: string; clean: boolean; }

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await res.json().catch(() => ({ message: res.statusText }));
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  blurbs(params: { category?: string; q?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.q) qs.set('q', params.q);
    return fetch(`${API_BASE}/blurbs?${qs}`).then(json<Blurb[]>);
  },
  createBlurb(b: BlurbInput) {
    return fetch(`${API_BASE}/blurbs`, post(b)).then(json<Blurb>);
  },
  updateBlurb(id: number, b: BlurbInput) {
    return fetch(`${API_BASE}/blurbs/${id}`, put(b)).then(json<Blurb>);
  },
  deleteBlurb(id: number) {
    return fetch(`${API_BASE}/blurbs/${id}`, { method: 'DELETE' }).then(json<void>);
  },
  cvs() { return fetch(`${API_BASE}/cvs`).then(json<Cv[]>); },
  createCv(name: string, tagline: string) {
    return fetch(`${API_BASE}/cvs`, post({ name, tagline, roleNotes: '' })).then(json<Cv>);
  },
  setItems(cvId: number, blurbIds: number[]) {
    return fetch(`${API_BASE}/cvs/${cvId}/items`, put({ blurbIds })).then(json<Cv>);
  },
  async exportTypst(cvId: number) {
    const res = await fetch(`${API_BASE}/cvs/${cvId}/export.typ`);
    if (!res.ok) throw await res.json().catch(() => ({ message: 'Export failed.' }));
    return res.text();
  },
  scan(text: string) { return fetch(`${API_BASE}/scan`, post({ text })).then(json<ScanResult>); },
};

function post(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function put(body: unknown): RequestInit {
  return { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
