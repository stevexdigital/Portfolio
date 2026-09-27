import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

// ---- EDIT THESE TWO LINES with your Supabase project's values (same as index.html) ----
const SUPABASE_URL = 'https://vqthioychxlqknfwboqk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pD_0O9o-4s6hzKh4wUFuRg_y6MoUoF8';
// -----------------------------------------------------------------------------------------

// The login session lives in sessionStorage, not localStorage: it's gone when the tab closes and isn't
// shared with other tabs, which shrinks the window in which a stolen token is useful.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true }
});
// Clean up any long-lived session left in localStorage by earlier versions of this page
try { Object.keys(localStorage).filter(k => /^sb-.*-auth-token$/.test(k)).forEach(k => localStorage.removeItem(k)); } catch(e){}

// ---------- THEME TOGGLE ----------
const themeToggleBtn = document.getElementById('theme-toggle');
function applyTheme(mode){
  document.documentElement.classList.toggle('dark', mode === 'dark');
  themeToggleBtn.setAttribute('aria-pressed', String(mode === 'dark'));
}
applyTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light'); // set before paint in <head>
themeToggleBtn.addEventListener('click', () => {
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('cms-theme', next); } catch(e){}
});

// ---------- CONFIRMATION MODAL (replaces the browser's confirm() for destructive actions) ----------
const confirmDialog = document.getElementById('confirm-dialog');
function confirmAction({ title = 'Are you sure?', message = "This can't be undone.", confirmLabel = 'Delete' } = {}){
  return new Promise(resolve => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-ok').textContent = confirmLabel;
    confirmDialog.returnValue = '';
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'confirm'), { once: true });
    confirmDialog.showModal();
    document.getElementById('confirm-cancel').focus(); // safe default: Enter cancels
  });
}
confirmDialog.addEventListener('click', (e) => { if (e.target === confirmDialog) confirmDialog.close('cancel'); }); // backdrop click

// ---------- COPY TO CLIPBOARD ----------
async function copyText(text){
  try { await navigator.clipboard.writeText(text); return true; }
  catch(e){
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch(e2){ return false; }
  }
}

// ---------- PASSWORD VISIBILITY ----------
document.getElementById('password-toggle').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const input = document.getElementById('login-password');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', String(show));
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  input.focus();
});

const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const errorMsg = document.getElementById('error-msg');

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- AUTH ----------
// Real protection is in the database (row level security only lets admins read/write), but we also
// refuse to show the admin UI to a signed-in account that isn't on the admin list.
async function checkSession(){
  const { data: { session } } = await supabase.auth.getSession();
  if (session){
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
    if (adminError || isAdmin !== true){
      await supabase.auth.signOut();
      loginScreen.style.display = 'block';
      appShell.style.display = 'none';
      errorMsg.textContent = "This account doesn't have admin access.";
      return;
    }
    loginScreen.style.display = 'none';
    appShell.style.display = 'flex';
    document.getElementById('whoami').textContent = session.user.email;
    await loadAll();
    restorePanelFromHash();
  } else {
    loginScreen.style.display = 'block';
    appShell.style.display = 'none';
  }
}

loginScreen.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.textContent = '';
  const loginBtn = document.getElementById('login-btn');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  loginBtn.disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  loginBtn.disabled = false;
  // Same message for every failure, so the form can't be used to check which emails have accounts
  if (error){ errorMsg.textContent = error.status === 429 ? 'Too many attempts — please wait a few minutes and try again.' : 'Incorrect email or password.'; return; }
  // Never leave the password readable on screen after logging in
  document.getElementById('login-password').value = '';
  document.getElementById('login-password').type = 'password';
  document.getElementById('password-toggle').setAttribute('aria-pressed', 'false');
  document.getElementById('password-toggle').setAttribute('aria-label', 'Show password');
  checkSession();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  checkSession();
});

// ---------- NAV ----------
function activatePanel(panelId){
  const targetBtn = document.querySelector(`nav button[data-panel="${panelId}"]`);
  if (!targetBtn || !document.getElementById(panelId)) return false;
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('section.panel').forEach(p => p.classList.remove('active'));
  targetBtn.classList.add('active');
  document.getElementById(panelId).classList.add('active');
  return true;
}

document.querySelectorAll('nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    activatePanel(btn.dataset.panel);
    location.hash = btn.dataset.panel;
  });
});

// Restore the active tab from the URL on load/refresh, and on manual hash changes
function restorePanelFromHash(){
  const raw = location.hash.replace('#', '');
  const [panelId, contactId] = raw.split(':');
  if (panelId) activatePanel(panelId);
  if (panelId === 'panel-contacts' && contactId){
    openContactDetail(Number(contactId), false);
  }
}
window.addEventListener('hashchange', restorePanelFromHash);

