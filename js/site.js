import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

const SUPABASE_URL = 'https://vqthioychxlqknfwboqk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pD_0O9o-4s6hzKh4wUFuRg_y6MoUoF8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const UI = window.SiteUI;
let CHAT_ENDPOINT = 'https://vqthioychxlqknfwboqk.supabase.co/functions/v1/portfolio-chat'; // overridden by CMS value once loaded

function esc(str){ const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML; }
// URLs from the CMS are only used if they're http(s) — blocks javascript:, data: and other script-capable links
function safeUrl(value, { httpsOnly = false } = {}){
  if (!value) return '';
  try {
    const u = new URL(String(value).trim(), location.href);
    if (u.protocol === 'https:' || (!httpsOnly && u.protocol === 'http:')) return u.href;
  } catch(e){}
  return '';
}
// Server-side validation / rate-limit errors → a message a visitor can act on
function friendlyDbError(error, fallback){
  if (!error) return fallback;
  if (error.code === 'PT429' || error.code === 'PT409' || error.code === '22023') return error.message; // written for visitors in the database
  if (error.code === '23514') return 'Please check your details — something looks too long or isn’t a valid email address.';
  return fallback;
}
function initials(name){
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase() || '').join('');
}
function setBusy(btn, busy){
  btn.disabled = busy;
  btn.classList.toggle('is-loading', busy);
  btn.setAttribute('aria-busy', String(busy));
}
function formatDate(value){
  const d = new Date(value);
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Plain text with optional ```code fences``` → paragraphs + copyable code blocks. Everything is escaped.
function renderRichText(text){
  return String(text ?? '').split('```').map((part, i) => {
    if (i % 2 === 1){
      const code = part.replace(/^[\w+#.-]*\n/, '').replace(/\n$/, '');
      return `<pre><code>${esc(code)}</code></pre>`;
    }
    return part.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
      .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  }).join('');
}

function formatTime12(t){
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function formatAvailability(hours){
  const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const order = [1,2,3,4,5,6,0];
  const byDay = Object.fromEntries((hours||[]).map(h => [h.day_of_week, h]));
  const ordered = order.map(d => ({ day: d, ...byDay[d] }));
  const groups = [];
  let current = null;
  for (const row of ordered){
    if (!row.enabled){ current = null; continue; }
    const key = row.start_time + '-' + row.end_time;
    if (current && current.key === key){ current.days.push(row.day); }
    else { current = { key, days: [row.day], start: row.start_time, end: row.end_time }; groups.push(current); }
  }
  if (!groups.length) return '';
  return groups.map(g => {
    const first = DAY_ABBR[g.days[0]], last = DAY_ABBR[g.days[g.days.length - 1]];
    const dayLabel = g.days.length > 1 ? `${first}–${last}` : first;
    return `${dayLabel} ${formatTime12(g.start)}–${formatTime12(g.end)} CST`;
  }).join(' · ');
}

// ---- Brand logos: real logos where available, colored monogram fallback otherwise ----
const BRAND_SLUGS = {
  'supabase':'supabase', 'n8n':'n8n', 'vercel':'vercel', 'github':'github',
  'claude api':'claude', 'claude':'claude', 'gemini':'googlegemini',
  'klaviyo':'klaviyo', 'zapier':'zapier', 'make':'make',
  'wordpress elementor':'elementor', 'elementor':'elementor', 'wordpress':'wordpress',
  'activecampaign':'activecampaign', 'active campaign':'activecampaign'
};
const BRAND_COLORS = {
  'supabase': '#3ECF8E', 'n8n': '#EA4B71', 'lovable': '#FF3D71', 'groq': '#F55036',
  'claude api': '#D97757', 'claude': '#D97757', 'gemini': '#4285F4', 'vercel': '#111111',
  'gohighlevel': '#0B9B7D', 'github': '#24292E',
  'klaviyo': '#25252A', 'zapier': '#FF4A00', 'make': '#6D00CC',
  'wordpress elementor': '#92003B', 'elementor': '#92003B', 'wordpress': '#21759B',
  'activecampaign': '#005FFE', 'active campaign': '#005FFE'
};
const FALLBACK_PALETTE = ['#6FC3D9','#E8954A','#3EAE6B','#8B6FD9','#D9587A','#3D8FC7'];
function hashColor(label){
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
}
function brandColor(label){ return BRAND_COLORS[label.toLowerCase()] || hashColor(label); }
function monogram(label){
  const trimmed = label.trim();
  if (trimmed.includes(' ')) return initials(trimmed);
  return trimmed.slice(0,2);
}
function logoMark(label, sizePx, uploadedLogoUrl){
  uploadedLogoUrl = safeUrl(uploadedLogoUrl);
  if (uploadedLogoUrl){
    return `<span class="logo-mark" style="width:${sizePx}px;height:${sizePx}px;background:var(--bg-panel-2); overflow:hidden;">
      <img src="${esc(uploadedLogoUrl)}" alt="${esc(label)}" style="width:100%;height:100%;object-fit:contain;">
    </span>`;
  }
  const slug = BRAND_SLUGS[label.toLowerCase()];
  const color = brandColor(label);
  const mono = esc(monogram(label));
  const imgSize = Math.round(sizePx * 0.55);
  const fallbackFont = Math.round(sizePx * 0.38);
  const imgTag = slug
    ? `<img src="https://cdn.simpleicons.org/${slug}/ffffff" alt="${esc(label)}" style="width:${imgSize}px;height:${imgSize}px;" data-logo-fallback>`
    : '';
  const fallbackDisplay = slug ? 'none' : 'inline-flex';
  return `<span class="logo-mark" style="width:${sizePx}px;height:${sizePx}px;background:${color}">
    ${imgTag}
    <span class="logo-fallback" style="display:${fallbackDisplay}; align-items:center; justify-content:center; font-size:${fallbackFont}px;">${mono}</span>
  </span>`;
}
function setFavicon(brandName, uploadedUrl){
  uploadedUrl = safeUrl(uploadedUrl);
  if (uploadedUrl){ document.getElementById('favicon').href = uploadedUrl; return; }
  const initialsText = esc(initials(brandName));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="#0F2942"/>
    <rect x="4" y="4" width="56" height="56" rx="10" fill="#E8954A"/>
    <text x="32" y="42" font-family="monospace" font-size="26" font-weight="600" fill="#12233A" text-anchor="middle">${initialsText}</text>
  </svg>`;
  document.getElementById('favicon').href = 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function renderSolutions(list){
  return (list||[]).map((s,i) => `
    <div class="solution-card" id="solution-${s.id}">
      <div class="idx mono">${String(i+1).padStart(2,'0')}</div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.description)}</p>
    </div>`).join('') || '<p class="load-note" style="padding:20px 28px; background:var(--bg-panel); margin:0;">No solutions added yet.</p>';
}

function renderProjectBody(p){
  if (p.layout === 'features' && Array.isArray(p.features)){
    return `<div class="mini-features">${p.features.map(f => `<div class="mini-feature"><b>${esc(f.label)}</b> — ${esc(f.desc)}</div>`).join('')}</div>`;
  }
  const nodes = Array.isArray(p.nodes) ? p.nodes : [];
  return `<div class="mini-pipeline">${nodes.map(n => `<span class="mini-node">${esc(n)}</span>`).join('')}</div>`;
}

function renderProject(p, i){
  const statusClass = p.status === 'live' ? 'project-status live' : 'project-status';
  const tags = (p.tags||[]).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const linkUrl = safeUrl(p.link_url);
  const link = linkUrl
    ? `<div class="project-links"><a href="${esc(linkUrl)}" target="_blank" rel="noopener" data-utm-content="project-${p.id}">${esc(p.link_url.replace(/^https?:\/\//,''))}</a></div>`
    : '';
  const updatedLabel = p.updated_at ? formatDate(p.updated_at) : '';
  const updated = updatedLabel
    ? `<time class="project-updated" datetime="${esc(p.updated_at)}">Last updated ${esc(updatedLabel)}</time>`
    : '';
  return `
    <div class="project-cell reveal" style="--i:${i % 2}">
      <article class="project-card" id="project-${p.id}">
        <div class="project-card-top">
          <div>
            <h3>${esc(p.title)}</h3>
            ${p.who ? `<div class="who">${esc(p.who)}</div>` : ''}
          </div>
          <span class="${statusClass}">${esc(p.status)}</span>
        </div>
        <div class="desc rich">${renderRichText(p.description)}</div>
        ${renderProjectBody(p)}
        <div class="tags">${tags}</div>
        ${link || updated ? `<div class="project-foot">${link}${updated}</div>` : ''}
      </article>
    </div>`;
}

function renderFaqs(list){
  return list.map((f, i) => `
    <details class="faq-item reveal" id="faq-${f.id}" style="--i:${Math.min(i, 5)}">
      <summary><span>${esc(f.question)}</span><span class="faq-icon" aria-hidden="true"></span></summary>
      <div class="faq-answer rich">${renderRichText(f.answer)}</div>
    </details>`).join('');
}

function buildSearchEntries({ c, solutions, projects, stack, stats, faqs }){
  const entries = [];
  entries.push({
    kind: 'About',
    title: c.hero_name ? `About ${c.hero_name}` : 'About',
    body: [c.hero_role, c.hero_location, c.hero_sub, c.about_bio, (stats||[]).map(s => `${s.value} ${s.label}`).join(' · ')].filter(Boolean).join(' — '),
    target: 'about'
  });
  (solutions||[]).forEach(s => entries.push({ kind: 'Service', title: s.title, body: s.description, target: `solution-${s.id}`, block: 'center' }));
  (projects||[]).forEach(p => entries.push({
    kind: 'Project', title: p.title, target: `project-${p.id}`, block: 'center',
    body: [p.who, p.status, p.description,
      Array.isArray(p.nodes) ? p.nodes.join(', ') : '',
      Array.isArray(p.features) ? p.features.map(f => `${f.label}: ${f.desc}`).join(' · ') : '',
      (p.tags||[]).join(', ')].filter(Boolean).join(' — ')
  }));
  if ((stack||[]).length) entries.push({ kind: 'Tools', title: 'Tools & stack', body: stack.map(s => s.label).join(', '), target: 'stack', block: 'center' });
  if (faqs.length) entries.push({ kind: 'Section', title: 'FAQ', body: 'Frequently asked questions', target: 'faq', suggest: true });
  faqs.forEach(f => entries.push({ kind: 'FAQ', title: f.question, body: f.answer, target: `faq-${f.id}`, block: 'center' }));
  if (c.contact_email) entries.push({ kind: 'Contact', title: 'Email', body: c.contact_email, target: 'contact' });
  return entries;
}

async function loadSite(){
  try{
    const [{ data: content }, { data: badges }, { data: solutions }, { data: projects }, { data: stack }, { data: stats }, { data: hours }, { data: faqRows }] = await Promise.all([
      supabase.from('site_content').select('key,value'),
      supabase.from('hero_badges').select('label').order('sort_order'),
      supabase.from('solutions').select('*').order('sort_order'),
      supabase.from('projects').select('*').order('sort_order'),
      supabase.from('stack_items').select('label,logo_url').order('sort_order'),
      supabase.from('about_stats').select('*').order('sort_order'),
      supabase.from('availability_hours').select('*').order('day_of_week'),
      supabase.from('faqs').select('*').order('sort_order') // returns an error (→ no FAQ section) until the migration is run
    ]);

    const c = Object.fromEntries((content || []).map(r => [r.key, r.value]));
    const faqs = faqRows || [];

    document.getElementById('nav-brand').textContent = c.brand_name || 'Portfolio';
    const headerLogoUrl = safeUrl(c.header_logo_url);
    if (headerLogoUrl){
      document.getElementById('nav-brand-wrap').innerHTML = `<img src="${esc(headerLogoUrl)}" alt="${esc(c.brand_name || 'Logo')}">`;
    }
    setFavicon(c.brand_name || 'Portfolio', c.favicon_url);
    document.title = (c.brand_name ? c.brand_name + ' — ' : '') + 'Automation Portfolio';
    document.getElementById('hero-name').textContent = c.hero_name || '';
    document.getElementById('hero-role').textContent = c.hero_role || '';
    document.getElementById('hero-location').textContent = c.hero_location || '';
    document.getElementById('hero-sub').textContent = c.hero_sub || '';
    document.getElementById('cta-primary').textContent = c.cta_primary_label || 'Book a call';
    document.getElementById('cta-secondary').textContent = c.cta_secondary_label || 'Call on WhatsApp';
    const waDigits = (c.whatsapp_number || '').replace(/[^\d]/g, '');
    const waLink = waDigits ? `https://wa.me/${waDigits}` : '#';
    document.getElementById('cta-secondary').href = waLink;
    document.getElementById('about-heading').textContent = c.about_heading || "Who's behind this?";
    document.getElementById('about-bio').textContent = c.about_bio || '';
    document.getElementById('about-photo-img').alt = c.hero_name || '';
    document.getElementById('contact-heading').textContent = c.contact_heading || '';
    document.getElementById('contact-email').textContent = c.contact_email || '';
    document.getElementById('contact-email').href = 'mailto:' + (c.contact_email || '');
    const copyEmailBtn = document.getElementById('copy-email-btn');
    copyEmailBtn.hidden = !c.contact_email;
    copyEmailBtn.dataset.copy = c.contact_email || '';
    document.getElementById('contact-linkedin').href = safeUrl(c.contact_linkedin_url) || '#';
    document.getElementById('contact-whatsapp').href = waLink;
    document.getElementById('footer-name').textContent = c.footer_name ? `Built by ${c.footer_name}.` : '';
    document.getElementById('footer-location').textContent = c.footer_location || '';
    if (safeUrl(c.chat_endpoint_url, { httpsOnly: true })) CHAT_ENDPOINT = safeUrl(c.chat_endpoint_url, { httpsOnly: true });
    document.getElementById('availability-schedule').textContent = formatAvailability(hours);

    // Booking: native calendar is now the default (Supabase-only mode works with zero extra setup).
    // If both n8n webhook URLs are set, it automatically upgrades to real Google Calendar sync + email confirmation.
    document.getElementById('native-calendar').style.display = 'block';
    document.getElementById('booking-form').style.display = 'none';
    document.getElementById('booking-sub').textContent = "Pick a time that works for you.";
    const n8nAvailabilityUrl = safeUrl(c.n8n_availability_webhook_url, { httpsOnly: true });
    const n8nBookingUrl = safeUrl(c.n8n_booking_webhook_url, { httpsOnly: true });
    if (n8nAvailabilityUrl && n8nBookingUrl){
      initNativeCalendar('n8n', { availabilityUrl: n8nAvailabilityUrl, bookingUrl: n8nBookingUrl });
    } else {
      initNativeCalendar('supabase', {});
    }

    const initialsText = initials(c.hero_name);
    const heroPhotoUrl = safeUrl(c.hero_photo_url);
    if (heroPhotoUrl){
      document.getElementById('hero-photo-wrap').innerHTML = `<img src="${esc(heroPhotoUrl)}" alt="${esc(c.hero_name || 'Profile photo')}">`;
      document.getElementById('about-photo-img').src = heroPhotoUrl;
      document.getElementById('about-photo-img').style.display = 'block';
      document.getElementById('about-photo-placeholder').style.display = 'none';
    } else {
      document.getElementById('hero-photo-placeholder').textContent = initialsText;
      document.getElementById('about-photo-placeholder').textContent = initialsText;
    }

    const badgeClasses = ['b1','b2','b3'];
    document.getElementById('hero-badges').innerHTML = (badges||[]).slice(0,3).map((b,i) => `
      <div class="badge-chip ${badgeClasses[i] || ''}"><span class="dot"></span>${esc(b.label)}</div>
    `).join('');

    const marqueeItems = (list) => list.map(s => `<span class="marquee-item">${logoMark(s.label,34,s.logo_url)}${esc(s.label)}<span class="sep">/</span></span>`).join('');
    const marqueeTrack = document.getElementById('marquee-track');
    marqueeTrack.innerHTML = marqueeItems(stack||[]) + marqueeItems(stack||[]);
    // Brand icon failed to load → show the monogram instead (listener, not inline onerror, so CSP can block inline code)
    marqueeTrack.querySelectorAll('img[data-logo-fallback]').forEach(img => img.addEventListener('error', () => {
      img.style.display = 'none';
      img.nextElementSibling.style.display = 'inline-flex';
    }, { once: true }));

    const solutionsEl = document.getElementById('solutions-container');
    solutionsEl.innerHTML = renderSolutions(solutions);
    solutionsEl.removeAttribute('aria-busy');

    const projectsEl = document.getElementById('projects-container');
    projectsEl.innerHTML = (projects||[]).map(renderProject).join('') || '<p class="load-note">No projects yet.</p>';
    projectsEl.removeAttribute('aria-busy');

    document.getElementById('stats-container').innerHTML = (stats||[]).map(s => `
      <div class="stat"><div class="value">${esc(s.value)}</div><div class="label mono">${esc(s.label)}</div></div>
    `).join('');

    if (faqs.length){
      document.getElementById('faq-list').innerHTML = renderFaqs(faqs);
      document.getElementById('faq').hidden = false;
      document.getElementById('nav-faq').hidden = false;
    }

    UI.setSearchIndex(buildSearchEntries({ c, solutions, projects, stack, stats, faqs }));
  } catch(err){
    console.error('Failed to load site content.'); // no details in production logs
    const solutionsEl = document.getElementById('solutions-container');
    solutionsEl.innerHTML = '';
    solutionsEl.removeAttribute('aria-busy');
    solutionsEl.hidden = true;
    const projectsEl = document.getElementById('projects-container');
    projectsEl.removeAttribute('aria-busy');
    projectsEl.innerHTML =
      `<p class="error-note">Couldn't load this section right now. Please refresh the page in a moment.</p>`;
  } finally {
    document.documentElement.classList.add('site-ready');
    UI.observeReveal();
    UI.enhanceCodeBlocks();
    UI.decorateLinks();
    UI.refresh();
  }
}

// ---------- NATIVE BOOKING CALENDAR (Calendly-style) ----------
// mode: 'supabase' (default, no extra setup — reads availability_hours + bookings directly)
//    or 'n8n' (real Google Calendar sync + email confirmation, once webhook URLs are set)
function initNativeCalendar(mode, opts){
  let slotsByDate = {}; // { 'YYYY-MM-DD': [{time, iso, dateLabel}, ...] }
  let viewMonth = new Date(); viewMonth.setDate(1);
  let selectedDate = null;
  let selectedTime = null;

  const grid = document.getElementById('cal-grid');
  const monthLabel = document.getElementById('cal-month-label');
  const slotsContainer = document.getElementById('cal-slots');
  const slotsHeading = document.getElementById('cal-slots-heading');
  const bookForm = document.getElementById('cal-book-form');

  function renderMonth(){
    const year = viewMonth.getFullYear(), month = viewMonth.getMonth();
    monthLabel.textContent = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-daylabel">${d}</div>`).join('');
    for (let i = 0; i < startOffset; i++) html += '<div class="cal-day"></div>';
    for (let day = 1; day <= daysInMonth; day++){
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const hasSlots = !!slotsByDate[dateStr]?.length;
      const isSelected = dateStr === selectedDate;
      html += `<button type="button" class="cal-day ${hasSlots ? 'has-slots' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}" ${hasSlots ? '' : 'disabled'}>${day}</button>`;
    }
    grid.innerHTML = html;

    grid.querySelectorAll('.cal-day.has-slots').forEach(btn => {
      btn.addEventListener('click', () => selectDate(btn.dataset.date));
    });
  }

  function selectDate(dateStr){
    selectedDate = dateStr;
    selectedTime = null;
    bookForm.style.display = 'none';
    renderMonth();
    const daySlots = slotsByDate[dateStr] || [];
    slotsHeading.textContent = daySlots.length ? `Open times — ${daySlots[0].dateLabel}` : 'No open times that day';
    slotsContainer.innerHTML = daySlots.map(s => `<button type="button" class="cal-slot-btn" data-time="${esc(s.time)}">${esc(s.time)}</button>`).join('');
    slotsContainer.querySelectorAll('.cal-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        slotsContainer.querySelectorAll('.cal-slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedTime = btn.dataset.time;
        bookForm.style.display = 'block';
      });
    });
  }

  document.getElementById('cal-prev').addEventListener('click', () => {
    viewMonth.setMonth(viewMonth.getMonth() - 1);
    renderMonth();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    viewMonth.setMonth(viewMonth.getMonth() + 1);
    renderMonth();
  });

  bookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = document.getElementById('cal-note');
    const btn = document.getElementById('cal-confirm-btn');
    const name = document.getElementById('cal-name').value.trim();
    const email = document.getElementById('cal-email').value.trim();
    const notes = document.getElementById('cal-notes').value.trim();
    if (!name || !email || !selectedDate || !selectedTime){
      note.textContent = 'Please fill in your name and email.';
      note.className = 'booking-note err';
      return;
    }
    setBusy(btn, true);
    note.textContent = 'Booking…';
    note.className = 'booking-note';
    try {
      let success = false;
      let dbError = null;
      if (mode === 'n8n'){
        const res = await fetch(opts.bookingUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, date: selectedDate, time: selectedTime, notes })
        });
        const result = await res.json().catch(() => ({ success: false }));
        success = !!result.success;
      } else {
        const { error } = await supabase.from('bookings').insert({
          name, email, preferred_date: selectedDate, preferred_time: selectedTime, message: notes || null
        });
        success = !error;
        dbError = error;
      }

      if (success){
        // (The owner's booking notification is sent by the database, never from the browser.)
        const bookedTime = selectedTime;
        bookForm.reset();
        bookForm.style.display = 'none';
        // Remove the just-booked slot locally so it can't be double-booked before the next full refresh
        if (slotsByDate[selectedDate]){
          slotsByDate[selectedDate] = slotsByDate[selectedDate].filter(s => s.time !== bookedTime);
        }
        selectDate(selectedDate);
        note.textContent = mode === 'n8n'
          ? "You're booked — check your email for the confirmation."
          : "Booked! I'll follow up by email to confirm.";
        note.className = 'booking-note ok';
      } else {
        if (dbError?.code === 'PT409' && slotsByDate[selectedDate]){
          // Someone else just took this slot — drop it so the visitor picks another
          const takenTime = selectedTime;
          slotsByDate[selectedDate] = slotsByDate[selectedDate].filter(s => s.time !== takenTime);
          selectDate(selectedDate);
        }
        note.textContent = friendlyDbError(dbError, "Something went wrong — try another slot or email directly below.");
        note.className = 'booking-note err';
      }
    } catch(err){
      note.textContent = "Something went wrong — try again or email directly below.";
      note.className = 'booking-note err';
    }
    setBusy(btn, false);
  });

  // ---- Load slots: either from n8n (real Google Calendar sync) or computed directly from Supabase ----
  async function loadSlotsFromN8n(){
    const res = await fetch(opts.availabilityUrl);
    const data = await res.json();
    const map = {};
    (data.slotsDetailed || []).forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }

  async function loadSlotsFromSupabase(){
    // booked_slots() returns only the taken dates/times — visitors can never read who booked them
    const [{ data: hoursRows }, { data: bookingRows }] = await Promise.all([
      supabase.from('availability_hours').select('*'),
      supabase.rpc('booked_slots')
    ]);
    const hoursByDay = Object.fromEntries((hoursRows||[]).map(r => [r.day_of_week, r]));
    const takenKeys = new Set((bookingRows||[]).map(b => `${b.preferred_date}|${b.preferred_time}`));

    const map = {};
    const now = new Date();
    const DAYS_AHEAD = 30;
    for (let d = 0; d < DAYS_AHEAD; d++){
      const day = new Date(now.getTime() + d * 86400000);
      const dow = day.getDay();
      const rule = hoursByDay[dow];
      if (!rule || !rule.enabled) continue;

      const dateStr = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
      const dateLabel = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const [startH, startM] = rule.start_time.split(':').map(Number);
      const [endH, endM] = rule.end_time.split(':').map(Number);

      for (let mins = startH*60+startM; mins < endH*60+endM; mins += 60){
        const h = Math.floor(mins/60), m = mins % 60;
        const slotDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (slotDate < now) continue;
        const ampm = h >= 12 ? 'PM' : 'AM';
        let h12 = h % 12; if (h12 === 0) h12 = 12;
        const timeLabel = `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
        if (takenKeys.has(`${dateStr}|${timeLabel}`)) continue;
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({ date: dateStr, dateLabel, time: timeLabel });
      }
    }
    return map;
  }

  renderMonth();
  (mode === 'n8n' ? loadSlotsFromN8n() : loadSlotsFromSupabase())
    .then(map => { slotsByDate = map; renderMonth(); slotsHeading.textContent = 'Pick a date to see open times'; })
    .catch(() => { slotsHeading.textContent = "Couldn't load availability — try again shortly."; });
}

loadSite();

// ---------- BOOKING FORM ----------
document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const note = document.getElementById('bk-note');
  const btn = document.getElementById('bk-submit');
  const payload = {
    name: document.getElementById('bk-name').value.trim(),
    email: document.getElementById('bk-email').value.trim(),
    preferred_date: document.getElementById('bk-date').value || null,
    preferred_time: document.getElementById('bk-time').value.trim() || null,
    message: document.getElementById('bk-message').value.trim() || null
  };
  if (!payload.name || !payload.email){
    note.textContent = 'Name and email are required.';
    note.className = 'booking-note err';
    return;
  }
  setBusy(btn, true);
  note.textContent = 'Sending…';
  note.className = 'booking-note';
  const { error } = await supabase.from('bookings').insert(payload);
  setBusy(btn, false);
  if (error){
    note.textContent = friendlyDbError(error, 'Something went wrong — try again or email directly below.');
    note.className = 'booking-note err';
  } else {
    note.textContent = "Got it — I'll follow up by email soon.";
    note.className = 'booking-note ok';
    e.target.reset();
  }
});

// ---------- NEWSLETTER ----------
const nlForm = document.getElementById('newsletter-form');
const nlEmail = document.getElementById('nl-email');
const nlError = document.getElementById('nl-error');
const nlSuccess = document.getElementById('nl-success');

function showNewsletterSuccess(alreadySubscribed){
  document.getElementById('nl-success-title').textContent = alreadySubscribed ? "You're already on the list" : "You're subscribed!";
  document.getElementById('nl-success-text').textContent = alreadySubscribed
    ? 'That email is already signed up — nothing else to do.'
    : `Signed up on ${formatDate(new Date())}. New builds will land in your inbox.`;
  nlForm.hidden = true;
  nlSuccess.hidden = false;
  document.getElementById('nl-success-title').focus();
}

nlForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('nl-submit');
  const email = nlEmail.value.trim().toLowerCase();
  if (document.getElementById('nl-company').value){ showNewsletterSuccess(false); return; } // honeypot: quietly drop bots
  if (!email || !nlEmail.checkValidity()){
    nlError.textContent = 'Please enter a valid email address.';
    nlEmail.setAttribute('aria-invalid', 'true');
    nlEmail.focus();
    return;
  }
  nlEmail.removeAttribute('aria-invalid');
  nlError.textContent = '';
  setBusy(btn, true);
  let error = null;
  try {
    ({ error } = await supabase.from('newsletter_subscribers').insert({ email, source: 'site' }));
  } catch(err){ error = err; }
  setBusy(btn, false);
  if (!error) showNewsletterSuccess(false);
  else if (error.code === '23505') showNewsletterSuccess(true); // unique violation = already subscribed
  else nlError.textContent = friendlyDbError(error, "Couldn't subscribe right now — please try again in a moment.");
});
nlEmail.addEventListener('input', () => {
  if (nlEmail.getAttribute('aria-invalid')){ nlEmail.removeAttribute('aria-invalid'); nlError.textContent = ''; }
});
document.getElementById('nl-reset').addEventListener('click', () => {
  nlForm.reset();
  nlSuccess.hidden = true;
  nlForm.hidden = false;
  nlEmail.focus();
});

// ---------- CHAT WIDGET (real-time streaming via Supabase Edge Function) ----------
const chatPanel = document.getElementById('chat-panel');
const chatFab = document.getElementById('chat-fab');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send');
let chatOpened = false;
let chatHistory = []; // resets on page reload — lives only in this tab

function addBubble(text, who){
  const b = document.createElement('div');
  b.className = 'chat-bubble ' + who;
  b.textContent = text;
  chatMessages.appendChild(b);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return b;
}

function setChatOpen(open){
  chatPanel.classList.toggle('open', open);
  chatFab.setAttribute('aria-expanded', String(open));
  chatFab.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
  if (open){
    if (!chatOpened){
      chatOpened = true;
      addBubble("Hi! Ask me anything about the work here, or tell me if you'd like to book a call.", 'bot');
    }
    chatInput.focus();
  }
}
chatFab.addEventListener('click', () => setChatOpen(!chatPanel.classList.contains('open')));
document.getElementById('chat-close').addEventListener('click', () => { setChatOpen(false); chatFab.focus(); });

async function sendChat(){
  const text = chatInput.value.trim();
  if (!text) return;
  addBubble(text, 'user');
  chatInput.value = '';
  chatSendBtn.disabled = true;

  const botBubble = addBubble('', 'bot');
  let fullReply = '';

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory })
    });

    if (!res.ok || !res.body){
      botBubble.textContent = "Sorry, I couldn't reach the assistant. Try the booking form or email instead.";
      chatSendBtn.disabled = false;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true){
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines){
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          if (json.token){
            fullReply += json.token;
            botBubble.textContent = fullReply;
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        } catch(e){ /* ignore malformed chunk */ }
      }
    }

    if (fullReply){
      chatHistory.push({ role: 'user', content: text });
      chatHistory.push({ role: 'assistant', content: fullReply });
    } else {
      botBubble.textContent = "Sorry, something went wrong. Try the booking form or email instead.";
    }
  } catch(err){
    botBubble.textContent = "Sorry, I couldn't reach the assistant. Try the booking form or email instead.";
  }
  chatSendBtn.disabled = false;
}
chatSendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
