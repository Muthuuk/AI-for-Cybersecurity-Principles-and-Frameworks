/* Guide to AI for Cybersecurity course: "Try it" interactive labs.
   Labs.render(host, spec, onDone) builds one hands-on exercise.
   Types: order (put steps in sequence), sort (place items in the right group),
   threshold (move an alert threshold and watch the results), spot (find the warning signs). */
(function(){
  function h(tag, attrs, ...kids){ const e = document.createElement(tag); if (attrs) for (const [k,v] of Object.entries(attrs)){ if (k==='class') e.className = v; else if (k==='html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v!==false && v!=null) e.setAttribute(k, v===true?'':v); } for (const k of kids.flat()) if (k!=null && k!==false) e.append(k.nodeType ? k : document.createTextNode(k)); return e; }
  const shuffle = a => { const b = a.slice(); for (let i=b.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [b[i],b[j]] = [b[j],b[i]]; } return b; };

  /* ORDER: click items to place them in order */
  function order(host, spec, done){
    const placed = []; const tray = h('div',{class:'tray'}); const slots = h('div',{class:'slots'}); const fb = h('p',{class:'fb'});
    const items = shuffle(spec.items.map((t,i)=>({t,i})));
    function draw(){
      tray.innerHTML = ''; slots.innerHTML = '';
      items.forEach(it => { if (placed.includes(it)) return; tray.append(h('button',{class:'chip',type:'button',onclick:()=>{ placed.push(it); draw(); }}, it.t)); });
      spec.items.forEach((_,k) => { const it = placed[k]; slots.append(h('div',{class:'slot'}, h('span',{class:'n'}, (k+1)+'.'), it ? h('span',null,it.t) : h('span',{style:'color:var(--muted)'},'…'))); });
      check.disabled = placed.length !== spec.items.length;
    }
    const check = h('button',{class:'btn primary',type:'button'},'Check my order');
    const reset = h('button',{class:'btn',type:'button',onclick:()=>{ placed.length = 0; fb.innerHTML=''; draw(); }},'Start again');
    check.onclick = () => {
      const ok = placed.every((it,k)=>it.i===k);
      [...slots.children].forEach((s,k)=>{ s.style.borderStyle='solid'; s.style.borderColor = placed[k].i===k ? 'var(--good)' : 'var(--bad)'; });
      fb.innerHTML = ok ? `<b>Correct.</b> ${spec.explain||''}` : `<b>Not quite.</b> Red rows are in the wrong place. The right order is: ${spec.items.map((t,k)=>(k+1)+'. '+t).join(' → ')}.`;
      done(ok);
    };
    host.append(h('p',{class:'q'},spec.prompt), h('p',{class:'lede',style:'font-size:.9rem'},'Click the items in the order they happen.'), tray, slots, h('div',{class:'row'}, check, reset), fb);
    draw();
  }

  /* SORT: pick an item, then the group it belongs to */
  function sort(host, spec, done){
    let sel = null; const fb = h('p',{class:'fb'}); const where = new Map();
    const tray = h('div',{class:'tray'}); const bk = h('div',{class:'buckets'});
    const items = shuffle(spec.items);
    function draw(){
      tray.innerHTML=''; bk.innerHTML='';
      items.forEach(it => { if (where.has(it)) return; tray.append(h('button',{class:'chip'+(sel===it?' sel':''),type:'button',onclick:()=>{ sel = it; draw(); }}, it.t)); });
      spec.buckets.forEach((b,bi) => { const box = h('div',{class:'bucket'}, h('h4',null,b));
        items.filter(it=>where.get(it)===bi).forEach(it => box.append(h('button',{class:'chip',type:'button',title:'Click to take it back',onclick:()=>{ where.delete(it); draw(); }}, it.t)));
        box.append(h('button',{class:'target',type:'button',disabled: !sel,onclick:()=>{ if (sel){ where.set(sel,bi); sel=null; draw(); } }}, sel ? 'Put it here' : 'Pick an item first'));
        bk.append(box); });
      check.disabled = where.size !== items.length;
    }
    const check = h('button',{class:'btn primary',type:'button'},'Check my groups');
    check.onclick = () => {
      let right = 0; items.forEach(it => { if (where.get(it)===it.b) right++; });
      bk.querySelectorAll('.bucket').forEach((box,bi)=>{ box.querySelectorAll('.chip').forEach(c=>{ const it = items.find(x=>x.t===c.textContent); c.classList.add(it.b===bi?'right':'wrong'); c.disabled = true; }); box.querySelector('.target').remove(); });
      fb.innerHTML = `<b>${right} of ${items.length} in the right group.</b> ` + items.filter(it=>where.get(it)!==it.b).map(it=>`“${it.t}” belongs in ${spec.buckets[it.b]}${it.why?': '+it.why:''}.`).join(' ') + (right===items.length ? (' ' + (spec.explain||'')) : '');
      check.disabled = true; done(right===items.length);
    };
    host.append(h('p',{class:'q'},spec.prompt), h('p',{class:'lede',style:'font-size:.9rem'},'Click an item, then click "Put it here" in the right group.'), tray, bk, h('div',{class:'row'}, check, h('button',{class:'btn',type:'button',onclick:()=>{ where.clear(); sel=null; fb.innerHTML=''; check.disabled=false; draw(); }},'Start again')), fb);
    draw();
  }

  /* THRESHOLD: a detector gives each event a score; you choose where to raise an alert */
  function threshold(host, spec, done){
    // deterministic synthetic scores: attacks score high, normal events low, with overlap
    let s = 7; const rnd = () => (s = (s*16807) % 2147483647) / 2147483647;
    const gauss = (m, sd) => { const u = 1 - rnd(), v = rnd(); return m + sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
    const nA = spec.attacks || 50, nB = spec.normal || 950;
    const ev = []; for (let i=0;i<nA;i++) ev.push({ a:1, s: Math.min(99, Math.max(1, gauss(72, 13))) }); for (let i=0;i<nB;i++) ev.push({ a:0, s: Math.min(99, Math.max(1, gauss(35, 14))) });
    const cfp = spec.costFP, cfn = spec.costFN, useCost = cfp != null && cfn != null;
    function stats(t){ let tp=0,fp=0,fn=0,tn=0; ev.forEach(e=>{ const al = e.s >= t; if (e.a){ al?tp++:fn++; } else { al?fp++:tn++; } });
      const P = tp+fp ? tp/(tp+fp) : 0, R = tp/(tp+fn), F = P+R ? 2*P*R/(P+R) : 0, acc = (tp+tn)/ev.length; return {tp,fp,fn,tn,P,R,F,acc,cost: useCost ? fp*cfp + fn*cfn : null}; }
    let best = 50, bestV = Infinity; for (let t=1;t<=99;t++){ const st = stats(t); const v = useCost ? st.cost : -st.F; if (v < bestV){ bestV = v; best = t; } }
    const out = h('div',{class:'meter'}); const fb = h('p',{class:'fb'});
    const slider = h('input',{type:'range',min:'1',max:'99',value:String(spec.start||50),'aria-label':'Alert threshold'});
    const tv = h('b',{class:'mono'});
    const cell = (k,v) => h('div',null, h('small',null,k), h('b',null,v));
    function draw(){ const t = +slider.value, st = stats(t); tv.textContent = t; out.innerHTML='';
      out.append(cell('Attacks caught', `${st.tp}/${nA}`), cell('Attacks missed', st.fn), cell('False alarms', st.fp), cell('Precision', Math.round(st.P*100)+'%'), cell('Recall', Math.round(st.R*100)+'%'), cell('F1', st.F.toFixed(2)), cell('Accuracy', Math.round(st.acc*100)+'%'));
      if (useCost) out.append(cell('Total cost', '£'+st.cost.toLocaleString('en-GB'))); }
    slider.oninput = draw;
    const check = h('button',{class:'btn primary',type:'button'}, useCost ? 'Is this the lowest cost?' : 'Is this a good balance?');
    check.onclick = () => { const t = +slider.value, st = stats(t), bs = stats(best);
      const ok = useCost ? st.cost <= bs.cost*1.1 : st.F >= bs.F - 0.03;
      fb.innerHTML = ok ? `<b>Good choice.</b> ${spec.explain||''}` : `<b>You can do better.</b> ${useCost ? `A threshold around ${best} costs about £${bs.cost.toLocaleString('en-GB')}.` : `A threshold around ${best} gives an F1 of ${bs.F.toFixed(2)}.`} Watch how accuracy, precision and recall move as you change the threshold: the setting that looks best on one measure is often not the best overall.`;
      done(ok); };
    host.append(h('p',{class:'q'},spec.prompt),
      h('p',{class:'lede',style:'font-size:.9rem'}, `${nA} attacks hidden among ${nB} normal events. The detector gives each one a score from 1 to 99. Events at or above your threshold raise an alert.` + (useCost ? ` Each false alarm costs £${cfp} of analyst time; each missed attack costs £${cfn.toLocaleString('en-GB')}.` : '')),
      h('div',{class:'row'}, h('span',null,'Alert threshold:'), tv), slider, out, h('div',{class:'row'}, check), fb);
    draw();
  }

  /* SPOT: click the parts of a message that are warning signs */
  function spot(host, spec, done){
    const need = spec.parts.filter(p=>p.bad).length; let found = 0, wrong = 0;
    const fb = h('div',{class:'fb'}); const count = h('p',{class:'eyebrow'});
    const box = h('div',{class:'mail'});
    const upd = () => count.textContent = `Warning signs found: ${found} of ${need}`;
    spec.parts.forEach(p => { const b = h('button',{class:'part',type:'button'}, h('span',{class:'lbl'},p.lbl), p.t);
      b.onclick = () => { b.disabled = true; b.classList.add(p.bad?'right':'wrong'); if (p.bad) found++; else wrong++;
        fb.prepend(h('p',null, h('b',null, p.bad ? 'Warning sign. ' : 'This part looks normal. '), p.why || ''));
        upd(); if (found === need){ box.querySelectorAll('.part').forEach(x=>x.disabled=true); fb.prepend(h('p',null, h('b',null, wrong ? `All ${need} found, with ${wrong} false alarm${wrong>1?'s':''}. ` : 'All found with no false alarms. '), spec.explain||'')); done(wrong===0); } };
      box.append(b); });
    host.append(h('p',{class:'q'},spec.prompt), h('p',{class:'lede',style:'font-size:.9rem'},'Click each part you think is suspicious. Clicking a normal part counts as a false alarm.'), count, box, fb);
    upd();
  }

  const TYPES = { order, sort, threshold, spot };
  window.Labs = { render(host, spec, done){ (TYPES[spec.type] || (()=>{}))(host, spec, done || (()=>{})); } };
})();