// Escapes text for HTML, including quotes so values are safe inside attributes like value="…"
function esc(str){ const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ---------- SITE CONTENT (key/value form) ----------
const SITE_FIELDS = [
  ['brand_name','Brand / nav name'],['hero_name','Hero: your name'],['hero_role','Hero: role/title'],
  ['hero_location','Hero: location line'],['hero_sub','Hero: subheading', true],
  ['about_heading','About: heading'],['about_bio','About: bio', true],
  ['cta_primary_label','Primary button label'],['cta_secondary_label','Secondary button label'],
  ['contact_heading','Contact heading'],
  ['footer_name','Footer name'],['footer_location','Footer location']
];

async function loadSiteContent(){
  const { data } = await supabase.from('site_content').select('key,value');
  const map = Object.fromEntries((data||[]).map(r => [r.key, r.value]));
  const container = document.getElementById('site-content-fields');
  container.innerHTML = SITE_FIELDS.map(([key,label,isLong]) => `
    <label>${esc(label)}</label>
    ${isLong ? `<textarea data-key="${key}">${esc(map[key]||'')}</textarea>`
             : `<input data-key="${key}" value="${esc(map[key]||'')}">`}
  `).join('');
}

document.getElementById('save-site-content').addEventListener('click', async () => {
  const inputs = document.querySelectorAll('#site-content-fields [data-key]');
  const rows = Array.from(inputs).map(el => ({ key: el.dataset.key, value: el.value }));
  const { error } = await supabase.from('site_content').upsert(rows, { onConflict: 'key' });
  document.getElementById('site-content-note').textContent = error ? 'Error: ' + error.message : 'Saved.';
  if (!error) toast('Saved');
});

// ---------- INTEGRATIONS ----------
const INTEGRATION_FIELD_MAP = {
  'int-avail-url': 'n8n_availability_webhook_url',
  'int-book-url': 'n8n_booking_webhook_url',
  'int-gcal-url': 'booking_calendar_url',
  'int-chat-url': 'chat_endpoint_url',
  'int-contact-email': 'contact_email',
  'int-whatsapp': 'whatsapp_number',
  'int-linkedin': 'contact_linkedin_url'
};

// Fields that must be https:// links if filled in (blocks javascript: and plain-http endpoints)
const HTTPS_FIELDS = ['int-avail-url', 'int-book-url', 'int-gcal-url', 'int-chat-url', 'int-linkedin', 'int-notify-url'];
function isHttpsUrl(value){ try { return new URL(value).protocol === 'https:'; } catch(e){ return false; } }

let webhookSecret = '';
async function loadIntegrations(){
  const [{ data }, { data: privateRows }] = await Promise.all([
    supabase.from('site_content').select('key,value'),
    supabase.from('private_settings').select('key,value')
  ]);
  const map = Object.fromEntries((data||[]).map(r => [r.key, r.value]));
  Object.entries(INTEGRATION_FIELD_MAP).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (el) el.value = map[key] || '';
  });
  const privateMap = Object.fromEntries((privateRows||[]).map(r => [r.key, r.value]));
  document.getElementById('int-notify-url').value = privateMap.notification_webhook_url || '';
  webhookSecret = privateMap.webhook_signing_secret || '';
  document.getElementById('int-secret').value = webhookSecret ? '•'.repeat(24) : '(not set)';
}

document.getElementById('save-integrations-btn').addEventListener('click', async () => {
  const note = document.getElementById('integrations-note');
  const badField = HTTPS_FIELDS.find(id => {
    const v = document.getElementById(id).value.trim();
    return v && !isHttpsUrl(v);
  });
  if (badField){
    note.textContent = 'Links must start with https:// — please fix the highlighted field.';
    document.getElementById(badField).focus();
    return;
  }
  const rows = Object.entries(INTEGRATION_FIELD_MAP).map(([elId, key]) => ({
    key, value: document.getElementById(elId).value.trim()
  }));
  const [{ error }, { error: privateError }] = await Promise.all([
    supabase.from('site_content').upsert(rows, { onConflict: 'key' }),
    supabase.from('private_settings').upsert({ key: 'notification_webhook_url', value: document.getElementById('int-notify-url').value.trim() }, { onConflict: 'key' })
  ]);
  const err = error || privateError;
  note.textContent = err ? 'Error: ' + err.message : 'Saved.';
  if (!err) toast('Saved');
});

document.getElementById('copy-secret-btn').addEventListener('click', async () => {
  if (!webhookSecret){ toast('No secret set'); return; }
  toast((await copyText(webhookSecret)) ? 'Signing secret copied' : "Couldn't copy");
});
document.getElementById('rotate-secret-btn').addEventListener('click', async () => {
  if (!(await confirmAction({ title: 'Generate a new signing secret?', message: 'The old secret stops working immediately. Update it in whatever receives your booking notifications (n8n, Zapier…).', confirmLabel: 'Generate' }))) return;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const { error } = await supabase.from('private_settings').upsert({ key: 'webhook_signing_secret', value: secret }, { onConflict: 'key' });
  if (error){ toast('Error: ' + error.message); return; }
  webhookSecret = secret;
  document.getElementById('int-secret').value = '•'.repeat(24);
  toast('New secret saved — copy it into your receiver');
});

async function testWebhook(inputId, noteId, method){
  const url = document.getElementById(inputId).value.trim();
  const note = document.getElementById(noteId);
  if (!url){ note.textContent = 'Nothing to test — field is empty.'; note.style.color = 'var(--text-dim)'; return; }
  note.textContent = 'Testing…';
  note.style.color = 'var(--text-dim)';
  try {
    const res = await fetch(url, method === 'POST'
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true, message: 'ping from CMS' }) }
      : { method: 'GET' }
    );
    if (res.ok){
      note.textContent = `Reached it \u2014 responded ${res.status}.`;
      note.style.color = '#3EAE6B';
    } else {
      note.textContent = `Responded but with an error: ${res.status}.`;
      note.style.color = 'var(--accent)';
    }
  } catch(err){
    note.textContent = "Couldn't reach it \u2014 check the URL, or it may be blocking cross-origin requests.";
    note.style.color = 'var(--accent)';
  }
}
document.getElementById('test-avail-url').addEventListener('click', () => testWebhook('int-avail-url','int-avail-note','GET'));
document.getElementById('test-book-url').addEventListener('click', () => testWebhook('int-book-url','int-book-note','POST'));
document.getElementById('test-chat-url').addEventListener('click', () => testWebhook('int-chat-url','int-chat-note','POST'));
document.getElementById('test-notify-url').addEventListener('click', () => testWebhook('int-notify-url','int-notify-note','POST'));

// ---------- Shared: batch-save all rows in a container at once ----------
async function saveAllCards(table, containerId, noteId, fieldTypes){
  const container = document.getElementById(containerId);
  const note = document.getElementById(noteId);
  const cards = container.querySelectorAll('.card[data-id]');
  const rows = Array.from(cards).map(card => {
    const row = { id: Number(card.dataset.id) };
    card.querySelectorAll('[data-field]').forEach(el => {
      const type = (fieldTypes && fieldTypes[el.dataset.field]) || (el.type === 'number' ? 'number' : 'text');
      row[el.dataset.field] = type === 'number' ? Number(el.value)
        : type === 'csv' ? el.value.split(',').map(s=>s.trim()).filter(Boolean)
        : el.value;
    });
    return row;
  });
  if (!rows.length){ note.textContent = 'Nothing to save.'; return; }
  const { error } = await supabase.from(table).upsert(rows);
  note.textContent = error ? 'Error: ' + error.message : 'Saved.';
  if (!error) toast('Saved');
}

