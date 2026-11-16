/* Editor del portfolio — interfaz. Todo es JavaScript plano.
   Los datos se leen de /api/todo, se editan EN MEMORIA y se guardan con "Guardar". */
'use strict';
const PC = 'POR_CONFIRMAR';
const $ = (s, r = document) => r.querySelector(s);
const clone = o => JSON.parse(JSON.stringify(o));
const slugify = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* mini hiperscript: h('div',{class:'x',onclick:fn},hijos…) */
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v === true) e.setAttribute(k, ''); else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
  return e;
}

/* ---------- estado ---------- */
let D = null, lang = 'es', tab = 'proyectos', selP = 0, filtro = '';
const sucios = new Set(), nuevos = new Set(), subidas = {};
const api = {
  get: async u => (await fetch(u)).json(),
  post: async (u, body) => (await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', 'x-editor': '1' }, body: JSON.stringify(body) })).json()
};
function avisa(t, mal) { const a = $('#aviso'); a.textContent = t; a.className = 'aviso on' + (mal ? ' mal' : ''); clearTimeout(avisa.t); avisa.t = setTimeout(() => a.classList.remove('on'), mal ? 6000 : 2600); }
function sucio(fk) { sucios.add(fk); const e = $('#estado'); e.textContent = 'Cambios sin guardar'; e.className = 'estado sucio'; }

/* ---------- sincronizar la traducción con el español (misma forma; lo vacío usa el español) ---------- */
const NOTR = ['id', 'color', 'proyectos', 'icono', 'lineas'];
function sync(es, en) {
  if (Array.isArray(es)) return es.map((v, i) => sync(v, Array.isArray(en) ? en[i] : undefined));
  if (es && typeof es === 'object') { const o = {}; for (const k of Object.keys(es)) o[k] = NOTR.includes(k) ? clone(es[k]) : sync(es[k], en && typeof en === 'object' ? en[k] : undefined); return o; }
  if (typeof es === 'string') return typeof en === 'string' && en !== '' ? en : es;
  return es;
}

/* ---------- guardar ---------- */
function sanear() {
  /* quita párrafos vacíos y completa lo que la web necesita */
  for (const p of D.proyectos.proyectos) for (const k of ['descripcion', 'datos_medidos', 'pendiente', 'tecnologias']) if (Array.isArray(p[k])) p[k] = p[k].map(s => String(s).trim()).filter(Boolean);
  const en = D.en_proyectos.proyectos, vivos = new Set(D.proyectos.proyectos.map(p => p.slug));
  for (const slug of Object.keys(en)) { if (!vivos.has(slug)) { delete en[slug]; continue; } const T = en[slug];
    for (const k of Object.keys(T)) { if (Array.isArray(T[k])) T[k] = T[k].map(s => String(s).trim()).filter(Boolean); if (T[k] === '' || (Array.isArray(T[k]) && !T[k].length)) delete T[k]; }
    const p = D.proyectos.proyectos.find(x => x.slug === slug);
    if (T.alts) { T.alts = (p.capturas || []).map((c, i) => (T.alts[i] || '').trim() || c.alt); if (!T.alts.length) delete T.alts; }
    if (!Object.keys(T).length) delete en[slug]; }
  D.en_categorias.categorias = sync(D.categorias.categorias, D.en_categorias.categorias);
  D.en_habilidades.habilidades = sync(D.habilidades.habilidades, D.en_habilidades.habilidades);
  const { _nota, ...resto } = D.sobremi; Object.assign(D.en_sobremi, sync(resto, D.en_sobremi));
  for (const l of ['es', 'en']) { const t = D.textos[l] || (D.textos[l] = {}); for (const k of Object.keys(t)) if (t[k] === '' || t[k] === D.meta.textosPorDefecto[l][k]) delete t[k]; }
}
async function guardar() {
  if (!sucios.size) { avisa('No hay cambios que guardar'); return true; }
  sanear();
  for (const fk of [...sucios]) {
    const claves = fk === 'proyectos' ? ['proyectos', 'en_proyectos'] : fk === 'categorias' ? ['categorias', 'en_categorias'] : fk === 'habilidades' ? ['habilidades', 'en_habilidades'] : fk === 'sobremi' ? ['sobremi', 'en_sobremi'] : [fk];
    for (const c of claves) { const r = await api.post('/api/guardar', { clave: c, datos: D[c] }); if (r.error) { avisa('No se pudo guardar: ' + r.error, true); return false; } }
  }
  sucios.clear(); nuevos.clear(); const e = $('#estado'); e.textContent = 'Todo guardado'; e.className = 'estado'; avisa('Guardado'); return true;
}
async function compilar() {
  if (!(await guardar())) return;
  const dlg = $('#registro'); $('#reg-t').textContent = 'Compilando la web…'; $('#reg-p').innerHTML = ''; $('#reg-l').textContent = ''; dlg.showModal();
  const r = await api.post('/api/compilar', {});
  $('#reg-t').textContent = r.ok ? 'Web compilada' : 'La compilación ha fallado';
  $('#reg-l').textContent = r.log || '';
  if (r.ok && r.pendientes && r.pendientes.length) $('#reg-p').append(h('p', {}, 'Pendiente de confirmar (no se publica hasta que lo rellenes):'), h('ul', {}, r.pendientes.slice(0, 40).map(t => h('li', {}, t))));
  if (r.ok) recargarMarco();
}

/* ---------- widgets ---------- */
function btn(t, f, cls = 'btn peque') { return h('button', { type: 'button', class: cls, onclick: f }, t); }
function texto(obj, key, label, o = {}) {
  const el = h(o.area ? 'textarea' : 'input', { type: o.area ? null : (o.tipo || 'text'), placeholder: o.ph || (o.pend ? 'Pendiente: si lo dejas vacío no se publica' : ''), readonly: o.ro });
  const v = obj[key]; el.value = v === PC || v == null ? '' : v;
  el.addEventListener('input', () => { const val = o.tipo === 'number' ? Number(el.value) : el.value; obj[key] = val === '' && o.pend ? PC : val; sucio(o.fk); o.cambio && o.cambio(); });
  return h('div', { class: 'campo' }, h('label', {}, label), el);
}
function color(obj, key, label, fk) {
  const el = h('input', { type: 'color' }); el.value = /^#[0-9a-f]{6}$/i.test(obj[key]) ? obj[key] : '#2a6fdb';
  el.addEventListener('input', () => { obj[key] = el.value; sucio(fk); });
  return h('div', { class: 'campo' }, h('label', {}, label), el);
}
function selecto(obj, key, label, opciones, fk, cambio) {
  const el = h('select', {}, opciones.map(([v, l]) => h('option', { value: v }, l))); el.value = obj[key] ?? opciones[0][0];
  el.addEventListener('change', () => { obj[key] = el.value; sucio(fk); cambio && cambio(); });
  return h('div', { class: 'campo' }, h('label', {}, label), el);
}
function casilla(obj, key, label, fk, cambio) {
  const el = h('input', { type: 'checkbox' }); el.checked = !!obj[key];
  el.addEventListener('change', () => { obj[key] = el.checked; sucio(fk); cambio && cambio(); });
  return h('label', { class: 'fila' }, el, label);
}
/* lista de textos (párrafos…). `par` = lista paralela (traducción): en español se mueve/borra a la vez */
function listaTextos(arr, label, fk, o = {}) {
  const box = h('div', { class: 'lista-str' }), par = o.par, soloTexto = o.soloTexto;
  const pintar = () => {
    box.innerHTML = '';
    arr.forEach((t, i) => {
      const dst = soloTexto ? par : arr, inp = h(o.linea ? 'input' : 'textarea', {}); const src = soloTexto ? (par[i] ?? '') : t; inp.value = src;
      inp.addEventListener('input', () => { dst[i] = inp.value; sucio(fk); });
      const mover = d => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; if (par) [par[i], par[j]] = [par[j], par[i]]; sucio(fk); pintar(); };
      box.append(h('div', { class: 'e' }, inp, soloTexto ? null : h('div', { class: 'fila' }, btn('↑', () => mover(-1)), btn('↓', () => mover(1)), btn('✕', () => { arr.splice(i, 1); par && par.splice(i, 1); sucio(fk); pintar(); }))));
    });
    if (!soloTexto) box.append(btn('+ ' + (o.add || 'Añadir'), () => { arr.push(''); par && par.push(''); sucio(fk); pintar(); }));
    else if (!arr.length) box.append(h('p', { class: 'nota' }, 'Añade primero el texto en español.'));
  };
  pintar(); return h('div', { class: 'campo' }, h('div', { class: 'et' }, label), box);
}
function etiquetas(arr, label, fk, ph) {
  const el = h('input', { type: 'text', placeholder: ph || 'separadas por comas' }); el.value = arr.join(', ');
  el.addEventListener('input', () => { arr.length = 0; arr.push(...el.value.split(',').map(s => s.trim()).filter(Boolean)); sucio(fk); });
  return h('div', { class: 'campo' }, h('label', {}, label), el);
}
function chips(arr, opciones, label, fk) {
  const box = h('div', { class: 'chips' });
  opciones.forEach(([v, l]) => { const c = h('button', { type: 'button', class: 'chip', 'aria-pressed': arr.includes(v) }, l); c.onclick = () => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); c.setAttribute('aria-pressed', arr.includes(v)); sucio(fk); }; box.append(c); });
  return h('div', { class: 'campo' }, h('div', { class: 'et' }, label), box);
}
/* lista de objetos con cabecera, mover y borrar. `render(item, itemEN)` devuelve el contenido */
function listaObjetos(arr, par, o) {
  const box = h('div');
  const pintar = () => {
    box.innerHTML = '';
    arr.forEach((it, i) => {
      const mover = d => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; if (par) [par[i], par[j]] = [par[j], par[i]]; sucio(o.fk); pintar(); };
      const cab = h('div', { class: 'cab' }, h('strong', {}, o.titulo(it, i)), lang === 'es' ? h('div', { class: 'fila' }, btn('↑', () => mover(-1)), btn('↓', () => mover(1)), btn('Eliminar', () => { if (confirm('¿Eliminar este elemento?')) { arr.splice(i, 1); par && par.splice(i, 1); sucio(o.fk); pintar(); } }, 'btn peque peligro')) : null);
      box.append(h('div', { class: 'grupo' }, cab, o.render(it, par ? par[i] : null)));
    });
    if (lang === 'es') box.append(btn('+ ' + o.add, () => { arr.push(o.nuevo()); par && par.push(o.nuevo()); sucio(o.fk); pintar(); }));
  };
  pintar(); return box;
}

