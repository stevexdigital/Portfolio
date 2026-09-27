// Hero: n8n-style workflow canvas that loops on its own, with the hero photo in the middle.
// Kept in its own file (no inline scripts) so it works with the site's strict CSP.
(function(){
window.setHeroPhoto = function setHeroPhoto(url, initialsText){
  const img = document.getElementById('hero-photo-img');
  document.getElementById('hero-initials').textContent = initialsText || '';
  if (url){ img.setAttribute('href', url); img.onerror = () => img.removeAttribute('href'); }
};
(function initN8nCanvas(){
  const NS = 'http://www.w3.org/2000/svg';
  const S = 72, WIDE = 132;
  const ICON = {
    msgr:  `<path d="M18 4C10 4 4 10 4 17c0 4 2 7.5 5 9.6V32l5-2.8c1.3.4 2.6.6 4 .6 8 0 14-6 14-13S26 4 18 4z" fill="#0084FF"/><path d="M9 21l6-6.5 3.2 3.3 5.8-3.3-6 6.5-3.2-3.3z" fill="#fff"/>`,
    wa:    `<path d="M18 3a15 15 0 0 0-12.9 22.6L3 33l7.6-2A15 15 0 1 0 18 3z" fill="#25D366"/><path d="M13.2 10.5c-.4-.9-.8-.9-1.2-.9h-1c-.4 0-.9.1-1.4.6-.5.5-1.8 1.8-1.8 4.3s1.9 5 2.1 5.3c.3.4 3.6 5.7 8.9 7.8 4.4 1.7 5.3 1.4 6.3 1.3 1-.1 3.1-1.3 3.5-2.5.4-1.2.4-2.3.3-2.5-.1-.2-.5-.4-1-.6l-3.5-1.7c-.5-.2-.8-.3-1.2.2l-1.6 2c-.3.3-.6.4-1.1.1-.5-.2-2.1-.8-4-2.5-1.5-1.3-2.5-3-2.8-3.5-.3-.5 0-.8.2-1l.8-.9c.3-.3.4-.5.5-.9.2-.3.1-.7 0-.9l-1.6-3.8z" fill="#fff"/>`,
    phone: `<rect x="2" y="2" width="32" height="32" rx="8" fill="#7C5CFF"/><path d="M13 9.5c-.5-1.2-1.6-1.3-2.2-1.1l-1.9.7c-.9.4-1.6 1.4-1.4 2.9.6 5.8 7.6 12.8 13.4 13.4 1.5.2 2.5-.5 2.9-1.4l.7-1.9c.2-.6.1-1.7-1.1-2.2l-3-1.3c-.8-.3-1.6 0-2.1.6l-.9 1.1c-2.1-.9-4.2-3-5.1-5.1l1.1-.9c.6-.5.9-1.3.6-2.1L13 9.5z" fill="#fff"/><path d="M21 8.5a7 7 0 0 1 6.5 6.5M21 12.5a3 3 0 0 1 2.5 2.5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    agent: `<rect x="6" y="11" width="24" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="13.5" cy="20" r="2.4" fill="currentColor"/><circle cx="22.5" cy="20" r="2.4" fill="currentColor"/><path d="M18 11V6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="18" cy="5" r="2.2" fill="currentColor"/><path d="M3 18v4M33 18v4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
    voice: `<rect x="12" y="3" width="12" height="19" rx="6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M7 16a11 11 0 0 0 22 0M18 27v5M12 32h12" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    reply: `<path d="M5 6h26a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H14l-7 6v-6H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="none" stroke="#FF6D5A" stroke-width="2.4" stroke-linejoin="round"/><path d="M11 13.5h14M11 18.5h9" stroke="#FF6D5A" stroke-width="2.4" stroke-linecap="round"/>`,
    slots: `<circle cx="18" cy="18" r="14" fill="none" stroke="#0B9B7D" stroke-width="2.6"/><path d="M18 10v8l5 4" stroke="#0B9B7D" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    book:  `<rect x="3" y="6" width="30" height="27" rx="5" fill="#0B9B7D"/><rect x="3" y="6" width="30" height="8" rx="4" fill="#077A62"/><path d="M11 3v7M25 3v7" stroke="#0B9B7D" stroke-width="3" stroke-linecap="round"/><path d="M11 22.5l4.5 4.5 9-9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  };
  // small icons for the round sub-nodes (drawn in a 16x16 box)
  const SUBICON = {
    llm:      `<path d="M8 1l1.8 4.4L14 7l-4.2 1.6L8 13l-1.8-4.4L2 7l4.2-1.6z" fill="#D97757"/>`,
    analyzer: `<circle cx="7" cy="7" r="4.6" fill="none" stroke="#1B8FA8" stroke-width="2"/><path d="M10.5 10.5L14.5 14.5" stroke="#1B8FA8" stroke-width="2.2" stroke-linecap="round"/>`,
    parser:   `<path d="M5.5 2.5C3.5 2.5 4 5 4 6.5S3 8 2 8c1 0 2 .5 2 1.5S3.5 13.5 5.5 13.5M10.5 2.5c2 0 1.5 2.5 1.5 4s1 1.5 2 1.5c-1 0-2 .5-2 1.5s.5 4-1.5 4" fill="none" stroke="#7C5CFF" stroke-width="1.8" stroke-linecap="round"/>`,
    voice:    `<path d="M2 8h1.5M5 5v6M8 2.5v11M11 5v6M14 8h-1.5" stroke="#7C5CFF" stroke-width="2" stroke-linecap="round"/>`
  };
  const NODES = [
    // 1) Chat: Messenger / WhatsApp → AI Agent (model + parser) → Send Reply → AI Agent (model + parser) → Book Appointment
    {id:'msgr',  x:44,  y:26,  icon:'msgr',  name:'Messenger',        desc:'on new message', trigger:true},
    {id:'wa',    x:44,  y:148, icon:'wa',    name:'WhatsApp',         desc:'on new message', trigger:true},
    {id:'agent', x:190, y:84,  icon:'agent', name:'AI Agent',         desc:'understand', wide:true,
      subs:[{id:'a1', port:'Model',  icon:'llm',    label:'Model',  sdesc:'Claude'},
            {id:'a2', port:'Parser', icon:'parser', label:'Parser', sdesc:'JSON'}]},
    {id:'reply', x:326, y:84,  icon:'reply', name:'Send Reply',       desc:'same channel'},
    {id:'agent2',x:462, y:84,  icon:'agent', name:'AI Agent',         desc:'schedule', wide:true,
      subs:[{id:'b1', port:'Model',  icon:'llm',    label:'Model',  sdesc:'Claude'},
            {id:'b2', port:'Parser', icon:'parser', label:'Parser', sdesc:'JSON'}]},
    {id:'book',  x:612, y:84,  icon:'book',  name:'Book Appointment', desc:'call or visit'},
    // 2) AI voice receptionist (model + parser) → Check Slots → Book Appointment
    {id:'call',  x:44,  y:566, icon:'phone', name:'Incoming Call',    desc:'business line', trigger:true},
    {id:'voice', x:190, y:566, icon:'voice', name:'Voice Agent',      desc:'receptionist', wide:true,
      subs:[{id:'v1', port:'Model',  icon:'voice',  label:'Model',  sdesc:'realtime'},
            {id:'v2', port:'Parser', icon:'parser', label:'Parser', sdesc:'JSON'}]},
    {id:'slots', x:400, y:566, icon:'slots', name:'Check Slots',      desc:'GHL calendar'},
    {id:'book2', x:612, y:566, icon:'book',  name:'Book Appointment', desc:'+ SMS confirm'}
  ];
  const EDGES = [['msgr','agent'],['wa','agent'],['agent','reply'],['reply','agent2'],['agent2','book'],['call','voice'],['voice','slots'],['slots','book2']];
  const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
  const edgesG = document.getElementById('wf-edges'), nodesG = document.getElementById('wf-nodes'), packetsG = document.getElementById('wf-packets');
  const ticker = document.getElementById('wf-ticker');
  const hero = document.querySelector('.hero');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const halfW = n => (n.wide ? WIDE : S) / 2;
  const outPt = n => [n.x + halfW(n), n.y];
  const inPt  = n => [n.x - halfW(n), n.y];
  const SUB_DX = [-30, 30], SUB_DY = 88, SUB_R = 17;

  function nodeMarkup(n){
    const w = n.wide ? WIDE : S, h = S, x0 = -w/2, y0 = -h/2;
    const body = n.trigger
      ? `<path class="body" d="M${x0+h/2},${y0} H${x0+w-8} a8,8 0 0 1 8,8 V${y0+h-8} a8,8 0 0 1 -8,8 H${x0+h/2} a${h/2},${h/2} 0 0 1 0,-${h} z"/>`
      : `<rect class="body" x="${x0}" y="${y0}" width="${w}" height="${h}" rx="8"/>`;
    let out = body;
    out += `<g transform="translate(${n.wide ? x0 + 12 : -18},-18)" style="color:var(--text)">${ICON[n.icon]}</g>`;
    out += n.trigger
      ? `<path d="M${x0-16},-7 l-5,9 h5 l-2,7 7,-10 h-5 l2,-6 z" fill="#FF6D5A"/>`
      : `<rect class="handle-in" x="${x0-3}" y="-7" width="5" height="14" rx="1.5"/>`;
    out += `<circle class="handle-out" cx="${x0+w}" cy="0" r="5"/>`;
    if (n.wide){
      // name inside the wide node, sub-node ports along the bottom
      out += `<text class="iname" x="${x0+52}" y="-2">${n.name}</text><text class="idesc" x="${x0+52}" y="13">${n.desc}</text>`;
      n.subs.forEach((sub, i) => {
        const dx = SUB_DX[i];
        out += `<rect class="diamond" x="${dx-4.5}" y="${h/2-4.5}" width="9" height="9" transform="rotate(45 ${dx} ${h/2})"/>`;
        out += `<text class="port" x="${dx}" y="${h/2+16}" text-anchor="middle">${sub.port}</text>`;
      });
    } else {
      out += `<text class="name" x="0" y="${h/2+20}" text-anchor="middle">${n.name}</text>`;
      out += `<text class="desc" x="0" y="${h/2+34}" text-anchor="middle">${n.desc}</text>`;
    }
    out += `<g class="ok" transform="translate(${x0+w-12},${y0+h-12})"><circle r="8" fill="var(--ok)"/><path d="M-3.5 0l2.5 2.5 4.5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
    out += `<circle class="spin" cx="${x0+w-12}" cy="${y0+12}" r="6" fill="none" stroke="var(--n8n-run)" stroke-width="2.2" stroke-dasharray="26 12"/>`;
    return out;
  }
  function subMarkup(sub){
    return `<circle class="ring" r="${SUB_R}"/>
      <g transform="translate(-8,-8)">${SUBICON[sub.icon]}</g>
      <text class="lbl" y="${SUB_R+14}" text-anchor="middle">${sub.label}</text>
      <text class="sdesc" y="${SUB_R+25}" text-anchor="middle">${sub.sdesc}</text>
      <g class="ok" transform="translate(${SUB_R-4},${SUB_R-4})"><circle r="6" fill="var(--ok)"/><path d="M-2.5 0l1.8 1.8 3.4-3.6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
  }

  const edgeEls = {}, itemEls = {};
  EDGES.forEach(([f, t]) => {
    const [x1, y1] = outPt(byId[f]), [x2, y2] = inPt(byId[t]);
    const dx = Math.max(40, (x2 - x1) / 2);
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', `M${x1+5},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2-6},${y2}`);
    p.setAttribute('class', 'n-edge'); p.setAttribute('marker-end', 'url(#n-arrow)');
    edgesG.appendChild(p); edgeEls[f+'>'+t] = p;
    const lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('class', 'n-items'); lbl.setAttribute('x', (x1+x2)/2); lbl.setAttribute('y', (y1+y2)/2 - 8); lbl.setAttribute('text-anchor', 'middle');
    lbl.textContent = '1 item';
    if (x2 - x1 < 70) lbl.style.display = 'none';   // too short for a label
    edgesG.appendChild(lbl); itemEls[f+'>'+t] = lbl;
  });
  const stub = (x, y) => `<line class="n-stub" x1="${x+5}" y1="${y}" x2="${x+22}" y2="${y}"/><g class="n-plus" transform="translate(${x+22},${y-8})"><rect width="16" height="16" rx="3"/><path d="M8 4v8M4 8h8"/></g>`;
  edgesG.insertAdjacentHTML('beforeend', [byId.book, byId.book2].map(n => { const [x,y] = outPt(n); return stub(x,y); }).join(''));

  const nodeEls = {}, subEls = {}, linkEls = {};
  NODES.forEach(n => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'n-node'); g.setAttribute('transform', `translate(${n.x},${n.y})`);
    g.innerHTML = nodeMarkup(n);
    nodesG.appendChild(g); nodeEls[n.id] = g;
    (n.subs || []).forEach((sub, i) => {
      const sx = n.x + SUB_DX[i], sy = n.y + SUB_DY;
      const link = document.createElementNS(NS, 'path');
      link.setAttribute('class', 'n-link');
      link.setAttribute('d', `M${sx},${n.y + S/2 + 21} V${sy - SUB_R}`);
      edgesG.appendChild(link); linkEls[sub.id] = link;
      const sg = document.createElementNS(NS, 'g');
      sg.setAttribute('class', 'n-sub'); sg.setAttribute('transform', `translate(${sx},${sy})`);
      sg.innerHTML = subMarkup(sub);
      nodesG.appendChild(sg); subEls[sub.id] = sg;
    });
  });

  const say = html => { ticker.innerHTML = html; };
  const reset = ids => ids.forEach(id => {
    (nodeEls[id] || subEls[id]).classList.remove('done','running');
    if (linkEls[id]) linkEls[id].classList.remove('done');
  });
  const resetEdges = keys => keys.forEach(k => { edgeEls[k].classList.remove('done','hot'); itemEls[k].classList.remove('show'); });

  if (reduceMotion){
    [...Object.values(nodeEls), ...Object.values(subEls)].forEach(g => g.classList.add('done'));
    Object.values(linkEls).forEach(l => l.classList.add('done'));
    Object.keys(edgeEls).forEach(k => { edgeEls[k].classList.add('done'); itemEls[k].classList.add('show'); });
    say('message → AI Agent → reply → appointment booked ✓');
    return;
  }

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(hero);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const whenVisible = async () => { while (!visible || document.hidden) await wait(400); };

  function sendPacket(key, ms){
    return new Promise(res => {
      const path = edgeEls[key], len = path.getTotalLength();
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '5'); c.setAttribute('class', 'n-packet'); packetsG.appendChild(c);
      path.classList.add('hot');
      const t0 = performance.now();
      (function step(now){
        const k = Math.min(1, (now-t0)/ms), e = k<.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2;
        const pt = path.getPointAtLength(len*e); c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y);
        if (k < 1) requestAnimationFrame(step);
        else { c.remove(); path.classList.remove('hot'); path.classList.add('done'); itemEls[key].classList.add('show'); res(); }
      })(t0);
    });
  }
  async function run(id, text, ms=650){
    nodeEls[id].classList.add('running'); await wait(ms);
    nodeEls[id].classList.remove('running'); nodeEls[id].classList.add('done');
    if (text) say(text);
  }
  // agent node spins while each sub-node (LLM → analyzer → parser) does its part
  async function runAgent(id, steps){
    const n = byId[id];
    nodeEls[id].classList.add('running');
    for (let i = 0; i < n.subs.length; i++){
      const sub = n.subs[i], el = subEls[sub.id];
      el.classList.add('running'); say(steps[i]); await wait(900);
      el.classList.remove('running'); el.classList.add('done'); linkEls[sub.id].classList.add('done');
    }
    nodeEls[id].classList.remove('running'); nodeEls[id].classList.add('done');
  }

  const CHATS = [
    {src:'wa',   ch:'WhatsApp',  who:'Maria', msg:'Can I get a teeth cleaning this week?', json1:'{intent:"book visit", service:"cleaning"}',
     reply:'Sure! Thu 10 AM or Fri 2 PM?', answer:'Thu 10 AM please', json2:'{type:"visit", date:"Thu", time:"10:00"}', booked:'clinic visit · Thu 10:00 AM'},
    {src:'msgr', ch:'Messenger', who:'Jake',  msg:'Can we talk about automating my leads?', json1:'{intent:"book call", topic:"lead automation"}',
     reply:'Happy to! Mon 9:30 AM or Tue 1 PM?', answer:'Monday works', json2:'{type:"call", date:"Mon", time:"09:30"}', booked:'discovery call · Mon 9:30 AM'},
    {src:'wa',   ch:'WhatsApp',  who:'Ana',   msg:'Pre-employment medical tomorrow?', json1:'{intent:"book visit", service:"medical exam"}',
     reply:'Yes! 8 AM or 11 AM tomorrow?', answer:'8 AM', json2:'{type:"visit", date:"Tue", time:"08:00"}', booked:'lab visit · Tue 8:00 AM'}
  ];
  const CALLS = [
    {who:'caller from Tampa, FL', json:'{type:"visit", service:"consult", time:"Wed 15:00"}', booked:'clinic visit · Wed 3:00 PM'},
    {who:'caller from Davao',     json:'{type:"call", topic:"pricing", time:"Fri 09:00"}',   booked:'call back · Fri 9:00 AM'}
  ];
  async function flowChat(C){
    const ids = ['msgr','wa','agent','a1','a2','reply','agent2','b1','b2','book'], keys = ['msgr>agent','wa>agent','agent>reply','reply>agent2','agent2>book'];
    reset(ids); resetEdges(keys);
    await run(C.src, `${C.ch} from <b>${C.who}</b>: “${C.msg}”`, 800);
    await sendPacket(C.src + '>agent', 800);
    await runAgent('agent', ['Model reading the message…', `Parser → <span class="hl">${C.json1}</span>`]);
    await sendPacket('agent>reply', 750);
    await run('reply', `replied: “${C.reply}”`, 900);
    await sendPacket('reply>agent2', 750);
    await runAgent('agent2', [`${C.who} answered: “${C.answer}”`, `Parser → <span class="hl">${C.json2}</span>`]);
    await sendPacket('agent2>book', 750);
    await run('book', `booked · <span class="hl">${C.booked}</span> ✓`);
  }
  async function flowVoice(V){
    const ids = ['call','voice','v1','v2','slots','book2'], keys = ['call>voice','voice>slots','slots>book2'];
    reset(ids); resetEdges(keys);
    await run('call', `incoming call · <b>${V.who}</b>`, 800);
    await sendPacket('call>voice', 800);
    await runAgent('voice', ['AI receptionist answered: “Hi, how can I help?”', `Parser → <span class="hl">${V.json}</span>`]);
    await sendPacket('voice>slots', 800);
    await run('slots', 'checked calendar · slot is open');
    await sendPacket('slots>book2', 800);
    await run('book2', `booked · <span class="hl">${V.booked}</span> · SMS sent ✓`);
  }
  async function loop(){
    for (let i = 0; ; i++){
      await whenVisible(); await flowChat(CHATS[i % CHATS.length]); await wait(1600);
      await whenVisible(); await flowVoice(CALLS[i % CALLS.length]); await wait(1600);
    }
  }
  setTimeout(loop, 500);
})();
})();
