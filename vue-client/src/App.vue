<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { api, type Blurb, type BlurbInput, type Cv, type SecretFinding } from './api';

const EMPTY: BlurbInput = {
  title: '', category: 'experience', body: '',
  org: '', location: '', roleTitle: '', dates: '',
  strength: 3, publicSafe: false, locked: false, tags: [],
};
const categories = ['summary', 'experience', 'skill', 'qualification', 'education'];

const blurbs = ref<Blurb[]>([]);
const cvs = ref<Cv[]>([]);
const activeCv = ref<Cv | null>(null);
const search = ref('');
const categoryFilter = ref('');

const editing = ref<BlurbInput>({ ...EMPTY });
const editingId = ref<number | null>(null);
const tagsText = ref('');
const liveFindings = ref<SecretFinding[]>([]);
const exportError = ref('');

const stars = (n: number) => '★'.repeat(n);

onMounted(async () => { await reload(); await loadCvs(); });

async function reload() {
  blurbs.value = await api.blurbs({ q: search.value, category: categoryFilter.value });
}
async function loadCvs() {
  cvs.value = await api.cvs();
  if (!activeCv.value && cvs.value.length) activeCv.value = cvs.value[0];
  else if (activeCv.value) activeCv.value = cvs.value.find(c => c.id === activeCv.value!.id) ?? cvs.value[0] ?? null;
}
function selectById(id: number) {
  activeCv.value = cvs.value.find(c => c.id === +id) ?? null;
  exportError.value = '';
}
async function newCv() {
  const name = prompt('CV name (e.g. "RQ11319 — SCOPE Senior")');
  if (!name) return;
  const cv = await api.createCv(name, '');
  cvs.value.push(cv); activeCv.value = cv;
}

const inCv = (b: Blurb) => !!activeCv.value?.items.some(i => i.blurbId === b.id);

async function addToCv(b: Blurb) {
  if (!activeCv.value || inCv(b)) return;
  await saveOrder([...activeCv.value.items.map(i => i.blurbId), b.id]);
}
async function removeFromCv(blurbId: number) {
  if (!activeCv.value) return;
  await saveOrder(activeCv.value.items.map(i => i.blurbId).filter(id => id !== blurbId));
}
async function move(idx: number, delta: number) {
  if (!activeCv.value) return;
  const ids = activeCv.value.items.map(i => i.blurbId);
  const j = idx + delta;
  if (j < 0 || j >= ids.length) return;
  [ids[idx], ids[j]] = [ids[j], ids[idx]];
  await saveOrder(ids);
}
async function saveOrder(ids: number[]) {
  exportError.value = '';
  const cv = await api.setItems(activeCv.value!.id, ids);
  activeCv.value = cv;
  cvs.value = cvs.value.map(c => c.id === cv.id ? cv : c);
}

async function exportCv() {
  if (!activeCv.value) return;
  exportError.value = '';
  try {
    const typ = await api.exportTypst(activeCv.value.id);
    download(`${activeCv.value.name}.typ`, typ);
  } catch (e: any) {
    exportError.value = e?.message ? `${e.message} (${(e.blurbs || []).join(', ')})` : 'Export failed.';
  }
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url; a.download = name.replace(/[^a-z0-9.-]+/gi, '-'); a.click();
  URL.revokeObjectURL(url);
}

function edit(b: Blurb) {
  editingId.value = b.id;
  editing.value = {
    title: b.title, category: b.category, body: b.body,
    org: b.org, location: b.location, roleTitle: b.roleTitle, dates: b.dates,
    strength: b.strength, publicSafe: b.publicSafe, locked: b.locked, tags: b.tags.map(t => t.name),
  };
  tagsText.value = b.tags.map(t => t.name).join(', ');
  liveFindings.value = b.secrets;
}
function newBlurb() {
  editingId.value = null; editing.value = { ...EMPTY }; tagsText.value = ''; liveFindings.value = [];
}
async function onBodyChange() {
  liveFindings.value = (await api.scan(editing.value.body)).findings;
}
async function redact() {
  const r = await api.scan(editing.value.body);
  editing.value.body = r.redacted; liveFindings.value = [];
}
async function save() {
  editing.value.tags = tagsText.value.split(',').map(s => s.trim()).filter(Boolean);
  if (editingId.value) await api.updateBlurb(editingId.value, editing.value);
  else await api.createBlurb(editing.value);
  newBlurb(); await reload();
}
async function remove(b: Blurb) {
  if (!confirm(`Delete "${b.title}"?`)) return;
  await api.deleteBlurb(b.id); await reload();
}

const bodyHasText = computed(() => editing.value.body.length > 0);
</script>

