import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
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
/** Which pane the right-hand column is showing. */
type Tab = 'builder' | 'editor';
/** Everything the editor holds for one blurb, so it can be set aside and resumed. */
interface EditorSession {
  id: number | null;
  editing: BlurbInput;
  tagsText: string;
  liveFindings: SecretFinding[];
  draftChosen: boolean;
  cleanState: string;
}
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
  categories = ['summary', 'experience', 'project', 'skill', 'qualification', 'education'];
  /** Skill blurbs bucketed by skillGroup, in the order the API returned them. */
  skillGroups: SkillGroupRow[] = [];
  /** Everything that isn't an atomic skill, listed one per blurb. */
  looseBlurbs: Blurb[] = [];
  tab: Tab = 'builder';
  // editor state
  editing: BlurbInput = { ...EMPTY };
  editingId: number | null = null;
  tagsText = '';
  liveFindings: SecretFinding[] = [];
  saving = false;
  /** The form as last loaded or saved; Save stays disabled until the form differs from it. */
  private cleanState = this.formState();
  /** Forms with unsaved edits that aren't open in the editor, keyed by blurb id ('new' for one not yet created). */
  private unsaved = new Map<number | 'new', EditorSession>();
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
  /**
   * Expanding a blurb also opens it in the editor. Collapsing it again leaves the editor alone,
   * so clicking a selected row to tidy the list doesn't throw away what's loaded there.
   */
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
  toggleInCv(b: Blurb) {
    if (!this.activeCv) return;
    if (this.inCv(b)) this.removeFromCv(b.id); else this.addToCv(b);
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
      error: err => {
        // responseType 'text' leaves the error body as a raw string, hiding the server's message
        let body = err.error;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
        this.exportError = body?.message
          ? `${body.message} (${(body.blurbs || []).join(', ')})` : 'Export failed.';
      },
    });
  }
  private download(name: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = name.replace(/[^a-z0-9.-]+/gi, '-'); a.click();
    URL.revokeObjectURL(url);
  }
  // ---- editor ----
  /** Open a blurb in the editor, resuming any unsaved edits to it, and bring the Editor tab forward. */
  edit(b: Blurb) {
    this.tab = 'editor';
    if (this.editingId === b.id) return;
    this.park();
    if (this.resume(b.id)) return;
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
    this.cleanState = this.formState();
  }
  /** The library's "+ New": open the new-blurb form, resuming an unsaved one if there is one. */
  newBlurb() {
    this.tab = 'editor';
    if (this.editingId === null) return;
    this.park();
    this.openNew();
  }
  /** Blank new-blurb form, discarding any unsaved new blurb; edits to existing blurbs are parked. */
  clear() {
    this.park();
    this.unsaved.delete('new');
    this.resetEditor();
  }
  /** Back to the last saved values — throws away the open form's unsaved edits and parked copy. */
  discard() {
    this.unsaved.delete(this.editingId ?? 'new');
    if (this.editingId === null) { this.resetEditor(); return; }
    const [editing, tagsText] = JSON.parse(this.cleanState);
    this.editing = editing;
    this.tagsText = tagsText;
    this.draftChosen = false;
    const target = this.editing, body = this.editing.body;
    this.api.scan(body).subscribe(r => {
      if (this.editing === target && this.editing.body === body) this.liveFindings = r.findings;
    });
  }
  private openNew() { if (!this.resume('new')) this.resetEditor(); }
  private resetEditor() {
    this.editingId = null; this.editing = { ...EMPTY }; this.tagsText = ''; this.liveFindings = [];
    this.draftChosen = false;
    this.cleanState = this.formState();
  }
  /** Set the open form aside if it has unsaved edits, so switching away loses nothing. */
  private park() {
    if (!this.dirty) return;
    this.unsaved.set(this.editingId ?? 'new', {
      id: this.editingId, editing: this.editing, tagsText: this.tagsText,
      liveFindings: this.liveFindings, draftChosen: this.draftChosen, cleanState: this.cleanState,
    });
  }
  private resume(key: number | 'new'): boolean {
    const s = this.unsaved.get(key);
    if (!s) return false;
    this.unsaved.delete(key);
    this.editingId = s.id;
    this.editing = s.editing;
    this.tagsText = s.tagsText;
    this.liveFindings = s.liveFindings;
    this.draftChosen = s.draftChosen;
    this.cleanState = s.cleanState;
    return true;
  }
  get dirty() { return this.formState() !== this.cleanState; }
  /** Whether a blurb has unsaved edits, open in the editor or parked. */
  isUnsaved(b: Blurb) { return this.editingId === b.id ? this.dirty : this.unsaved.has(b.id); }
  get newUnsaved() { return this.editingId === null ? this.dirty : this.unsaved.has('new'); }
  /** Unsaved edits anywhere — open in the editor or parked. */
  get anyUnsaved() { return this.dirty || this.unsaved.size > 0; }
  @HostListener('window:beforeunload', ['$event'])
  warnIfUnsaved(e: BeforeUnloadEvent) {
    if (!this.dirty && !this.unsaved.size) return;
    e.preventDefault();
    e.returnValue = ''; // older browsers only prompt when this is set
  }
  private formState() { return this.serialize(this.editing, this.tagsText); }
  private serialize(editing: BlurbInput, tagsText: string) { return JSON.stringify([editing, tagsText]); }
  /**
   * A human rewording what renders on the CV (body, org, role, dates, location) makes it theirs:
   * untick draft live, visibly, before saving — unless they set the checkbox by hand this session.
   * Internal metadata (title, tags, strength, skill group) and "redact all" don't claim authorship.
   */
  markEdited() { if (!this.draftChosen) this.editing.draft = false; }
  setDraft(draft: boolean) { this.editing.draft = draft; this.draftChosen = true; }
  onBodyChange() {
    this.markEdited();
    // a response landing after a blurb switch, or after further typing, must not touch the open form
    const target = this.editing, body = this.editing.body;
    this.api.scan(body).subscribe(r => {
      if (this.editing === target && this.editing.body === body) this.liveFindings = r.findings;
    });
  }
  redact() {
    const target = this.editing, body = this.editing.body;
    this.api.scan(body).subscribe(r => {
      if (this.editing === target && this.editing.body === body) {
        this.editing.body = r.redacted;
        this.liveFindings = [];
      }
    });
  }
  save() {
    this.editing.tags = this.tagsText.split(',').map(s => s.trim()).filter(Boolean);
    const target = this.editing;
    const sent = this.formState();
    const req = this.editingId
      ? this.api.updateBlurb(this.editingId, this.editing)
      : this.api.createBlurb(this.editing);
    this.saving = true;
    req.pipe(finalize(() => this.saving = false)).subscribe(saved => {
      if (this.editing === target) {
        this.editingId = saved.id;
        this.cleanState = sent;
      } else {
        this.settleParked(target, saved.id, sent);
      }
      this.reload();
    });
  }
  /** A save that finished after its form was parked: re-key the parked form, and drop it if it's now clean. */
  private settleParked(editing: BlurbInput, id: number, sent: string) {
    for (const [key, s] of this.unsaved) {
      if (s.editing !== editing) continue;
      this.unsaved.delete(key);
      s.id = id;
      s.cleanState = sent;
      if (this.serialize(s.editing, s.tagsText) !== sent) this.unsaved.set(id, s);
      return;
    }
  }
  remove(b: Blurb) {
    if (!confirm(`Delete "${b.title}"?`)) return;
    this.api.deleteBlurb(b.id).subscribe(() => {
      this.unsaved.delete(b.id);
      if (this.editingId === b.id) this.openNew(); // avoid orphaned edits
      if (this.selectedBlurbId === b.id) this.selectedBlurbId = null;
      this.reload();
    });
  }
}