/* ---------- capturas: arrastrar o elegir → WebP ≤1280 px → se guarda en src/img/capturas ---------- */
function aWebP(archivo) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(archivo), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1280 / im.width), w = Math.round(im.width * k), hh = Math.round(im.height * k), c = document.createElement('canvas'); c.width = w; c.height = hh;
      c.getContext('2d').drawImage(im, 0, 0, w, hh); URL.revokeObjectURL(url);
      c.toBlob(b => { if (!b) return ko(new Error('No se pudo convertir')); const fr = new FileReader(); fr.onload = () => ok({ datos: fr.result, ancho: w, alto: hh }); fr.readAsDataURL(b); }, 'image/webp', .86);
    };
    im.onerror = () => ko(new Error('No es una imagen válida')); im.src = url;
  });
}
function capturas(p, T) {
  const caps = p.capturas || (p.capturas = []), box = h('div');
  const pintar = () => {
    box.innerHTML = '';
    const rej = h('div', { class: 'caps' }, caps.map((c, i) => {
      const src = subidas[c.src] || '/sitio/' + c.src;
      const alt = lang === 'es' ? texto(c, 'alt', 'Descripción de la imagen (para accesibilidad)', { fk: 'proyectos', area: true }) : (() => { const a = (T.alts || (T.alts = [])); const o = { alt: a[i] || '' }; return h('div', { class: 'campo' }, h('label', {}, 'Descripción en inglés'), (() => { const t = h('textarea', { placeholder: c.alt }); t.value = o.alt; t.oninput = () => { a[i] = t.value; sucio('proyectos'); }; return t; })()); })();
      const mover = d => { const j = i + d; if (j < 0 || j >= caps.length) return; [caps[i], caps[j]] = [caps[j], caps[i]]; if (T.alts) [T.alts[i], T.alts[j]] = [T.alts[j], T.alts[i]]; sucio('proyectos'); pintar(); };
      return h('div', { class: 'cap' }, h('img', { src, alt: '' }), h('div', { class: 'pie' }, alt, lang === 'es' ? h('div', { class: 'fila' }, btn('↑', () => mover(-1)), btn('↓', () => mover(1)), btn('Quitar', () => { caps.splice(i, 1); if (T.alts) T.alts.splice(i, 1); sucio('proyectos'); pintar(); }, 'btn peque peligro')) : null));
    }));
    box.append(rej);
    if (lang === 'es') {
      const inp = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
      const zona = h('div', { class: 'soltar', tabindex: 0 }, 'Arrastra capturas aquí o haz clic para elegirlas (se convierten a WebP automáticamente)');
      const subir = async files => {
        for (const f of files) {
          try { const { datos, ancho, alto } = await aWebP(f); const r = await api.post('/api/captura', { slug: p.slug, datos }); if (r.error) throw new Error(r.error); subidas[r.src] = datos; caps.push({ src: r.src, alt: '', ancho, alto }); sucio('proyectos'); } catch (e) { avisa('No se pudo subir ' + f.name + ': ' + e.message, true); }
        }
        pintar();
      };
      zona.onclick = () => inp.click(); zona.onkeydown = e => { if (e.key === 'Enter') inp.click(); };
      inp.onchange = () => subir([...inp.files]);
      zona.ondragover = e => { e.preventDefault(); zona.classList.add('sobre'); }; zona.ondragleave = () => zona.classList.remove('sobre');
      zona.ondrop = e => { e.preventDefault(); zona.classList.remove('sobre'); subir([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))); };
      box.append(h('div', { style: 'margin-top:10px' }, zona, inp), p.vista_previa?.tipo === 'iframe' ? null : null);
    }
  };
  pintar(); return box;
}