// ---------- GENERIC SIMPLE LIST (hero_badges) ----------
function simpleList(table, containerId, fieldKey, placeholder){
  return {
    async load(){
      const { data } = await supabase.from(table).select('*').order('sort_order');
      const container = document.getElementById(containerId);
      container.innerHTML = (data||[]).map(row => `
        <div class="card" data-id="${row.id}">
          <div class="row">
            <input style="flex:1" data-field="${fieldKey}" value="${esc(row[fieldKey])}">
            <input type="number" style="width:70px" data-field="sort_order" value="${row.sort_order}" title="order">
            <button class="danger" data-delete>Delete</button>
          </div>
        </div>
      `).join('') || `<p class="hint">${placeholder}</p>`;

      container.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const card = e.target.closest('.card');
          const name = card.querySelector(`[data-field="${fieldKey}"]`)?.value || 'this item';
          if (!(await confirmAction({ title: 'Delete this badge?', message: `"${name}" will be removed from your site.` }))) return;
          const { error } = await supabase.from(table).delete().eq('id', card.dataset.id);
          if (!error){ card.remove(); toast('Deleted'); } else toast('Error: ' + error.message);
        });
      });
    }
  };
}

const heroBadges = simpleList('hero_badges', 'hero-badges-list', 'label', 'No badges yet.');
document.getElementById('save-badges-btn').addEventListener('click', () => saveAllCards('hero_badges', 'hero-badges-list', 'badges-note'));

document.getElementById('add-badge-btn').addEventListener('click', async () => {
  const label = document.getElementById('new-badge-label').value.trim();
  if (!label) return;
  const { error } = await supabase.from('hero_badges').insert({ label, sort_order: 99 });
  if (!error){ document.getElementById('new-badge-label').value=''; heroBadges.load(); toast('Added'); }
  else toast('Error: ' + error.message);
});

// ---------- STACK ITEMS (with per-item logo upload) ----------
async function loadStackItems(){
  const { data } = await supabase.from('stack_items').select('*').order('sort_order');
  const container = document.getElementById('stack-list');
  container.innerHTML = (data||[]).map(row => `
    <div class="card" data-id="${row.id}">
      <div class="row">
        <input style="flex:1" data-field="label" value="${esc(row.label)}">
        <input type="number" style="width:70px" data-field="sort_order" value="${row.sort_order}" title="order">
        <button class="danger" data-delete>Delete</button>
      </div>
      <div class="row" style="margin-top:12px; align-items:center;">
        ${row.logo_url ? `<img src="${esc(row.logo_url)}" style="width:36px;height:36px;object-fit:contain;border-radius:6px;border:1px solid var(--line);">` : `<span class="hint" style="margin:0;">No logo uploaded — showing auto icon/monogram</span>`}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon" data-logo-input style="flex:1;">
        <button data-upload-logo>Upload logo</button>
      </div>
      <div class="save-note" data-logo-note></div>
    </div>
  `).join('') || `<p class="hint">No tools yet.</p>`;

  container.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    const name = card.querySelector('[data-field="label"]').value || 'this tool';
    if (!(await confirmAction({ title: 'Delete this tool?', message: `"${name}" will be removed from the tools strip on your site.` }))) return;
    const { error } = await supabase.from('stack_items').delete().eq('id', card.dataset.id);
    if (!error){ card.remove(); toast('Deleted'); } else toast('Error: ' + error.message);
  }));
  container.querySelectorAll('[data-upload-logo]').forEach(btn => btn.addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    const id = card.dataset.id;
    const fileInput = card.querySelector('[data-logo-input]');
    const note = card.querySelector('[data-logo-note]');
    note.textContent = 'Uploading…';
    const { publicUrl, error: uploadError } = await uploadImage(fileInput.files[0], `stack-logos/${Number(id)}`);
    if (uploadError){ note.textContent = uploadError; return; }
    const { error: saveError } = await supabase.from('stack_items').update({ logo_url: publicUrl }).eq('id', id);
    note.textContent = saveError ? 'Error: ' + saveError.message : 'Logo updated.';
    if (!saveError){ toast('Logo updated'); loadStackItems(); }
  }));
}

document.getElementById('add-stack-btn').addEventListener('click', async () => {
  const label = document.getElementById('new-stack-label').value.trim();
  if (!label) return;
  const { error } = await supabase.from('stack_items').insert({ label, sort_order: 99 });
  if (!error){ document.getElementById('new-stack-label').value=''; loadStackItems(); toast('Added'); }
  else toast('Error: ' + error.message);
});
document.getElementById('save-stack-btn').addEventListener('click', () => saveAllCards('stack_items', 'stack-list', 'stack-note'));

// ---------- SOLUTIONS ----------
async function loadSolutions(){
  const { data } = await supabase.from('solutions').select('*').order('sort_order');
  const container = document.getElementById('solutions-list');
  container.innerHTML = (data||[]).map(row => `
    <div class="card" data-id="${row.id}">
      <label>Title</label><input data-field="title" value="${esc(row.title)}">
      <label>Description</label><textarea data-field="description">${esc(row.description)}</textarea>
      <div class="row" style="margin-top:10px;">
        <button class="danger" data-delete>Delete</button>
      </div>
    </div>
  `).join('') || `<p class="hint">No solutions yet.</p>`;

  container.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    const name = card.querySelector('[data-field="title"]').value || 'this solution';
    if (!(await confirmAction({ title: 'Delete this solution?', message: `"${name}" will be removed from your site.` }))) return;
    const { error } = await supabase.from('solutions').delete().eq('id', card.dataset.id);
    if (!error){ card.remove(); toast('Deleted'); } else toast('Error: ' + error.message);
  }));
}
document.getElementById('save-solutions-btn').addEventListener('click', () => saveAllCards('solutions', 'solutions-list', 'solutions-note'));

