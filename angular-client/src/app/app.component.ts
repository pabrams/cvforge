import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Blurb, BlurbInput, Cv, SecretFinding } from './api.service';

const EMPTY: BlurbInput = {
  title: '', category: 'experience', body: '',
  org: '', location: '', roleTitle: '', dates: '',
  skillGroup: '', archived: false,
  strength: 3, publicSafe: false, draft: false, tags: [],
};

/** One rendered "*Databases:* a · b · c" line's worth of atomic skills. */
interface SkillGroupRow { group: string; blurbs: Blurb[]; }

/** A CV row: either one blurb, or a whole skill group collapsed into a single line. */
interface CvRow { group: string | null; label: string; category: string; blurbIds: number[]; }

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  blurbs: Blurb[] = [];
  cvs: Cv[] = [];
  activeCv: Cv | null = null;

  search = '';
  categoryFilter = '';
  showArchived = false;
  selectedBlurbId: number | null = null;
  rightTab: 'builder' | 'editor' = 'builder';
  categories = ['summary', 'experience', 'project', 'skill', 'qualification', 'education'];

  /** Skill blurbs bucketed by skillGroup, in the order the API returned them. */
  skillGroups: SkillGroupRow[] = [];
  /** Everything that isn't an atomic skill, listed one per blurb. */
  looseBlurbs: Blurb[] = [];

  // editor state
  editing: BlurbInput = { ...EMPTY };
  editingId: number | null = null;
  tagsText = '';
  liveFindings: SecretFinding[] = [];
  exportError = '';
  /** True once the user has ticked/unticked "draft" by hand; typing then no longer overrides it. */
  private draftChosen = false;

  constructor(private api: ApiService) {}

  ngOnInit() { this.reload(); this.loadCvs(); }

  reload() {
    this.api.blurbs({ q: this.search, category: this.categoryFilter, includeArchived: this.showArchived })
      .subscribe(b => { this.blurbs = b; this.regroup(); });
  }

  /**
   * Atomic skills are listed under their rendered group rather than as 130-odd separate rows,
   * so the library reads the way the exported CV does and a whole line can be added at once.
   * A skill with no group predates atomization and stays a loose row.
   */
  private regroup() {
    const groups = new Map<string, Blurb[]>();
    this.looseBlurbs = [];
    for (const b of this.blurbs) {
      if (b.category === 'skill' && b.skillGroup) {
        const list = groups.get(b.skillGroup) ?? [];
        list.push(b);
        groups.set(b.skillGroup, list);
      } else {
        this.looseBlurbs.push(b);
      }
    }
    this.skillGroups = [...groups].map(([group, blurbs]) => ({ group, blurbs }));
  }

  loadCvs() {
    this.api.cvs().subscribe(c => {
      this.cvs = c;
      if (!this.activeCv && c.length) this.select(c[0]);
      else if (this.activeCv) this.activeCv = c.find(x => x.id === this.activeCv!.id) ?? c[0] ?? null;
    });
  }

  /** One click both expands the row and loads it into the editor; a second click just collapses. */
  selectBlurb(b: Blurb) {
    if (this.selectedBlurbId === b.id) { this.selectedBlurbId = null; return; }
    this.selectedBlurbId = b.id;
    this.edit(b);
  }

  select(cv: Cv) { this.exportError = ''; this.activeCv = cv; }
  selectById(id: number) { const cv = this.cvs.find(c => c.id === +id); if (cv) this.select(cv); }

  newCv() {
    const name = prompt('CV name (e.g. "RQ11319 — SCOPE Senior")');
    if (!name) return;
    this.api.createCv(name, '').subscribe(cv => { this.cvs.push(cv); this.select(cv); });
  }

  inCv(b: Blurb) { return !!this.activeCv?.items.some(i => i.blurbId === b.id); }

  /** How many of a group's skills the active CV already has. */
  groupInCv(g: SkillGroupRow) { return g.blurbs.filter(b => this.inCv(b)).length; }

  addToCv(b: Blurb) {
    if (!this.activeCv || this.inCv(b)) return;
    this.saveOrder([...this.activeCv.items.map(i => i.blurbId), b.id]);
  }

  addGroupToCv(g: SkillGroupRow) {
    if (!this.activeCv) return;
    const missing = g.blurbs.filter(b => !this.inCv(b)).map(b => b.id);
    if (missing.length) this.saveOrder([...this.activeCv.items.map(i => i.blurbId), ...missing]);
  }

  removeFromCv(blurbId: number) {
    if (!this.activeCv) return;
    this.saveOrder(this.activeCv.items.map(i => i.blurbId).filter(id => id !== blurbId));
  }

  removeRow(row: CvRow) {
    if (!this.activeCv) return;
    const drop = new Set(row.blurbIds);
    this.saveOrder(this.activeCv.items.map(i => i.blurbId).filter(id => !drop.has(id)));
  }

  /**
   * Rows, not items: a skill group is one row however many atoms it holds, so a CV with 100
   * items still shows ~20 lines and reordering moves a whole rendered line at a time.
   */
  get cvRows(): CvRow[] {
    const rows: CvRow[] = [];
    for (const i of this.activeCv?.items ?? []) {
      const group = i.category === 'skill' ? (i.skillGroup ?? null) : null;
      const last = rows[rows.length - 1];
      if (group && last?.group === group) {
        last.blurbIds.push(i.blurbId);
        last.label = `${group} (${last.blurbIds.length})`;
        continue;
      }
      rows.push({
        group,
        label: group ? `${group} (1)` : i.title,
        category: i.category,
        blurbIds: [i.blurbId],
      });
    }
    return rows;
  }

  moveRow(idx: number, delta: number) {
    if (!this.activeCv) return;
    const rows = this.cvRows;
    const j = idx + delta;
    if (j < 0 || j >= rows.length) return;
    [rows[idx], rows[j]] = [rows[j], rows[idx]];
    this.saveOrder(rows.flatMap(r => r.blurbIds));
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
    this.rightTab = 'editor';
    this.editingId = b.id;
    this.editing = {
      title: b.title, category: b.category, body: b.body,
      org: b.org, location: b.location, roleTitle: b.roleTitle, dates: b.dates,
      skillGroup: b.skillGroup ?? '', archived: b.archived,
      strength: b.strength, publicSafe: b.publicSafe, draft: b.draft, tags: b.tags.map(t => t.name),
    };
    this.tagsText = b.tags.map(t => t.name).join(', ');
    this.liveFindings = b.secrets;
    this.draftChosen = false;
  }
  newBlurb() {
    this.rightTab = 'editor';
    this.editingId = null; this.editing = { ...EMPTY }; this.tagsText = ''; this.liveFindings = [];
    this.draftChosen = false;
  }

  /**
   * A human rewording what renders on the CV (body, org, role, dates, location) makes it theirs:
   * untick draft live, visibly, before saving — unless they set the checkbox by hand this session.
   * Internal metadata (title, tags, strength, skill group) and "redact all" don't claim authorship.
   */
  markEdited() { if (!this.draftChosen) this.editing.draft = false; }
  setDraft(draft: boolean) { this.editing.draft = draft; this.draftChosen = true; }

  onBodyChange() {
    this.markEdited();
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
    this.api.deleteBlurb(b.id).subscribe(() => {
      // Selecting a blurb loads it into the editor, so deleting the loaded one would leave the
      // editor pointing at a dead id (its next save would 404).
      if (this.editingId === b.id) {
        this.editingId = null; this.editing = { ...EMPTY }; this.tagsText = ''; this.liveFindings = [];
        this.draftChosen = false;
      }
      if (this.selectedBlurbId === b.id) this.selectedBlurbId = null;
      this.reload();
    });
  }
}