/* ---------- pestaña: proyectos ---------- */
const pendientes = o => (JSON.stringify(o).match(/POR_CONFIRMAR/g) || []).length;
function tabProyectos(el) {
  const L = D.proyectos.proyectos, cats = D.categorias.categorias;
  const izq = h('div'), der = h('div');
  const buscador = h('input', { type: 'text', placeholder: 'Buscar proyecto…', value: filtro }); buscador.oninput = () => { filtro = buscador.value; lista(); };
  const lst = h('div', { class: 'lista' });
  const lista = () => {
    lst.innerHTML = '';
    L.forEach((p, i) => { if (filtro && !(p.nombre + p.slug).toLowerCase().includes(filtro.toLowerCase())) return;
      const n = pendientes(p);
      lst.append(h('div', { class: 'item', role: 'button', tabindex: 0, 'aria-current': i === selP, onclick: () => { selP = i; tabProyectos.pintar(); }, onkeydown: e => { if (e.key === 'Enter') { selP = i; tabProyectos.pintar(); } } },
        h('i', { class: 'pt', style: 'background:' + (p.color_disco || '#888') }), h('span', { class: 'nom' }, p.nombre || p.slug), h('span', { class: 'pill ' + (p.publicar ? 'on' : '') }, p.publicar ? 'publicado' : 'borrador'), n ? h('span', { class: 'pill pend', title: 'Campos pendientes' }, n) : null)); });
  };
  lista();
  izq.append(h('div', { class: 'fila', style: 'margin-bottom:8px' }, btn('+ Nuevo proyecto', () => {
    const nombre = prompt('Nombre del proyecto:'); if (!nombre) return; const slug = slugify(nombre);
    if (!slug || L.some(p => p.slug === slug)) return avisa('Ya existe un proyecto con ese identificador', true);
    L.push({ slug, nombre, publicar: false, color_disco: '#2a6fdb', estado: PC, resumen: '', descripcion: [''], problema: PC, papel: PC, tecnologias: [], enlaces: { vivo: PC, codigo: PC }, vista_previa: { tipo: 'captura' }, capturas: [], categoria: cats[0]?.id });
    nuevos.add(slug); selP = L.length - 1; sucio('proyectos'); tabProyectos.pintar();
  }, 'btn primario')), buscador, h('div', { style: 'height:8px' }), lst);

  const p = L[selP];
  if (!p) { der.append(h('div', { class: 'vacio' }, 'Aún no hay proyectos. Crea el primero con «Nuevo proyecto».')); el.append(h('div', { class: 'dos' }, izq, der)); return; }
  const T = (D.en_proyectos.proyectos[p.slug] ||= {});
  const es = lang === 'es', fk = 'proyectos';
  der.append(h('h1', {}, p.nombre), h('p', { class: 'nota' }, es ? 'Todo lo que escribas aquí aparece en la web. Lo que dejes pendiente no se publica.' : 'Traducción al inglés. Si dejas un campo vacío se usa el texto en español.'));
  if (es) {
    der.append(h('div', { class: 'fila' }, casilla(p, 'publicar', 'Publicado en la web', fk, lista), casilla(p, 'destacado', 'Destacado', fk)));
    der.append(h('div', { class: 'cols' }, texto(p, 'nombre', 'Nombre', { fk, cambio: lista }), texto(p, 'slug', 'Identificador (enlace)', { fk, ro: !nuevos.has(p.slug) }),
      selecto(p, 'categoria', 'Categoría (distrito)', cats.map(c => [c.id, c.nombre]), fk), color(p, 'color_disco', 'Color del disquete', fk), texto(p, 'estado', 'Estado (Publicado, En desarrollo…)', { fk, pend: true })));
  } else der.append(texto(T, 'estado', 'Estado', { fk, ph: p.estado === PC ? '' : p.estado }));
  const src = es ? p : T;
  der.append(texto(src, 'resumen', 'Resumen (una frase)', { fk, area: true, ph: es ? '' : p.resumen }));
  der.append(es ? listaTextos(p.descripcion || (p.descripcion = []), 'Descripción (un párrafo por caja)', fk, { add: 'Añadir párrafo' }) : listaTextos(p.descripcion || [], 'Descripción', fk, { par: T.descripcion || (T.descripcion = []), soloTexto: true }));
  der.append(texto(src, 'problema', 'Qué problema resuelve', { fk, area: true, pend: es }), texto(src, 'papel', 'Mi papel', { fk, area: true, pend: es }));
  der.append(es ? listaTextos(p.datos_medidos || (p.datos_medidos = []), 'Datos medidos', fk, { add: 'Añadir dato' }) : listaTextos(p.datos_medidos || [], 'Datos medidos', fk, { par: T.datos_medidos || (T.datos_medidos = []), soloTexto: true }));
  der.append(es ? listaTextos(p.pendiente || (p.pendiente = []), 'Lo que viene (pendiente)', fk, { add: 'Añadir' }) : listaTextos(p.pendiente || [], 'Lo que viene', fk, { par: T.pendiente || (T.pendiente = []), soloTexto: true }));
  if (es) {
    der.append(etiquetas(p.tecnologias || (p.tecnologias = []), 'Tecnologías', fk, 'HTML, CSS, JavaScript…'));
    const en = p.enlaces || (p.enlaces = { vivo: PC, codigo: PC });
    der.append(h('div', { class: 'cols' }, texto(en, 'vivo', 'Enlace para verlo en vivo', { fk, pend: true, tipo: 'url' }), texto(en, 'codigo', 'Enlace al código', { fk, pend: true, tipo: 'url' })));
    const vp = p.vista_previa || (p.vista_previa = { tipo: 'captura' });
    der.append(h('div', { class: 'cols' }, selecto(vp, 'tipo', 'Vista previa en el monitor clásico', [['iframe', 'Web en vivo'], ['captura', 'Solo captura'], ['bash', 'Terminal (Bash)']], fk, () => tabProyectos.pintar()), vp.tipo === 'iframe' ? texto(vp, 'url', 'URL de la vista previa', { fk, tipo: 'url' }) : null, vp.tipo === 'iframe' ? selecto(vp, 'formato', 'Formato', [['escritorio', 'Escritorio'], ['movil', 'Móvil']], fk) : null));
  }
  der.append(h('h2', {}, 'Capturas'), capturas(p, T));
  if (es) der.append(h('h2', {}, 'Zona delicada'), btn('Eliminar este proyecto', () => { if (!confirm(`¿Eliminar «${p.nombre}»? Quedará una copia de seguridad.`)) return; L.splice(selP, 1); delete D.en_proyectos.proyectos[p.slug]; selP = Math.max(0, selP - 1); sucio('proyectos'); tabProyectos.pintar(); }, 'btn peligro'));
  el.append(h('div', { class: 'dos' }, izq, der));
}