document.getElementById('add-solution-btn').addEventListener('click', async () => {
  const title = document.getElementById('new-solution-title').value.trim();
  const description = document.getElementById('new-solution-desc').value.trim();
  if (!title || !description) return;
  const { error } = await supabase.from('solutions').insert({ title, description, sort_order: 99 });
  if (!error){
    document.getElementById('new-solution-title').value='';
    document.getElementById('new-solution-desc').value='';
    loadSolutions(); toast('Added');
  } else toast('Error: ' + error.message);
});

// ---------- ABOUT STATS ----------
async function loadStats(){
  const { data } = await supabase.from('about_stats').select('*').order('sort_order');
  const container = document.getElementById('stats-list');
  container.innerHTML = (data||[]).map(row => `
    <div class="card" data-id="${row.id}">
      <div class="field-grid">
        <div><label>Label</label><input data-field="label" value="${esc(row.label)}"></div>
        <div><label>Value</label><input data-field="value" value="${esc(row.value)}"></div>
      </div>
      <div class="row" style="margin-top:10px;">
        <button class="danger" data-delete>Delete</button>
      </div>
    </div>
  `).join('') || `<p class="hint">No stats yet.</p>`;

  container.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    const name = card.querySelector('[data-field="label"]').value || 'this stat';
    if (!(await confirmAction({ title: 'Delete this stat?', message: `"${name}" will be removed from your About section.` }))) return;
    const { error } = await supabase.from('about_stats').delete().eq('id', card.dataset.id);
    if (!error){ card.remove(); toast('Deleted'); } else toast('Error: ' + error.message);
  }));
}
document.getElementById('save-stats-btn').addEventListener('click', () => saveAllCards('about_stats', 'stats-list', 'stats-note'));

document.getElementById('add-stat-btn').addEventListener('click', async () => {
  const label = document.getElementById('new-stat-label').value.trim();
  const value = document.getElementById('new-stat-value').value.trim();
  if (!label || !value) return;
  const { error } = await supabase.from('about_stats').insert({ label, value, sort_order: 99 });
  if (!error){
    document.getElementById('new-stat-label').value='';
    document.getElementById('new-stat-value').value='';
    loadStats(); toast('Added');
  } else toast('Error: ' + error.message);
});

// ---------- PROJECTS ----------
function nodesToCsv(nodes){ return Array.isArray(nodes) ? nodes.join(', ') : ''; }
function csvToNodes(csv){ return csv.split(',').map(s => s.trim()).filter(Boolean); }
function featuresToLines(features){
  return Array.isArray(features) ? features.map(f => `${f.label} | ${f.desc}`).join('\n') : '';
}
function linesToFeatures(text){
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [label, ...rest] = l.split('|');
    return { label: (label||'').trim(), desc: rest.join('|').trim() };
  });
}

async function loadProjects(){
  const { data } = await supabase.from('projects').select('*').order('sort_order');
  const container = document.getElementById('projects-list');
  container.innerHTML = (data||[]).map(row => `
    <div class="card" data-id="${row.id}">
      <div class="field-grid">
        <div><label>Title</label><input data-field="title" value="${esc(row.title)}"></div>
        <div><label>Who / context</label><input data-field="who" value="${esc(row.who)}"></div>
      </div>
      <div class="field-grid">
        <div><label>Status</label>
          <select data-field="status">
            <option value="live" ${row.status==='live'?'selected':''}>live</option>
            <option value="in progress" ${row.status!=='live'?'selected':''}>in progress</option>
          </select>
        </div>
        <div><label>Layout</label>
          <select data-field="layout">
            <option value="pipeline" ${row.layout==='pipeline'?'selected':''}>pipeline</option>
            <option value="features" ${row.layout==='features'?'selected':''}>features</option>
          </select>
        </div>
      </div>
      <label>Description</label><textarea data-field="description">${esc(row.description)}</textarea>
      <label>Pipeline steps (comma-separated)</label>
      <input data-field="nodes_csv" value="${esc(nodesToCsv(row.nodes))}">
      <label>Features (one per line: label | description)</label>
      <textarea data-field="features_lines">${esc(featuresToLines(row.features))}</textarea>
      <label>Tags (comma-separated)</label>
      <input data-field="tags_csv" value="${esc((row.tags||[]).join(', '))}">
      <label>Link URL</label>
      <input data-field="link_url" value="${esc(row.link_url)}">
      <div class="row" style="margin-top:12px;">
        <button class="danger" data-delete>Delete</button>
      </div>
    </div>
  `).join('') || `<p class="hint">No projects yet.</p>`;

  container.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    const name = card.querySelector('[data-field="title"]').value || 'this project';
    if (!(await confirmAction({ title: 'Delete this project?', message: `"${name}" will be permanently removed from your portfolio.` }))) return;
    const { error } = await supabase.from('projects').delete().eq('id', card.dataset.id);
    if (!error){ card.remove(); toast('Deleted'); } else toast('Error: ' + error.message);
  }));
}

document.getElementById('save-projects-btn').addEventListener('click', async () => {
  const container = document.getElementById('projects-list');
  const note = document.getElementById('projects-note');
  const cards = container.querySelectorAll('.card[data-id]');
  const rows = Array.from(cards).map(card => {
    const get = (f) => card.querySelector(`[data-field="${f}"]`).value;
    return {
      id: Number(card.dataset.id),
      title: get('title'), who: get('who'), status: get('status'), layout: get('layout'),
      description: get('description'),
      nodes: get('nodes_csv') ? csvToNodes(get('nodes_csv')) : null,
      features: get('features_lines') ? linesToFeatures(get('features_lines')) : null,
      tags: get('tags_csv') ? get('tags_csv').split(',').map(s=>s.trim()).filter(Boolean) : [],
      link_url: get('link_url') || null
    };
  });
  if (!rows.length){ note.textContent = 'Nothing to save.'; return; }
  const { error } = await supabase.from('projects').upsert(rows);
  note.textContent = error ? 'Error: ' + error.message : 'Saved.';
  if (!error) toast('Saved');
});

