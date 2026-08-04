import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Blurb, BlurbInput, Cv, SecretFinding } from './api.service';

const EMPTY: BlurbInput = {
  title: '', category: 'experience', body: '',
  org: '', location: '', roleTitle: '', dates: '',
  strength: 3, publicSafe: false, locked: false, tags: [],
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  blurbs: Blurb[] = [];
  cvs: Cv[] = [];
  activeCv: Cv | null = null;

  search = '';
  categoryFilter = '';
  selectedBlurbId: number | null = null;
  categories = ['summary', 'competencies', 'experience', 'skill', 'qualification', 'education'];

  // editor state
  editing: BlurbInput = { ...EMPTY };
  editingId: number | null = null;
  tagsText = '';
  liveFindings: SecretFinding[] = [];
  exportError = '';

  constructor(private api: ApiService) {}

  ngOnInit() { this.reload(); this.loadCvs(); }

  reload() {
    this.api.blurbs({ q: this.search, category: this.categoryFilter })
      .subscribe(b => this.blurbs = b);
  }

  loadCvs() {
    this.api.cvs().subscribe(c => {
      this.cvs = c;
      if (!this.activeCv && c.length) this.select(c[0]);
      else if (this.activeCv) this.activeCv = c.find(x => x.id === this.activeCv!.id) ?? c[0] ?? null;
    });
  }

  selectBlurb(b: Blurb) { this.selectedBlurbId = this.selectedBlurbId === b.id ? null : b.id; }

  select(cv: Cv) { this.exportError = ''; this.activeCv = cv; }
  selectById(id: number) { const cv = this.cvs.find(c => c.id === +id); if (cv) this.select(cv); }

  newCv() {
    const name = prompt('CV name (e.g. "RQ11319 — SCOPE Senior")');
    if (!name) return;
    this.api.createCv(name, '').subscribe(cv => { this.cvs.push(cv); this.select(cv); });
  }

  inCv(b: Blurb) { return !!this.activeCv?.items.some(i => i.blurbId === b.id); }

  addToCv(b: Blurb) {
    if (!this.activeCv || this.inCv(b)) return;
    const ids = [...this.activeCv.items.map(i => i.blurbId), b.id];
    this.saveOrder(ids);
  }
  removeFromCv(blurbId: number) {
    if (!this.activeCv) return;
    this.saveOrder(this.activeCv.items.map(i => i.blurbId).filter(id => id !== blurbId));
  }
  move(idx: number, delta: number) {
    if (!this.activeCv) return;
    const ids = this.activeCv.items.map(i => i.blurbId);
    const j = idx + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    this.saveOrder(ids);
  }
  private saveOrder(ids: number[]) {
    this.exportError = '';
    this.api.setItems(this.activeCv!.id, ids).subscribe(cv => {
      this.activeCv = cv;
      this.cvs = this.cvs.map(c => c.id === cv.id ? cv : c);
    });
  }

  export() {
    if (!this.activeCv) return;
    this.exportError = '';
    this.api.exportTypst(this.activeCv.id).subscribe({
      next: typ => this.download(`${this.activeCv!.name}.typ`, typ),
      error: err => this.exportError = err.error?.message
        ? `${err.error.message} (${(err.error.blurbs || []).join(', ')})` : 'Export failed.',
    });
  }
  private download(name: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = name.replace(/[^a-z0-9.-]+/gi, '-'); a.click();
    URL.revokeObjectURL(url);
  }

  // ---- editor ----
  edit(b: Blurb) {
    this.editingId = b.id;
    this.editing = {
      title: b.title, category: b.category, body: b.body,
      org: b.org, location: b.location, roleTitle: b.roleTitle, dates: b.dates,
      strength: b.strength, publicSafe: b.publicSafe, locked: b.locked, tags: b.tags.map(t => t.name),
    };
    this.tagsText = b.tags.map(t => t.name).join(', ');
    this.liveFindings = b.secrets;
  }
  newBlurb() { this.editingId = null; this.editing = { ...EMPTY }; this.tagsText = ''; this.liveFindings = []; }

  onBodyChange() {
    this.api.scan(this.editing.body).subscribe(r => this.liveFindings = r.findings);
  }
  redact() {
    this.api.scan(this.editing.body).subscribe(r => { this.editing.body = r.redacted; this.liveFindings = []; });
  }

  save() {
    this.editing.tags = this.tagsText.split(',').map(s => s.trim()).filter(Boolean);
    const req = this.editingId
      ? this.api.updateBlurb(this.editingId, this.editing)
      : this.api.createBlurb(this.editing);
    req.subscribe(() => { this.newBlurb(); this.reload(); });
  }
  remove(b: Blurb) {
    if (!confirm(`Delete "${b.title}"?`)) return;
    this.api.deleteBlurb(b.id).subscribe(() => this.reload());
  }
}