/* ---------- pestañas con listas ---------- */
const pubOpc = () => D.proyectos.proyectos.map(p => [p.slug, p.nombre]);
function tabCategorias(el) {
  const A = D.categorias.categorias, B = D.en_categorias.categorias = sync(A, D.en_categorias.categorias), fk = 'categorias';
  el.append(h('h1', {}, 'Categorías (distritos)'), h('p', { class: 'nota' }, 'Cada categoría es un distrito del recorrido 3D. El color da el tono del cielo y del suelo de su zona.'));
  el.append(listaObjetos(A, B, { fk, add: 'Nueva categoría', titulo: c => c.nombre || c.id, nuevo: () => ({ id: 'nueva-' + (A.length + 1), nombre: '', corto: '', color: '#2a6fdb', texto: '' }),
    render: (c, e) => lang === 'es' ? h('div', { class: 'cols' }, texto(c, 'id', 'Identificador', { fk, ro: true }), texto(c, 'nombre', 'Nombre', { fk }), texto(c, 'corto', 'Etiqueta corta (MAYÚSCULAS)', { fk }), color(c, 'color', 'Color', fk), texto(c, 'texto', 'Descripción', { fk, area: true })) : h('div', { class: 'cols' }, texto(e, 'nombre', 'Name', { fk }), texto(e, 'corto', 'Short label', { fk }), texto(e, 'texto', 'Description', { fk, area: true })) }));
}
function tabHabilidades(el) {
  const A = D.habilidades.habilidades, B = D.en_habilidades.habilidades = sync(A, D.en_habilidades.habilidades), fk = 'habilidades';
  el.append(h('h1', {}, 'Qué sé hacer'), h('p', { class: 'nota' }, 'Cada habilidad es una capa del descenso. Los proyectos que marques salen en la placa y se pueden abrir con un clic.'));
  el.append(listaObjetos(A, B, { fk, add: 'Nueva habilidad', titulo: x => x.titulo || x.id, nuevo: () => ({ id: 'nueva-' + (A.length + 1), titulo: '', texto: '', proyectos: [], icono: D.meta.iconos[0] }),
    render: (x, e) => lang === 'es' ? h('div', {}, h('div', { class: 'cols' }, texto(x, 'id', 'Identificador', { fk, ro: true }), texto(x, 'titulo', 'Título', { fk }), selecto(x, 'icono', 'Icono', D.meta.iconos.map(i => [i, i]), fk)), texto(x, 'texto', 'Texto', { fk, area: true }), chips(x.proyectos, pubOpc(), 'Proyectos que lo demuestran', fk)) : h('div', {}, texto(e, 'titulo', 'Title', { fk }), texto(e, 'texto', 'Text', { fk, area: true })) }));
}
function tabSobreMi(el) {
  const A = D.sobremi, { _nota, ...r } = A; const B = D.en_sobremi = Object.assign(D.en_sobremi || {}, sync(r, D.en_sobremi)), fk = 'sobremi', es = lang === 'es', O = es ? A : B;
  el.append(h('h1', {}, 'Sobre mí'), h('p', { class: 'nota' }, 'Estos textos salen en la sala de máquinas, en las capas del descenso y en la página «Sobre mí» de la versión clásica.'));
  el.append(h('h2', {}, 'Presentación'), es ? listaTextos(A.intro, 'Párrafos de presentación', fk, { par: B.intro }) : listaTextos(A.intro, 'Párrafos', fk, { par: B.intro, soloTexto: true }));
  el.append(h('h2', {}, 'Cómo trabajo'), listaObjetos(A.como_trabajo, B.como_trabajo, { fk, add: 'Añadir', titulo: x => x.titulo, nuevo: () => ({ titulo: '', texto: '' }), render: (x, e) => h('div', {}, texto(es ? x : e, 'titulo', 'Título', { fk }), texto(es ? x : e, 'texto', 'Texto', { fk, area: true })) }));
  el.append(h('h2', {}, 'Pila técnica'), listaObjetos(A.pila, B.pila, { fk, add: 'Añadir tecnología', titulo: x => x.nombre, nuevo: () => ({ nombre: '', proyectos: [] }), render: (x, e) => es ? h('div', {}, texto(x, 'nombre', 'Nombre', { fk }), chips(x.proyectos || (x.proyectos = []), pubOpc(), 'Proyectos', fk), texto(x, 'nota', 'Nota (si no hay proyectos)', { fk })) : h('div', {}, texto(e, 'nombre', 'Name', { fk }), texto(e, 'nota', 'Note', { fk })) }));
  el.append(h('h2', {}, 'Formación'), listaObjetos(A.formacion, B.formacion, { fk, add: 'Añadir etapa', titulo: x => x.etapa, nuevo: () => ({ etapa: '', texto: '', proyectos: [] }), render: (x, e) => es ? h('div', {}, texto(x, 'etapa', 'Etapa', { fk }), texto(x, 'texto', 'Texto', { fk, area: true }), chips(x.proyectos || (x.proyectos = []), pubOpc(), 'Proyectos', fk)) : h('div', {}, texto(e, 'etapa', 'Stage', { fk }), texto(e, 'texto', 'Text', { fk, area: true })) }));
  const c = O.clasificado || (O.clasificado = {});
  el.append(h('h2', {}, 'Expediente clasificado'), h('div', { class: 'grupo' }, texto(c, 'titulo', 'Título', { fk }), texto(c, 'texto', 'Texto', { fk, area: true }), es ? texto(c, 'lineas', 'Líneas tachadas', { fk, tipo: 'number' }) : null, texto(c, 'cierre', 'Cierre', { fk })));
  el.append(h('h2', {}, 'Qué busco'), texto(O, 'busco', 'Aparece en la sala de contacto', { fk, area: true }));
}
function tabDatos(el) {
  const c = D.config, fk = 'config', per = c.perfiles || (c.perfiles = {});
  el.append(h('h1', {}, 'Mis datos'), h('p', { class: 'nota' }, 'Los campos pendientes no se publican. Cuando tengas el dominio o el perfil, rellénalos y vuelve a compilar.'));
  el.append(h('div', { class: 'cols' }, texto(c, 'nombre_publico', 'Nombre público', { fk }), texto(c, 'alias', 'Alias', { fk }), texto(c, 'correo', 'Correo de contacto', { fk, pend: true }), texto(c, 'dominio', 'Dominio (ej. ivanchux.dev)', { fk, pend: true }), texto(c, 'titular_legal', 'Titular legal (aviso legal)', { fk, pend: true }), texto(c, 'github', 'GitHub', { fk, tipo: 'url' }), texto(per, 'linkedin', 'LinkedIn', { fk, pend: true, tipo: 'url' })));
}
function tabTextos(el) {
  const def = D.meta.textosPorDefecto, ov = D.textos, fk = 'textos', claves = Object.keys(def.es).filter(k => k !== 'htmlLang');
  const buscar = h('input', { type: 'text', placeholder: 'Filtrar textos…' }); const tb = h('table', { class: 'tabla' });
  const pintar = () => {
    tb.innerHTML = ''; tb.append(h('tr', {}, h('th', {}, 'Texto'), h('th', {}, 'Español'), h('th', {}, 'English')));
    claves.filter(k => !buscar.value || (k + def.es[k] + def.en[k]).toLowerCase().includes(buscar.value.toLowerCase())).forEach(k => {
      const celda = l => { const i = h(def[l][k].length > 70 ? 'textarea' : 'input', { style: def[l][k].length > 70 ? 'min-height:60px' : '' }); i.value = (ov[l] && ov[l][k]) ?? def[l][k]; i.oninput = () => { (ov[l] || (ov[l] = {}))[k] = i.value; sucio(fk); }; return h('td', {}, i); };
      tb.append(h('tr', {}, h('td', {}, h('code', {}, k)), celda('es'), celda('en')));
    });
  };
  buscar.oninput = pintar; pintar();
  el.append(h('h1', {}, 'Textos de la experiencia 3D'), h('p', { class: 'nota' }, 'Botones, avisos, rótulos y textos de cada capítulo. En los textos puedes usar <br> para un salto de línea.'), buscar, h('div', { style: 'height:10px' }), tb);
}
function tabAyuda(el) {
  const sel = h('select', {}, Object.keys({ proyectos: 1, categorias: 1, habilidades: 1, sobremi: 1, config: 1, textos: 1 }).map(k => h('option', { value: k }, k))); const out = h('div');
  const ver = async () => { out.innerHTML = ''; const l = await api.get('/api/copias?clave=' + sel.value); if (!l.length) out.append(h('p', { class: 'nota' }, 'Todavía no hay copias de este archivo.')); l.forEach(f => out.append(h('div', { class: 'fila', style: 'margin:4px 0' }, h('code', {}, f.replace(/__/, '  ').replace('.json', '')), btn('Restaurar', async () => { if (!confirm('¿Volver a esta versión? La actual también se guardará como copia.')) return; const r = await api.post('/api/restaurar', { clave: sel.value, archivo: f }); if (r.error) return avisa(r.error, true); avisa('Versión restaurada. Recargando…'); setTimeout(() => location.reload(), 700); })))); };
  sel.onchange = ver; ver();
  el.append(h('h1', {}, 'Ayuda'),
    h('h2', {}, 'Cómo se usa'), h('ol', { class: 'nota' }, h('li', {}, 'Elige una sección a la izquierda y edita lo que quieras.'), h('li', {}, 'Pulsa «Guardar y ver la web»: se guarda, se compila y la vista previa se actualiza.'), h('li', {}, 'Con ES/EN arriba cambias el idioma que editas. Si dejas algo vacío en inglés, se usa el español.'), h('li', {}, 'Nuevo proyecto: crea la ficha, sube sus capturas, elige categoría y color, y marca «Publicado» cuando esté listo.')),
    h('h2', {}, 'Publicar'), h('p', { class: 'nota' }, 'El editor solo cambia archivos en tu ordenador. Para publicar: sube los cambios a GitHub (la carpeta datos/ y src/img/) y ejecuta «Publicar la web» en la pestaña Actions de tu repositorio.'),
    h('h2', {}, 'Recuperar una versión anterior'), h('div', { class: 'fila' }, sel), out);
}