document.getElementById('add-project-btn').addEventListener('click', async () => {
  const title = document.getElementById('new-project-title').value.trim();
  const description = document.getElementById('new-project-desc').value.trim();
  if (!title || !description) return;
  const payload = {
    title,
    who: document.getElementById('new-project-who').value.trim(),
    status: document.getElementById('new-project-status').value,
    layout: document.getElementById('new-project-layout').value,
    description,
    nodes: document.getElementById('new-project-nodes').value ? csvToNodes(document.getElementById('new-project-nodes').value) : null,
    features: document.getElementById('new-project-features').value ? linesToFeatures(document.getElementById('new-project-features').value) : null,
    tags: document.getElementById('new-project-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
    link_url: document.getElementById('new-project-link').value.trim() || null,
    sort_order: 99
  };
  const { error } = await supabase.from('projects').insert(payload);
  if (!error){
    ['title','who','desc','nodes','features','tags','link'].forEach(f => {
      const el = document.getElementById('new-project-'+f);
      if (el) el.value = '';
    });
    loadProjects(); toast('Added');
  } else toast('Error: ' + error.message);
});

// ---------- IMAGE UPLOAD VALIDATION ----------
// The storage bucket also enforces these limits server-side; this gives a clear message first.
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' };
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
async function looksLikeImage(file){
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const starts = (...sig) => sig.every((v, i) => b[i] === v);
  return starts(0x89, 0x50, 0x4E, 0x47)                                   // PNG
      || starts(0xFF, 0xD8, 0xFF)                                          // JPEG
      || starts(0x47, 0x49, 0x46, 0x38)                                    // GIF
      || (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) // WebP
      || starts(0x00, 0x00, 0x01, 0x00);                                   // ICO
}
// Validates, then uploads to the avatars bucket as "<baseName>.<ext>" (extension from the real type,
// never from the user's filename). Returns { publicUrl } or { error }.
async function uploadImage(file, baseName){
  if (!file) return { error: 'Choose a file first.' };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: 'Please upload a PNG, JPG, WebP, GIF or ICO image. (SVG isn’t allowed — it can contain code.)' };
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'That image is over 2 MB — please use a smaller one.' };
  if (!(await looksLikeImage(file))) return { error: 'That file doesn’t look like a real image. Please choose another.' };
  const path = `${baseName}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: 'Error: ' + uploadError.message };
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  return { publicUrl: urlData.publicUrl + '?t=' + Date.now() }; // cache-bust
}

// ---------- HEADER LOGO ----------
document.getElementById('upload-logo-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('logo-input');
  const note = document.getElementById('logo-note');
  note.textContent = 'Uploading…';
  const { publicUrl, error: uploadError } = await uploadImage(fileInput.files[0], 'header-logo');
  if (uploadError){ note.textContent = uploadError; return; }
  const { error: saveError } = await supabase.from('site_content').upsert({ key: 'header_logo_url', value: publicUrl }, { onConflict: 'key' });
  note.textContent = saveError ? 'Error: ' + saveError.message : 'Uploaded and set as your header logo.';
  if (!saveError){
    document.getElementById('logo-preview').src = publicUrl;
    document.getElementById('logo-preview').style.display = 'block';
    toast('Logo updated');
  }
});
document.getElementById('remove-logo-btn').addEventListener('click', async () => {
  const note = document.getElementById('logo-note');
  if (!(await confirmAction({ title: 'Remove header logo?', message: 'Your nav bar will go back to showing your text brand name. The uploaded file stays in storage.', confirmLabel: 'Remove' }))) return;
  const { error } = await supabase.from('site_content').upsert({ key: 'header_logo_url', value: '' }, { onConflict: 'key' });
  note.textContent = error ? 'Error: ' + error.message : 'Removed — back to text brand name.';
  if (!error){
    document.getElementById('logo-preview').style.display = 'none';
    toast('Logo removed');
  }
});

// ---------- HERO PHOTO ----------
document.getElementById('upload-photo-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('photo-input');
  const note = document.getElementById('photo-note');
  note.textContent = 'Uploading…';
  const { publicUrl, error: uploadError } = await uploadImage(fileInput.files[0], 'hero');
  if (uploadError){ note.textContent = uploadError; return; }
  const { error: saveError } = await supabase.from('site_content').upsert({ key: 'hero_photo_url', value: publicUrl }, { onConflict: 'key' });
  note.textContent = saveError ? 'Error: ' + saveError.message : 'Uploaded and set as your hero photo.';
  if (!saveError){
    document.getElementById('photo-preview').src = publicUrl;
    document.getElementById('photo-preview').style.display = 'block';
    toast('Photo updated');
  }
});

// ---------- FAVICON ----------
document.getElementById('upload-favicon-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('favicon-input');
  const note = document.getElementById('favicon-note');
  note.textContent = 'Uploading…';
  const { publicUrl, error: uploadError } = await uploadImage(fileInput.files[0], 'favicon');
  if (uploadError){ note.textContent = uploadError; return; }
  const { error: saveError } = await supabase.from('site_content').upsert({ key: 'favicon_url', value: publicUrl }, { onConflict: 'key' });
  note.textContent = saveError ? 'Error: ' + saveError.message : 'Uploaded and set as your favicon.';
  if (!saveError){
    document.getElementById('favicon-preview').src = publicUrl;
    document.getElementById('favicon-preview').style.display = 'block';
    toast('Favicon updated');
  }
});

// ---------- LOAD EVERYTHING ----------
// ---------- AVAILABILITY ----------
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
async function loadAvailability(){
  const { data, error } = await supabase.from('availability_hours').select('*').order('day_of_week');
  const container = document.getElementById('availability-list');
  if (error){ container.innerHTML = `<p class="hint">Error: ${esc(error.message)}</p>`; return; }
  container.innerHTML = (data||[]).map(row => `
    <div class="card" data-id="${row.day_of_week}">
      <div class="row" style="align-items:center;">
        <label style="margin:0; width:110px; flex-shrink:0;">
          <input type="checkbox" data-field="enabled" ${row.enabled ? 'checked' : ''} style="width:auto; margin-right:8px;">${DAY_NAMES[row.day_of_week]}
        </label>
        <input type="time" data-field="start_time" value="${esc(row.start_time)}" style="width:auto;">
        <span>to</span>
        <input type="time" data-field="end_time" value="${esc(row.end_time)}" style="width:auto;">
      </div>
    </div>
  `).join('');
}
document.getElementById('save-availability-btn').addEventListener('click', async () => {
  const container = document.getElementById('availability-list');
  const note = document.getElementById('availability-note');
  const cards = container.querySelectorAll('.card[data-id]');
  const rows = Array.from(cards).map(card => ({
    day_of_week: Number(card.dataset.id),
    enabled: card.querySelector('[data-field="enabled"]').checked,
    start_time: card.querySelector('[data-field="start_time"]').value,
    end_time: card.querySelector('[data-field="end_time"]').value
  }));
  const { error } = await supabase.from('availability_hours').upsert(rows, { onConflict: 'day_of_week' });
  note.textContent = error ? 'Error: ' + error.message : 'Saved.';
  if (!error) toast('Saved');
});

// ---------- CONTACTS (CRM: searchable table + navigable detail page) ----------
const STATUS_OPTIONS = ['new','contacted','qualified','booked','closed'];
let contactsCache = [];
let historyByEmail = {};
let contactsSearchTerm = '';

async function loadContacts(){
  const [{ data: contacts, error }, { data: bookingRows }] = await Promise.all([
    supabase.from('contacts').select('*').order('updated_at', { ascending: false }),
    supabase.from('bookings').select('email,preferred_date,preferred_time').order('preferred_date')
  ]);
  if (error){ document.getElementById('contacts-tbody').innerHTML = `<tr><td colspan="5" class="hint">Error: ${esc(error.message)}</td></tr>`; return; }

  contactsCache = contacts || [];
  historyByEmail = {};
  (bookingRows||[]).forEach(b => {
    if (!historyByEmail[b.email]) historyByEmail[b.email] = [];
    historyByEmail[b.email].push(`${b.preferred_date || '?'} ${b.preferred_time || ''}`.trim());
  });

  renderContactsTable();
}

function renderContactsTable(){
  const term = contactsSearchTerm.toLowerCase();
  const filtered = contactsCache.filter(c =>
    !term || c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)
  );
  const tbody = document.getElementById('contacts-tbody');
  tbody.innerHTML = filtered.map(c => {
    const count = (historyByEmail[c.email] || []).length;
    return `
    <tr>
      <td><span class="crm-link" data-id="${c.id}">${esc(c.name)}</span></td>
      <td><span class="crm-link" data-id="${c.id}">${esc(c.email)}</span></td>
      <td>${esc(c.phone) || '—'}</td>
      <td><span class="crm-status-badge">${esc(c.status)}</span></td>
      <td>${count || '—'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="hint">${contactsCache.length ? 'No matches.' : "No contacts yet — they'll appear automatically once someone books."}</td></tr>`;

  tbody.querySelectorAll('.crm-link').forEach(el => {
    el.addEventListener('click', () => openContactDetail(Number(el.dataset.id)));
  });
}

document.getElementById('contacts-search').addEventListener('input', (e) => {
  contactsSearchTerm = e.target.value;
  renderContactsTable();
});

function openContactDetail(id, updateHash = true){
  const c = contactsCache.find(x => x.id === id);
  if (!c) return;
  document.getElementById('contacts-table-view').style.display = 'none';
  document.getElementById('contact-detail-view').style.display = 'block';
  if (updateHash) location.hash = `panel-contacts:${id}`;
  renderContactDetail(id);
}

function closeContactDetail(){
  document.getElementById('contacts-table-view').style.display = 'block';
  document.getElementById('contact-detail-view').style.display = 'none';
  location.hash = 'panel-contacts';
}
document.getElementById('contact-back-btn').addEventListener('click', closeContactDetail);

function renderContactDetail(id){
  const c = contactsCache.find(x => x.id === id);
  const detail = document.getElementById('contact-detail');
  if (!c) return;

  const history = historyByEmail[c.email] || [];
  detail.innerHTML = `
    <h2 style="margin-bottom:18px;">${esc(c.name)}</h2>
    <div class="field-grid">
      <div><label>Name</label><input id="detail-name" value="${esc(c.name)}"></div>
      <div><label>Email</label><input id="detail-email" value="${esc(c.email)}"></div>
    </div>
    <div class="field-grid">
      <div><label>Phone</label><input id="detail-phone" value="${esc(c.phone)}"></div>
      <div><label>Status</label>
        <select id="detail-status">
          ${STATUS_OPTIONS.map(s => `<option value="${s}" ${c.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <label>Notes</label><textarea id="detail-notes">${esc(c.notes)}</textarea>
    <p class="hint" style="margin-top:10px;">
      ${history.length ? `${history.length} booking${history.length>1?'s':''}: ${history.map(esc).join(' · ')}` : 'No bookings yet — added manually'}
      &middot; source: ${esc(c.source || 'unknown')}
    </p>
    <div class="row" style="margin-top:14px;">
      <button class="primary" id="detail-save-btn">Save</button>
      <button class="danger" id="detail-delete-btn">Delete</button>
      <span class="save-note" id="detail-note"></span>
    </div>
  `;

  document.getElementById('detail-save-btn').addEventListener('click', async () => {
    const note = document.getElementById('detail-note');
    const payload = {
      name: document.getElementById('detail-name').value,
      email: document.getElementById('detail-email').value,
      phone: document.getElementById('detail-phone').value || null,
      status: document.getElementById('detail-status').value,
      notes: document.getElementById('detail-notes').value || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('contacts').update(payload).eq('id', id);
    note.textContent = error ? 'Error: ' + error.message : 'Saved.';
    if (!error){ toast('Saved'); loadContacts(); }
  });

  document.getElementById('detail-delete-btn').addEventListener('click', async () => {
    if (!(await confirmAction({ title: `Delete ${c.name}?`, message: 'Their past bookings stay on record — this only removes the CRM entry, including status and notes.' }))) return;
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (!error){
      toast('Deleted');
      closeContactDetail();
      loadContacts();
    } else toast('Error: ' + error.message);
  });
}

document.getElementById('add-contact-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-contact-name').value.trim();
  const email = document.getElementById('new-contact-email').value.trim();
  const phone = document.getElementById('new-contact-phone').value.trim();
  if (!name || !email){ toast('Name and email required'); return; }
  const { error } = await supabase.from('contacts').insert({ name, email, phone: phone || null, source: 'manual' });
  if (!error){
    ['name','email','phone'].forEach(f => document.getElementById('new-contact-'+f).value = '');
    loadContacts();
    toast('Added');
  } else toast('Error: ' + error.message);
});

// ---------- BOOKINGS (calendar view) ----------
let bkBookingsByDate = {}; // { 'YYYY-MM-DD': [booking, ...] }
let bkViewMonth = new Date(); bkViewMonth.setDate(1);
let bkSelectedDate = null;

function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

async function loadBookings(){
  const { data, error } = await supabase.from('bookings').select('*').order('preferred_date');
  if (error){ toast('Error loading bookings: ' + error.message); return; }
  bkBookingsByDate = {};
  (data||[]).forEach(b => {
    const key = b.preferred_date || 'unscheduled';
    if (!bkBookingsByDate[key]) bkBookingsByDate[key] = [];
    bkBookingsByDate[key].push(b);
  });
  renderBkCalendar();
  if (bkSelectedDate) renderBkDay(bkSelectedDate);
}

function renderBkCalendar(){
  const year = bkViewMonth.getFullYear(), month = bkViewMonth.getMonth();
  document.getElementById('bk-cal-month-label').textContent = bkViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-daylabel-admin">${d}</div>`).join('');
  for (let i = 0; i < startOffset; i++) html += '<div class="cal-day-admin"></div>';
  for (let day = 1; day <= daysInMonth; day++){
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const hasBookings = !!bkBookingsByDate[dateStr]?.length;
    const isSelected = dateStr === bkSelectedDate;
    html += `<button type="button" class="cal-day-admin ${hasBookings ? 'has-bookings' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">${day}</button>`;
  }
  document.getElementById('bk-cal-grid').innerHTML = html;
  document.querySelectorAll('#bk-cal-grid .cal-day-admin[data-date]').forEach(btn => {
    btn.addEventListener('click', () => { bkSelectedDate = btn.dataset.date; renderBkCalendar(); renderBkDay(btn.dataset.date); });
  });
}

function renderBkDay(dateStr){
  const bookings = bkBookingsByDate[dateStr] || [];
  document.getElementById('bk-day-heading').textContent = dateStr;
  const container = document.getElementById('bk-day-list');
  container.innerHTML = bookings.map(b => `
    <div class="card bk-day-card" data-id="${b.id}">
      <div class="field-grid">
        <div><label>Name</label><input data-field="name" value="${esc(b.name)}"></div>
        <div><label>Email</label><input data-field="email" value="${esc(b.email)}"></div>
      </div>
      <div class="field-grid">
        <div><label>Time</label><input data-field="preferred_time" value="${esc(b.preferred_time)}"></div>
        <div><label>Date</label><input data-field="preferred_date" type="date" value="${esc(b.preferred_date)}"></div>
      </div>
      <label>Notes</label><textarea data-field="message">${esc(b.message)}</textarea>
      <div class="row" style="margin-top:10px;">
        <button class="danger" data-delete>Delete</button>
      </div>
    </div>
  `).join('') || `<p class="hint">No bookings this day.</p>`;

  container.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    const name = card.querySelector('[data-field="name"]').value || 'this person';
    if (!(await confirmAction({ title: 'Delete this booking?', message: `The booking for ${name} will be removed and the time slot opens up again.` }))) return;
    const { error } = await supabase.from('bookings').delete().eq('id', card.dataset.id);
    if (!error){ toast('Deleted'); loadBookings(); } else toast('Error: ' + error.message);
  }));
}