<template>
  <header>
    <h1>CVForge <span class="fw">Vue</span></h1>
    <p>Blurb library → CV builder → Typst export. Secret-scanned on the way in and out.</p>
  </header>

  <main>
    <!-- Blurb library -->
    <section class="panel">
      <div class="panel-head"><h2>Blurb Library</h2><button @click="newBlurb">+ New</button></div>
      <div class="filters">
        <input placeholder="search…" v-model="search" @input="reload">
        <select v-model="categoryFilter" @change="reload">
          <option value="">all categories</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <article class="blurb" v-for="b in blurbs" :key="b.id">
        <div class="blurb-top">
          <span class="cat" :class="'cat-' + b.category">{{ b.category }}</span>
          <strong>{{ b.title }}</strong>
          <span class="strength">{{ stars(b.strength) }}</span>
          <span class="locked" v-if="b.locked" title="polished — used verbatim">🔒 locked</span>
          <span class="secret" v-if="b.secrets.length">🔑 secret</span>
        </div>
        <p class="body">{{ b.body }}</p>
        <div class="tags"><span class="tag" v-for="t in b.tags" :key="t.id">{{ t.name }}</span></div>
        <div class="blurb-actions">
          <button @click="addToCv(b)" :disabled="inCv(b) || !activeCv">{{ inCv(b) ? 'in CV' : '+ add to CV' }}</button>
          <button @click="edit(b)">edit</button>
          <button class="danger" @click="remove(b)">delete</button>
        </div>
      </article>
    </section>

    <!-- CV builder -->
    <section class="panel">
      <div class="panel-head"><h2>CV Builder</h2><button @click="newCv">+ New CV</button></div>
      <select class="cv-select" :value="activeCv?.id" @change="selectById(($event.target as HTMLSelectElement).value as any)">
        <option v-for="c in cvs" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>

      <div v-if="activeCv">
        <ol class="items">
          <li v-for="(i, idx) in activeCv.items" :key="i.id">
            <span class="cat" :class="'cat-' + i.category">{{ i.category }}</span>
            <span class="item-title">{{ i.title }}</span>
            <span class="reorder">
              <button @click="move(idx, -1)" :disabled="idx === 0">↑</button>
              <button @click="move(idx, 1)" :disabled="idx === activeCv.items.length - 1">↓</button>
              <button class="danger" @click="removeFromCv(i.blurbId)">✕</button>
            </span>
          </li>
        </ol>
        <p class="empty" v-if="!activeCv.items.length">Add blurbs from the library →</p>
        <button class="export" @click="exportCv" :disabled="!activeCv.items.length">Export .typ</button>
        <p class="export-error" v-if="exportError">⛔ {{ exportError }}</p>
      </div>
    </section>

    <!-- Editor -->
    <section class="panel editor">
      <div class="panel-head"><h2>{{ editingId ? 'Edit Blurb' : 'New Blurb' }}</h2></div>
      <label>Title <input v-model="editing.title"></label>
      <label>Category
        <select v-model="editing.category">
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <div class="exp-fields" v-if="editing.category === 'experience'">
        <label>Org <input v-model="editing.org"></label>
        <label>Role <input v-model="editing.roleTitle"></label>
        <label>Dates <input v-model="editing.dates"></label>
        <label>Location <input v-model="editing.location"></label>
      </div>
      <label>Body (one bullet per line)
        <textarea rows="6" v-model="editing.body" @input="onBodyChange"></textarea>
      </label>

      <div class="scan" :class="{ bad: liveFindings.length, good: !liveFindings.length && bodyHasText }">
        <template v-if="liveFindings.length">
          🔑 {{ liveFindings.length }} secret(s):
          <code v-for="(f, i) in liveFindings" :key="i">{{ f.rule }}:{{ f.preview }}</code>
          <button @click="redact">redact all</button>
        </template>
        <span v-else-if="bodyHasText">✓ no secrets detected</span>
      </div>

      <label>Tags (comma-separated) <input v-model="tagsText"></label>
      <label class="row">Strength <input type="range" min="0" max="5" v-model.number="editing.strength"> {{ editing.strength }}</label>
      <label class="row"><input type="checkbox" v-model="editing.locked"> 🔒 locked — polished wording, use verbatim (don't let an AI reword)</label>
      <label class="row"><input type="checkbox" v-model="editing.publicSafe"> mark public-safe (blocked while secrets present)</label>

      <div class="editor-actions">
        <button class="primary" @click="save" :disabled="!editing.title">{{ editingId ? 'Save' : 'Create' }}</button>
        <button @click="newBlurb">clear</button>
      </div>
    </section>
  </main>
</template>