/* ---------- navegación ---------- */
const TABS = [['proyectos', 'Proyectos', tabProyectos], ['categorias', 'Categorías', tabCategorias], ['habilidades', 'Qué sé hacer', tabHabilidades], ['sobremi', 'Sobre mí', tabSobreMi], ['datos', 'Mis datos', tabDatos], ['textos', 'Textos 3D', tabTextos], ['ayuda', 'Ayuda', tabAyuda]];
function pintar() {
  const nav = $('#pestanas'); nav.innerHTML = '';
  TABS.forEach(([id, t]) => nav.append(h('button', { 'aria-selected': id === tab, onclick: () => { tab = id; pintar(); } }, t)));
  const p = $('#panel'); const y = p.scrollTop; p.innerHTML = ''; TABS.find(t => t[0] === tab)[2](p); p.scrollTop = y;
  document.querySelectorAll('.idioma button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
}
tabProyectos.pintar = pintar;
function recargarMarco() { const m = $('#marco'); const u = new URL(m.src || location.origin + '/sitio/', location.origin); u.searchParams.set('v', Date.now()); m.src = u.pathname + u.search; }

async function iniciar() {
  D = await api.get('/api/todo');
  D.en_proyectos.proyectos = D.en_proyectos.proyectos || {};
  $('#marco').src = D.meta.dist ? '/sitio/' : 'about:blank';
  document.querySelectorAll('.idioma button').forEach(b => b.onclick = () => { lang = b.dataset.lang; pintar(); });
  $('#b-guardar').onclick = guardar; $('#b-compilar').onclick = compilar;
  document.querySelectorAll('.previa__barra button[data-url]').forEach(b => b.onclick = () => { $('#marco').src = b.dataset.url + '?v=' + Date.now(); });
  $('#b-recargar').onclick = recargarMarco;
  $('#b-ocultar').onclick = () => document.querySelector('.cuerpo').classList.toggle('sin-previa');
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); guardar(); } });
  addEventListener('beforeunload', e => { if (sucios.size) { e.preventDefault(); e.returnValue = ''; } });
  pintar();
}
iniciar().catch(e => { document.body.innerHTML = '<p style="padding:24px">No se pudo cargar el editor: ' + e.message + '</p>'; });