document.getElementById('bk-cal-prev').addEventListener('click', () => { bkViewMonth.setMonth(bkViewMonth.getMonth()-1); renderBkCalendar(); });
document.getElementById('bk-cal-next').addEventListener('click', () => { bkViewMonth.setMonth(bkViewMonth.getMonth()+1); renderBkCalendar(); });

document.getElementById('save-bookings-btn').addEventListener('click', async () => {
  const note = document.getElementById('bookings-note');
  const cards = document.querySelectorAll('#bk-day-list .card[data-id]');
  if (!cards.length){ note.textContent = 'Nothing to save.'; return; }
  const rows = Array.from(cards).map(card => ({
    id: Number(card.dataset.id),
    name: card.querySelector('[data-field="name"]').value,
    email: card.querySelector('[data-field="email"]').value,
    preferred_time: card.querySelector('[data-field="preferred_time"]').value,
    preferred_date: card.querySelector('[data-field="preferred_date"]').value,
    message: card.querySelector('[data-field="message"]').value
  }));
  const { error } = await supabase.from('bookings').upsert(rows);
  note.textContent = error ? 'Error: ' + error.message : 'Saved.';
  if (!error){ toast('Saved'); loadBookings(); }
});

document.getElementById('add-booking-btn').addEventListener('click', async () => {
  if (!bkSelectedDate){ toast('Pick a date on the calendar first'); return; }
  const name = document.getElementById('new-booking-name').value.trim();
  const email = document.getElementById('new-booking-email').value.trim();
  const time = document.getElementById('new-booking-time').value.trim();
  const notes = document.getElementById('new-booking-notes').value.trim();
  if (!name || !email){ toast('Name and email required'); return; }
  const { error } = await supabase.from('bookings').insert({
    name, email, preferred_date: bkSelectedDate, preferred_time: time, message: notes || null
  });
  if (!error){
    ['name','email','time','notes'].forEach(f => document.getElementById('new-booking-'+f).value = '');
    loadBookings();
    toast('Added');
  } else toast('Error: ' + error.message);
});

