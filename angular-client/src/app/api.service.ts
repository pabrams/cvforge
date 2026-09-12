import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export const API_BASE = 'http://localhost:5170/api';

export interface SecretFinding { rule: string; preview: string; index: number; length: number; }
export interface Tag { id: number; name: string; kind: string; }
export interface Blurb {
  id: number; title: string; category: string; body: string;
  org?: string; location?: string; roleTitle?: string; dates?: string;
  skillGroup?: string | null; archived: boolean;
  strength: number; publicSafe: boolean; locked: boolean; tags: Tag[]; secrets: SecretFinding[];
}
export interface BlurbInput {
  title: string; category: string; body: string;
  org?: string; location?: string; roleTitle?: string; dates?: string;
  skillGroup?: string | null; archived: boolean;
  strength: number; publicSafe: boolean; locked: boolean; tags: string[];
}
export interface CvItem {
  id: number; blurbId: number; order: number; title: string; category: string;
  skillGroup?: string | null;
}
export interface Cv { id: number; name: string; tagline: string; roleNotes: string; items: CvItem[]; }
export interface ScanResult { findings: SecretFinding[]; redacted: string; clean: boolean; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  blurbs(params: { category?: string; tag?: string; q?: string; group?: string; includeArchived?: boolean } = {})
    : Observable<Blurb[]> {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.tag) qs.set('tag', params.tag);
    if (params.q) qs.set('q', params.q);
    if (params.group) qs.set('group', params.group);
    if (params.includeArchived) qs.set('includeArchived', 'true');
    return this.http.get<Blurb[]>(`${API_BASE}/blurbs?${qs}`);
  }
  createBlurb(b: BlurbInput) { return this.http.post<Blurb>(`${API_BASE}/blurbs`, b); }
  updateBlurb(id: number, b: BlurbInput) { return this.http.put<Blurb>(`${API_BASE}/blurbs/${id}`, b); }
  deleteBlurb(id: number) { return this.http.delete(`${API_BASE}/blurbs/${id}`); }

  tags() { return this.http.get<Tag[]>(`${API_BASE}/tags`); }

  cvs() { return this.http.get<Cv[]>(`${API_BASE}/cvs`); }
  createCv(name: string, tagline: string) {
    return this.http.post<Cv>(`${API_BASE}/cvs`, { name, tagline, roleNotes: '' });
  }
  setItems(cvId: number, blurbIds: number[]) {
    return this.http.put<Cv>(`${API_BASE}/cvs/${cvId}/items`, { blurbIds });
  }
  exportUrl(cvId: number) { return `${API_BASE}/cvs/${cvId}/export.typ`; }
  exportTypst(cvId: number) {
    return this.http.get(this.exportUrl(cvId), { responseType: 'text' });
  }

  scan(text: string) { return this.http.post<ScanResult>(`${API_BASE}/scan`, { text }); }
}
