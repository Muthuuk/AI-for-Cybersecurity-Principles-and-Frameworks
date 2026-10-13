/* Guide to AI for Cybersecurity course: 3D animated scenes (Three.js r128).
   Each lesson slide names a scene in its data. The scene runs as a live 3D animation
   and moves forward one step for each sentence the tutor speaks.

   Scenes.mount(stageElement, spec) returns { step(k), auto(on), dispose() }.
   Scene types: graph, flood, train, bars, pixels, clusters, curve, people. */
(function(){
  const COL = { cyan:'#38BDF8', green:'#4ADE80', red:'#F87171', amber:'#FBBF24', violet:'#A78BFA', slate:'#94A3B8', white:'#E2E8F0', pink:'#F472B6' };
  const col = c => new THREE.Color(COL[c] || c || COL.cyan);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function webglOK(){ try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch(e){ return false; } }

  /* text label as a sprite that always faces the camera */
  function label(text, opts){
    opts = opts || {};
    const fs = opts.size || 44, pad = 18, cvs = document.createElement('canvas'), g = cvs.getContext('2d');
    g.font = `600 ${fs}px "Public Sans", Arial, sans-serif`;
    const lines = String(text).split('\n'); const w = Math.max(...lines.map(l => g.measureText(l).width)) + pad*2, hgt = lines.length*fs*1.2 + pad*1.4;
    cvs.width = Math.ceil(w); cvs.height = Math.ceil(hgt);
    g.font = `600 ${fs}px "Public Sans", Arial, sans-serif`;
    const r = 18; g.fillStyle = opts.bg || 'rgba(8,16,32,0.82)'; g.strokeStyle = opts.border || 'rgba(56,189,248,0.75)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(r,2); g.lineTo(cvs.width-r,2); g.quadraticCurveTo(cvs.width-2,2,cvs.width-2,r); g.lineTo(cvs.width-2,cvs.height-r); g.quadraticCurveTo(cvs.width-2,cvs.height-2,cvs.width-r,cvs.height-2); g.lineTo(r,cvs.height-2); g.quadraticCurveTo(2,cvs.height-2,2,cvs.height-r); g.lineTo(2,r); g.quadraticCurveTo(2,2,r,2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = opts.color || '#E6F1FF'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l,i) => g.fillText(l, cvs.width/2, pad*0.7 + fs*0.6 + i*fs*1.2));
    const tex = new THREE.CanvasTexture(cvs); tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const s = (opts.scale || 0.55);
    sp.scale.set(s*cvs.width/cvs.height, s, 1); sp.renderOrder = 10;
    return sp;
  }

  function shapeMesh(shape, color, size){
    size = size || 1; let geo;
    if (shape === 'sphere') geo = new THREE.SphereGeometry(0.5*size, 32, 20);
    else if (shape === 'cyl') geo = new THREE.CylinderGeometry(0.45*size, 0.45*size, 0.8*size, 32);
    else if (shape === 'ico') geo = new THREE.IcosahedronGeometry(0.6*size, 1);
    else if (shape === 'shield') geo = new THREE.CylinderGeometry(0.7*size, 0.7*size, 0.18*size, 6);
    else if (shape === 'slab') geo = new THREE.BoxGeometry(2.6*size, 0.18*size, 1.4*size);
    else if (shape === 'torus') geo = new THREE.TorusGeometry(0.45*size, 0.14*size, 16, 48);
    else geo = new THREE.BoxGeometry(0.9*size, 0.9*size, 0.9*size);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, metalness: 0.35, roughness: 0.35, transparent: true, opacity: 1 });
    const m = new THREE.Mesh(geo, mat);
    if (shape === 'shield') m.rotation.x = Math.PI/2;
    return m;
  }

  function core(stage, spec){
    const W = () => stage.clientWidth || 640, H = () => stage.clientHeight || 360;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W(), H(), false);
    renderer.setClearColor(0x0A1222, 1);
    stage.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0A1222, 14, 34);
    const camera = new THREE.PerspectiveCamera(45, W()/H(), 0.1, 100);
    const cam = spec.cam || [0, 4.2, 12.5]; camera.position.set(...cam);
    const target = new THREE.Vector3(...(spec.look || [0, 0.6, 0])); camera.lookAt(target);
    scene.add(new THREE.AmbientLight(0x8fb4ff, 0.55));
    const d = new THREE.DirectionalLight(0xffffff, 0.9); d.position.set(5, 9, 7); scene.add(d);
    const p = new THREE.PointLight(0x38bdf8, 1.1, 30); p.position.set(-6, 5, 4); scene.add(p);
    if (spec.floor !== false){
      const grid = new THREE.GridHelper(40, 40, 0x1e3a5f, 0x13233d); grid.position.y = -1.6; scene.add(grid);
    }
    // a few drifting background "data motes" for depth
    const motes = new THREE.BufferGeometry(); const N = 220, pos = new Float32Array(N*3);
    for (let i=0;i<N;i++){ pos[i*3] = (Math.random()-0.5)*30; pos[i*3+1] = Math.random()*10-1.5; pos[i*3+2] = -6 - Math.random()*10; }
    motes.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const motePts = new THREE.Points(motes, new THREE.PointsMaterial({ color: 0x2b6cb0, size: 0.06, transparent: true, opacity: 0.7 }));
    scene.add(motePts);
    const camBase = camera.position.clone(); const radius = Math.hypot(camBase.x - target.x, camBase.z - target.z); const ang0 = Math.atan2(camBase.x - target.x, camBase.z - target.z);
    let running = true, raf = 0, last = performance.now(); const updaters = [];
    function frame(now){
      if (!running) return;
      const dt = Math.min(0.05, (now - last)/1000); last = now;
      if (!reduced()){
        const a = ang0 + Math.sin(now/7000) * (spec.orbit ?? 0.28);
        camera.position.x = target.x + Math.sin(a)*radius; camera.position.z = target.z + Math.cos(a)*radius;
        camera.position.y = camBase.y + Math.sin(now/5200)*0.25; camera.lookAt(target);
        motePts.position.x = Math.sin(now/9000)*1.2;
      }
      updaters.forEach(f => f(dt, now));
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => { renderer.setSize(W(), H(), false); camera.aspect = W()/H(); camera.updateProjectionMatrix(); });
    ro.observe(stage);
    function dispose(){
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
      renderer.dispose(); renderer.domElement.remove();
    }
    return { scene, camera, renderer, updaters, dispose };
  }

  /* helper: emphasise a mesh smoothly */
  function emph(m, on, dim){
    m.userData.goalE = on ? 0.95 : (dim ? 0.08 : 0.25);
    m.userData.goalS = on ? 1.15 : 1;
    m.userData.goalO = (dim && !on) ? 0.28 : 1;
  }
  function settle(m, dt){
    const u = m.userData, k = Math.min(1, dt*6);
    if (u.goalE != null) m.material.emissiveIntensity += (u.goalE - m.material.emissiveIntensity)*k;
    if (u.goalS != null){ const s = m.scale.x + (u.goalS - m.scale.x)*k; m.scale.setScalar(s); }
    if (u.goalO != null) m.material.opacity += (u.goalO - m.material.opacity)*k;
  }

  /* ---------- GRAPH: labelled nodes, links with moving data particles ---------- */
  function graph(stage, spec){
    const C = core(stage, spec), byId = {}, nodes = [];
    spec.nodes.forEach(n => {
      const m = shapeMesh(n.shape, col(n.c), n.size); m.position.set(...n.p); C.scene.add(m);
      const lb = label(n.label, { scale: n.ls || 0.8, border: COL[n.c] || n.c }); lb.position.set(n.p[0], n.p[1] + (n.ly ?? 1.15*(n.size||1)), n.p[2]); C.scene.add(lb);
      m.userData.spin = n.spin; byId[n.id] = m; nodes.push(m); m.userData.label = lb;
    });
    const links = (spec.links || []).map(l => {
      const a = byId[l[0]], b = byId[l[1]], w = l[2] || 1;
      const g = new THREE.BufferGeometry().setFromPoints([a.position, b.position]);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.45 })); C.scene.add(line);
      const parts = []; const cnt = Math.max(1, Math.round(3*w));
      for (let i=0;i<cnt;i++){ const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: col(l[3] || 'cyan'), transparent: true, opacity: 0.95 })); s.userData.t = i/cnt; C.scene.add(s); parts.push(s); }
      return { a, b, line, parts, ids: [l[0], l[1]] };
    });
    let hi = null;
    C.updaters.push((dt, now) => {
      nodes.forEach(m => { settle(m, dt); if (m.userData.spin && !reduced()) m.rotation.y += dt*0.6; });
      links.forEach(L => { const on = !hi || hi.has(L.ids[0]) || hi.has(L.ids[1]);
        L.line.material.opacity += ((on ? 0.6 : 0.12) - L.line.material.opacity)*Math.min(1, dt*5);
        L.parts.forEach(s => { s.userData.t = (s.userData.t + dt*(spec.speed || 0.35)) % 1; s.position.lerpVectors(L.a.position, L.b.position, s.userData.t); s.material.opacity = on ? 0.95 : 0.15; }); });
    });
    function step(k){
      const st = spec.steps ? spec.steps[Math.min(k, spec.steps.length-1)] : null;
      hi = (!st || st === 'all') ? null : new Set(st);
      nodes.forEach((m, i) => { const id = spec.nodes[i].id; emph(m, hi ? hi.has(id) : false, !!hi); m.userData.label.material.opacity = (!hi || hi.has(id)) ? 1 : 0.35; });
    }
    step(-1); nodes.forEach(m => emph(m, false, false));
    return { step, dispose: C.dispose, nSteps: spec.steps ? spec.steps.length : 1 };
  }

  /* ---------- FLOOD: a stream of events hits a signature wall; ML catches the new ones ---------- */
  function flood(stage, spec){
    const C = core(stage, Object.assign({ cam: [0, 3.6, 12] }, spec));
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 5), new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0x334155, transparent: true, opacity: 0.55, metalness: 0.5, roughness: 0.3 }));
    wall.position.set(0.5, 0.2, 0); C.scene.add(wall);
    const wl = label(spec.wallLabel || 'Signature filter', { scale: 0.45 }); wl.position.set(0.5, 2.6, 0); C.scene.add(wl);
    const ml = new THREE.Mesh(new THREE.TorusKnotGeometry(0.7, 0.2, 120, 16), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.6, transparent: true, opacity: 0 }));
    ml.position.set(4.2, 0.4, 0); C.scene.add(ml);
    const mll = label(spec.mlLabel || 'ML detector', { scale: 0.45 }); mll.position.set(4.2, 2.0, 0); mll.material.opacity = 0; C.scene.add(mll);
    const kinds = { benign: [new THREE.Color('#9A9FA8'), 0.22], known: [col('red'), 0.34], novel: [col('violet'), 0.34] };
    const items = []; let rate = 6, acc = 0, mlOn = false, showNovel = false;
    const vol = label('', { scale: 0.42 }); vol.position.set(-5.2, 2.6, 0);
    C.updaters.push((dt) => {
      acc += dt*rate; while (acc > 1){ acc -= 1;
        const r = Math.random(), kind = r < 0.62 ? 'benign' : r < 0.82 ? 'known' : 'novel';
        const [c, s] = kinds[kind]; const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: kind==='novel' && showNovel ? 0.9 : 0.3 }));
        m.position.set(-8, -0.8 + Math.random()*2.6, -2 + Math.random()*4); m.userData = { kind, v: 2.2 + Math.random()*1.3, dead: false }; C.scene.add(m); items.push(m); }
      for (let i = items.length-1; i>=0; i--){ const m = items[i], u = m.userData;
        m.position.x += u.v*dt; m.rotation.x += dt*1.5; m.rotation.y += dt;
        if (u.kind === 'known' && m.position.x > 0.2 && !u.dead){ u.dead = true; }
        if (u.kind === 'novel' && mlOn && m.position.x > 3.8 && !u.dead){ u.dead = true; }
        if (u.dead){ m.scale.multiplyScalar(1 - dt*5); u.v = 0.3; }
        if (u.kind === 'novel') m.material.emissiveIntensity = showNovel ? 0.6 + 0.4*Math.sin(performance.now()/120) : 0.3;
        if (m.position.x > 9 || m.scale.x < 0.05){ C.scene.remove(m); m.geometry.dispose(); m.material.dispose(); items.splice(i,1); } }
      ml.rotation.y += dt*0.8; ml.rotation.x += dt*0.3;
      ml.material.opacity += ((mlOn ? 0.95 : 0) - ml.material.opacity)*Math.min(1, dt*3); mll.material.opacity = ml.material.opacity;
    });
    const legend = label('grey = normal   red = known threat   purple = new threat', { scale: 0.34, border: 'rgba(148,163,184,.6)' }); legend.position.set(0, -2.3, 2); C.scene.add(legend);
    function step(k){
      const s = (spec.steps || [])[Math.min(k, (spec.steps||[]).length-1)] || {};
      rate = s.rate || 6; showNovel = !!s.novel; mlOn = !!s.ml;
    }
    step(0);
    return { step, dispose: C.dispose, nSteps: (spec.steps||[1]).length };
  }

  /* ---------- TRAIN: labelled examples teach a model, then it labels new events ---------- */
  function train(stage, spec){
    const C = core(stage, spec);
    const model = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.3, wireframe: true }));
    model.position.set(0, 0.6, 0); C.scene.add(model);
    const core2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshStandardMaterial({ color: 0x0c4a6e, emissive: 0x38bdf8, emissiveIntensity: 0.2 }));
    core2.position.copy(model.position); C.scene.add(core2);
    const ml = label(spec.modelLabel || 'Model', { scale: 0.45 }); ml.position.set(0, 2.4, 0); C.scene.add(ml);
    const inL = label(spec.inLabel || 'Labelled examples', { scale: 0.4 }); inL.position.set(-5, 2.2, 0); C.scene.add(inL);
    const outL = label(spec.outLabel || 'Predictions', { scale: 0.4 }); outL.position.set(5, 2.2, 0); outL.material.opacity = 0.3; C.scene.add(outL);
    let phase = 0, acc = 0, learned = 0; const items = [];
    C.updaters.push((dt) => {
      acc += dt*4; while (acc > 1){ acc -= 1;
        const bad = Math.random() < 0.4; const unknown = phase >= 2;
        const c = unknown ? col('slate') : (bad ? col('red') : col('green'));
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35 }));
        m.position.set(-7, 0.6 + (Math.random()-0.5)*1.6, (Math.random()-0.5)*2.5); m.userData = { bad, unknown, done: false }; C.scene.add(m); items.push(m); }
      for (let i = items.length-1; i>=0; i--){ const m = items[i], u = m.userData;
        m.position.x += dt*2.6; m.rotation.y += dt*2;
        if (m.position.x > -0.2 && !u.done){ u.done = true;
          if (!u.unknown){ learned = Math.min(1, learned + 0.02); m.scale.setScalar(0.01); }
          else { const c = u.bad ? col('red') : col('green'); m.material.color.copy(c); m.material.emissive.copy(c); m.material.emissiveIntensity = 0.8; } }
        if (m.position.x > 7 || m.scale.x < 0.02 && m.position.x > 0.2){ C.scene.remove(m); m.geometry.dispose(); m.material.dispose(); items.splice(i,1); } }
      model.rotation.y += dt*(0.4 + learned); model.rotation.x += dt*0.2;
      core2.material.emissiveIntensity = 0.2 + learned*0.9; core2.scale.setScalar(0.8 + learned*0.5);
      outL.material.opacity += ((phase>=2?1:0.3) - outL.material.opacity)*Math.min(1, dt*3);
    });
    function step(k){ const s = (spec.steps || [0])[Math.min(k, (spec.steps||[0]).length-1)]; phase = s; if (phase >= 1) learned = Math.max(learned, 0.6); }
    step(0);
    return { step, dispose: C.dispose, nSteps: (spec.steps||[0]).length };
  }

  /* ---------- BARS: a 3D confusion matrix (or any small set of labelled bars) ---------- */
  function bars(stage, spec){
    const C = core(stage, Object.assign({ cam: [0, 5.5, 10], look: [0, 0.6, 0] }, spec));
    const items = spec.bars.map(b => {
      const hgt = spec.sq ? 0.3 + Math.sqrt(b.v)*spec.sq : Math.max(0.15, b.v * (spec.scale || 0.05));
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.6), new THREE.MeshStandardMaterial({ color: col(b.c), emissive: col(b.c), emissiveIntensity: 0.25, transparent: true, metalness: 0.3, roughness: 0.4 }));
      m.position.set(b.p[0], -1.6, b.p[1]); m.userData.h = hgt; m.userData.cur = 0.01; m.scale.y = 0.01; C.scene.add(m);
      const lb = label(`${b.label}\n${b.v}`, { scale: 0.62, border: COL[b.c] }); C.scene.add(lb); m.userData.label = lb;
      return m; });
    (spec.axes || []).forEach(a => { const l = label(a.t, { scale: 0.42, border: 'rgba(148,163,184,.6)' }); l.position.set(...a.p); C.scene.add(l); });
    C.updaters.push(dt => items.forEach(m => { const u = m.userData; u.cur += (u.h - u.cur)*Math.min(1, dt*3); m.scale.y = Math.max(0.01, u.cur); m.position.y = -1.6 + u.cur/2; u.label.position.set(m.position.x, -1.6 + u.cur + 0.75, m.position.z); settle(m, dt); }));
    function step(k){ const st = spec.steps ? spec.steps[Math.min(k, spec.steps.length-1)] : 'all'; const set = st === 'all' ? null : new Set(st);
      items.forEach((m, i) => { emph(m, set ? set.has(spec.bars[i].id) : false, !!set); m.userData.label.material.opacity = (!set || set.has(spec.bars[i].id)) ? 1 : 0.35; }); }
    step(0);
    return { step, dispose: C.dispose, nSteps: spec.steps ? spec.steps.length : 1 };
  }

  /* ---------- PIXELS: a file's bytes become a picture (CNN), actions become a sequence (RNN) ---------- */
  function pixels(stage, spec){
    const C = core(stage, Object.assign({ cam: [0, 5, 11] }, spec));
    const G = 14, cubes = []; let mode = 0;
    const seed = i => { const x = Math.sin(i*12.9898)*43758.5453; return x - Math.floor(x); };
    for (let i=0;i<G*G;i++){
      const v = (i % G < 4) ? 0.15 + 0.1*seed(i) : (Math.floor(i/G) > 9 ? 0.85 + 0.15*seed(i) : seed(i));
      const c = new THREE.Color().setScalar(0.15 + 0.8*v);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.15 }));
      m.userData = { v, line: new THREE.Vector3(-6 + (i%40)*0.3, -0.6 + Math.floor(i/40)*0.32, 2), grid: new THREE.Vector3(-4.6 + (i%G)*0.3, 0.2, -2 + Math.floor(i/G)*0.3) };
      m.position.copy(m.userData.line); C.scene.add(m); cubes.push(m); }
    const l1 = label('Bytes of a file', { scale: 0.42 }); l1.position.set(-2.5, 1.4, 2); C.scene.add(l1);
    const l2 = label('Read as a greyscale image (CNN)', { scale: 0.42 }); l2.position.set(-2.6, 2.4, -1); l2.material.opacity = 0; C.scene.add(l2);
    const seqNames = spec.sequence || ['Open file', 'Write registry', 'Connect out', 'Encrypt'];
    const seq = seqNames.map((t, i) => { const m = shapeMesh('box', col(i===seqNames.length-1?'red':'amber'), 0.6); m.position.set(1.6 + i*1.4, 0.4, 0); m.material.opacity = 0; C.scene.add(m);
      const lb = label(t, { scale: 0.34 }); lb.position.set(1.6 + i*1.4, 1.2 + (i%2)*0.45, 0); lb.material.opacity = 0; C.scene.add(lb); m.userData.label = lb; return m; });
    const l3 = label('Actions in order (RNN / LSTM)', { scale: 0.42 }); l3.position.set(3.7, 2.6, 0); l3.material.opacity = 0; C.scene.add(l3);
    C.updaters.push((dt, now) => {
      const k = Math.min(1, dt*2.5);
      cubes.forEach(m => { const u = m.userData; const goal = mode >= 1 ? u.grid : u.line; m.position.lerp(goal, k);
        const hs = mode >= 2 ? 0.3 + u.v*3 : 1; m.scale.y += (hs - m.scale.y)*k; if (mode>=2) m.position.y = 0.2 + 0.13*m.scale.y; });
      l1.material.opacity += ((mode===0?1:0.25) - l1.material.opacity)*k; l2.material.opacity += ((mode>=1?1:0) - l2.material.opacity)*k;
      const sOn = mode >= 3; l3.material.opacity += ((sOn?1:0) - l3.material.opacity)*k;
      seq.forEach((m, i) => { const vis = sOn ? (((now/700) % (seq.length+2)) > i ? 1 : 0.25) : 0; m.material.opacity += (vis - m.material.opacity)*k; m.userData.label.material.opacity = m.material.opacity; m.rotation.y += dt; });
    });
    function step(k){ mode = (spec.steps || [0])[Math.min(k, (spec.steps||[0]).length-1)]; }
    step(0);
    return { step, dispose: C.dispose, nSteps: (spec.steps||[0]).length };
  }

  /* ---------- CLUSTERS: scattered events gather into groups; outliers stand out ---------- */
  function clusters(stage, spec){
    const C = core(stage, spec);
    const centres = [[-3.4, 0.2, -0.6, 'green'], [0.4, 1.4, 0.8, 'red'], [3.6, 0, -0.4, 'violet']];
    const names = spec.labels || ['Normal activity', 'Known attack', 'New pattern'];
    const pts = [], ring = [];
    for (let i=0;i<150;i++){
      const out = i >= 144; const c = out ? null : centres[i % 3];
      const m = new THREE.Mesh(new THREE.SphereGeometry(out ? 0.16 : 0.11, 12, 10), new THREE.MeshStandardMaterial({ color: 0x94a3b8, emissive: 0x94a3b8, emissiveIntensity: 0.2 }));
      const rnd = new THREE.Vector3((Math.random()-0.5)*10, Math.random()*3.4 - 1.2, (Math.random()-0.5)*5);
      const home = out ? new THREE.Vector3((Math.random()<0.5?-1:1)*(1.6 + Math.random()*4.5), 2.4 + Math.random()*0.8, (Math.random()-0.5)*3)
                       : new THREE.Vector3(c[0] + (Math.random()-0.5)*1.6, c[1] + (Math.random()-0.5)*1.2, c[2] + (Math.random()-0.5)*1.6);
      m.position.copy(rnd); m.userData = { rnd, home, c: out ? 'amber' : c[3], out }; C.scene.add(m); pts.push(m); }
    const labs = centres.map((c, i) => { const l = label(names[i], { scale: 0.6, border: COL[c[3]] }); l.position.set(c[0], c[1] + 1.5, c[2]); l.material.opacity = 0; C.scene.add(l); return l; });
    const ol = label(spec.outLabel || 'Outliers: investigate', { scale: 0.6, border: COL.amber }); ol.position.set(0, 3.9, 0); ol.material.opacity = 0; C.scene.add(ol);
    let mode = 0;
    C.updaters.push((dt, now) => { const k = Math.min(1, dt*2);
      pts.forEach(m => { const u = m.userData; m.position.lerp(mode >= 1 ? u.home : u.rnd, k*0.9);
        const tc = mode >= 1 && (!u.out || mode >= 2) ? col(u.c) : col('slate'); m.material.color.lerp(tc, k); m.material.emissive.lerp(tc, k);
        m.material.emissiveIntensity = (u.out && mode >= 2) ? 0.6 + 0.4*Math.sin(now/150) : 0.25; });
      labs.forEach(l => l.material.opacity += ((mode >= 1 ? 1 : 0) - l.material.opacity)*k);
      ol.material.opacity += ((mode >= 2 ? 1 : 0) - ol.material.opacity)*k; });
    function step(k){ mode = (spec.steps || [0])[Math.min(k, (spec.steps||[0]).length-1)]; }
    step(0);
    return { step, dispose: C.dispose, nSteps: (spec.steps||[0]).length };
  }

  /* ---------- CURVE: a 3D histogram of "normal" with a moving alert threshold ---------- */
  function curve(stage, spec){
    const C = core(stage, Object.assign({ cam: [0, 4.5, 11.5] }, spec));
    const bins = [], NB = 31;
    for (let i=0;i<NB;i++){ const z = (i - (NB-1)/2)/4.2; const h = 3.2*Math.exp(-z*z/2) + 0.05;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1, 0.9), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.25, transparent: true }));
      m.scale.y = h; m.position.set(-6 + i*0.4, -1.6 + h/2, 0); m.userData.z = z; C.scene.add(m); bins.push(m); }
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 5), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    plane.position.set(3, 0.6, 0.5); C.scene.add(plane);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.07, side: THREE.DoubleSide }));
    C.scene.add(glow);
    const tl = label('Alert threshold', { scale: 0.4, border: COL.amber }); C.scene.add(tl);
    const nl = label(spec.normalLabel || 'Normal behaviour', { scale: 0.42 }); nl.position.set(0, 2.6, 0); C.scene.add(nl);
    const info = label('', { scale: 0.4 }); C.scene.add(info);
    let thr = 2.5, cur = 2.5, two = false;
    function infoText(){ return thr <= 1.6 ? 'Low threshold:\nmany alerts, more false alarms' : thr >= 2.9 ? 'High threshold:\nfew alerts, may miss attacks' : 'Balanced threshold'; }
    let lastTxt = '';
    C.updaters.push((dt) => { cur += (thr - cur)*Math.min(1, dt*2.5); const x = cur*4.2*0.4;
      plane.position.x = x; glow.position.set(x + 1.8, 0.6, 0.45); tl.position.set(x, 3.4, 0.5);
      const lp = two ? -x : null;
      bins.forEach(m => { const out = m.userData.z > cur || (two && m.userData.z < -cur); const c = out ? col('red') : col('cyan'); m.material.color.lerp(c, Math.min(1, dt*6)); m.material.emissive.lerp(c, Math.min(1, dt*6)); m.material.emissiveIntensity = out ? 0.7 : 0.25; });
      const t = infoText(); if (t !== lastTxt){ C.scene.remove(info); info.material.map.dispose(); info.material.dispose(); const n = label(t, { scale: 0.38, border: COL.amber }); info.material = n.material; info.scale.copy(n.scale); C.scene.add(info); lastTxt = t; }
      info.position.set(4.6, -0.2, 1.2); });
    function step(k){ const s = (spec.steps || [2.5])[Math.min(k, (spec.steps||[2.5]).length-1)]; thr = typeof s === 'number' ? s : s.t; two = !!(s && s.two); }
    step(0);
    return { step, dispose: C.dispose, nSteps: (spec.steps||[1]).length };
  }

  /* ---------- PEOPLE: users and devices with normal-behaviour rings; one drifts and risk rises ---------- */
  function people(stage, spec){
    const C = core(stage, Object.assign({ cam: [0, 5.2, 11] }, spec));
    const names = spec.names || ['Finance', 'Finance', 'Finance', 'HR', 'HR', 'IT'];
    const folks = names.map((n, i) => {
      const g = new THREE.Group(); const c = col(i===spec.who ? 'cyan' : 'slate');
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1, 20), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 }));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), body.material); head.position.y = 0.8; g.add(body, head);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 8, 40), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.8 })); ring.rotation.x = Math.PI/2; ring.position.y = -0.5; g.add(ring);
      const a = (i/names.length)*Math.PI*2; g.position.set(Math.sin(a)*3.6, -0.6, Math.cos(a)*2.4); C.scene.add(g);
      const lb = label(n, { scale: 0.46, border: 'rgba(148,163,184,.6)' }); lb.position.set(g.position.x, 0.9, g.position.z); C.scene.add(lb);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1, 0.18), new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x4ade80, emissiveIntensity: 0.4 })); bar.position.set(g.position.x + 0.65, -1.1, g.position.z); bar.scale.y = 0.6; C.scene.add(bar);
      return { g, ring, bar, body }; });
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 24), new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x4ade80, emissiveIntensity: 0.5 }));
    gauge.position.set(0, -1.6, 0); C.scene.add(gauge);
    const gl = label('Risk score', { scale: 0.4 }); C.scene.add(gl);
    const peer = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0 })); peer.rotation.x = Math.PI/2; peer.position.y = -1.05; C.scene.add(peer);
    let mode = 0, risk = 0.4;
    C.updaters.push((dt, now) => { const k = Math.min(1, dt*2.5);
      folks.forEach((f, i) => { const odd = i === spec.who && mode >= 1;
        const goal = odd ? 2.6 + Math.sin(now/200)*0.4 : 0.6 + 0.2*Math.sin(now/600 + i);
        f.bar.scale.y += (goal - f.bar.scale.y)*k; f.bar.position.y = -1.6 + f.bar.scale.y/2;
        const bc = odd ? col('red') : col('green'); f.bar.material.color.lerp(bc, k); f.bar.material.emissive.lerp(bc, k);
        f.ring.material.color.lerp(odd ? col('red') : col('green'), k); f.ring.scale.setScalar(odd ? 1 + 0.15*Math.sin(now/180) : 1);
        f.g.rotation.y += dt*0.3; });
      const goalR = mode >= 3 ? 3.2 : mode >= 1 ? 1.4 : 0.4; risk += (goalR - risk)*k*0.6;
      gauge.scale.y = risk; gauge.position.y = -1.6 + risk/2; const rc = risk > 2.4 ? col('red') : risk > 1 ? col('amber') : col('green');
      gauge.material.color.lerp(rc, k); gauge.material.emissive.lerp(rc, k); gl.position.set(0, -1.6 + risk + 0.5, 0);
      peer.material.opacity += ((mode >= 2 ? 0.7 : 0) - peer.material.opacity)*k; });
    function step(k){ mode = (spec.steps || [0])[Math.min(k, (spec.steps||[0]).length-1)]; }
    step(0);
    return { step, dispose: C.dispose, nSteps: (spec.steps||[0]).length };
  }

  const TYPES = { graph, flood, train, bars, pixels, clusters, curve, people };

  function mount(stage, spec){
    const title = document.createElement('div'); title.className = 'scene-title'; title.textContent = spec.title || ''; stage.append(title);
    if (!window.THREE || !webglOK() || !TYPES[spec.type]){
      const fb = document.createElement('div'); fb.className = 'scene-fallback'; fb.textContent = spec.title || ''; stage.prepend(fb);
      return { step(){}, auto(){}, dispose(){ fb.remove(); title.remove(); } };
    }
    let api;
    try { api = TYPES[spec.type](stage, spec); }
    catch(e){ console.error(e); const fb = document.createElement('div'); fb.className = 'scene-fallback'; fb.textContent = spec.title || ''; stage.prepend(fb); return { step(){}, auto(){}, dispose(){ fb.remove(); title.remove(); } }; }
    let timer = null, k = 0;
    return {
      step(i){ api.step(i); },
      auto(on){ clearInterval(timer); timer = null; if (on){ k = 0; api.step(0); timer = setInterval(() => { k = (k + 1) % Math.max(1, api.nSteps); api.step(k); }, 3200); } },
      dispose(){ clearInterval(timer); api.dispose(); title.remove(); }
    };
  }
  window.Scenes = { mount };
})();