// ---------- FAQs ----------
const MIGRATION_HINT = 'Run migrations/2026-09-27_faqs_newsletter_last_updated.sql in the Supabase SQL Editor to enable this.';
async function loadFaqs(){
  const container = document.getElementById('faqs-list');
  const { data, error } = await supabase.from('faqs').select('*').order('sort_order');
  if (error){ container.innerHTML = `<p class="hint">Couldn't load FAQs: ${esc(error.message)}. ${MIGRATION_HINT}</p>`; return; }
  container.innerHTML = (data||[]).map(row => `
    <div class="card" data-id="${row.id}">
      <div class="row">
        <div style="flex:1; min-width:200px;"><label style="margin-top:0;">Question</label><input data-field="question" value="${esc(row.question)}"></div>
        <div><label style="margin-top:0;">Order</label><input type="number" style="width:80px" data-field="sort_order" value="${row.sort_order}"></div>
      </div>
      <label>Answer</label><textarea data-field="answer">${esc(row.answer)}</textarea>
      <div class="row" style="margin-top:10px;">
        <button class="danger" data-delete>Delete</button>
      </div>
    </div>
  `).join('') || `<p class="hint">No FAQs yet — the FAQ section stays hidden on your site until you add one.</p>`;

  container.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    const name = card.querySelector('[data-field="question"]').value || 'this FAQ';
    if (!(await confirmAction({ title: 'Delete this FAQ?', message: `"${name}" will be removed from your site.` }))) return;
    const { error } = await supabase.from('faqs').delete().eq('id', card.dataset.id);
    if (!error){ toast('Deleted'); loadFaqs(); } else toast('Error: ' + error.message);
  }));
}
document.getElementById('save-faqs-btn').addEventListener('click', () => saveAllCards('faqs', 'faqs-list', 'faqs-note'));
document.getElementById('add-faq-btn').addEventListener('click', async () => {
  const question = document.getElementById('new-faq-question').value.trim();
  const answer = document.getElementById('new-faq-answer').value.trim();
  if (!question || !answer){ toast('Question and answer required'); return; }
  const { error } = await supabase.from('faqs').insert({ question, answer, sort_order: 99 });
  if (!error){
    document.getElementById('new-faq-question').value = '';
    document.getElementById('new-faq-answer').value = '';
    loadFaqs(); toast('Added');
  } else toast('Error: ' + error.message);
});

// ---------- NEWSLETTER SUBSCRIBERS ----------
let subscribersCache = [];
async function loadNewsletter(){
  const tbody = document.getElementById('newsletter-tbody');
  const note = document.getElementById('newsletter-note');
  const { data, error } = await supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false });
  if (error){
    subscribersCache = [];
    tbody.innerHTML = `<tr><td colspan="3" class="hint">Couldn't load subscribers: ${esc(error.message)}. ${MIGRATION_HINT}</td></tr>`;
    note.textContent = '';
    return;
  }
  subscribersCache = data || [];
  note.textContent = `${subscribersCache.length} subscriber${subscribersCache.length === 1 ? '' : 's'}`;
  tbody.innerHTML = subscribersCache.map(s => `
    <tr>
      <td>${esc(s.email)}</td>
      <td>${esc(new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</td>
      <td style="text-align:right;"><button class="danger" data-delete-sub="${s.id}" style="padding:5px 12px; font-size:0.8rem;">Remove</button></td>
    </tr>`).join('') || `<tr><td colspan="3" class="hint">No subscribers yet — they'll show up here as people sign up on your site.</td></tr>`;

  tbody.querySelectorAll('[data-delete-sub]').forEach(btn => btn.addEventListener('click', async () => {
    const sub = subscribersCache.find(s => String(s.id) === btn.dataset.deleteSub);
    if (!(await confirmAction({ title: 'Remove this subscriber?', message: `${sub ? sub.email : 'This email'} will be taken off your newsletter list.`, confirmLabel: 'Remove' }))) return;
    const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', btn.dataset.deleteSub);
    if (!error){ toast('Removed'); loadNewsletter(); } else toast('Error: ' + error.message);
  }));
}
document.getElementById('copy-subscribers-btn').addEventListener('click', async () => {
  if (!subscribersCache.length){ toast('No subscribers to copy'); return; }
  const ok = await copyText(subscribersCache.map(s => s.email).join(', '));
  toast(ok ? `Copied ${subscribersCache.length} email${subscribersCache.length === 1 ? '' : 's'}` : "Couldn't copy");
});
document.getElementById('export-subscribers-btn').addEventListener('click', () => {
  if (!subscribersCache.length){ toast('No subscribers to export'); return; }
  // Neutralise spreadsheet formula injection (cells starting with = + - @)
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const csv = ['email,signed_up_at', ...subscribersCache.map(s => `${cell(s.email)},${cell(s.created_at)}`)].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = `newsletter-subscribers-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

async function loadAll(){
  await Promise.all([
    loadSiteContent(), heroBadges.load(), loadSolutions(), loadProjects(), loadStackItems(), loadStats(), loadBookings(), loadAvailability(), loadIntegrations(), loadContacts(), loadFaqs(), loadNewsletter()
  ]);
  const { data: heroData } = await supabase.from('site_content').select('value').eq('key','hero_photo_url').maybeSingle();
  if (heroData?.value){
    document.getElementById('photo-preview').src = heroData.value;
    document.getElementById('photo-preview').style.display = 'block';
  }
  const { data: favData } = await supabase.from('site_content').select('value').eq('key','favicon_url').maybeSingle();
  if (favData?.value){
    document.getElementById('favicon-preview').src = favData.value;
    document.getElementById('favicon-preview').style.display = 'block';
  }
  const { data: logoData } = await supabase.from('site_content').select('value').eq('key','header_logo_url').maybeSingle();
  if (logoData?.value){
    document.getElementById('logo-preview').src = logoData.value;
    document.getElementById('logo-preview').style.display = 'block';
  }
}

checkSession();
