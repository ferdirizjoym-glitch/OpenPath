    const themeButton = document.querySelector('#theme-toggle');
    const savedTheme = localStorage.getItem('openpath-theme');
    if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';
    function updateThemeButton() {
      const dark = document.documentElement.dataset.theme === 'dark';
      themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
      themeButton.querySelector('.theme-label').textContent = `${dark ? 'Light' : 'Dark'} mode`;
    }
    updateThemeButton();
    themeButton.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme !== 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      localStorage.setItem('openpath-theme', dark ? 'dark' : 'light');
      updateThemeButton();
    });
    const sectionLinks = [...document.querySelectorAll('.topbar nav a[href^="#"]')];
    const navSections = sectionLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    function setActiveSection(id) {
      sectionLinks.forEach(link => {
        const active = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    sectionLinks.forEach(link => link.addEventListener('click', () => setActiveSection(link.hash.slice(1))));
    if ('IntersectionObserver' in window) {
      const sectionObserver = new IntersectionObserver(entries => {
        const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      }, { rootMargin: '-18% 0px -65% 0px', threshold: [0, .15, .4] });
      navSections.forEach(section => sectionObserver.observe(section));
    }
    const iconSvg={
      '⌂':'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>',
      '▧':'<path d="M4 4h16v16H4zM8 8h3v3H8zM13 8h3v3h-3zM8 13h3v3H8zM13 13h3v3h-3z"/>',
      '✚':'<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/>',
      '☕':'<path d="M5 8h12v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM17 10h2a2 2 0 1 1 0 4h-2M8 3v2m4-2v2m4-2v2"/>',
      '♧':'<path d="M12 21v-9m0 3c-6 0-9-4-8-9 4 0 7 2 8 6 1-4 4-6 8-6 1 5-2 9-8 9z"/>',
      '▤':'<path d="M4 21V4h16v17M8 8h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2M9 21v-3h6v3"/>'
    };
    const iconMarkup=icon=>`<svg class="place-icon" viewBox="0 0 24 24" aria-hidden="true">${iconSvg[icon]||iconSvg['⌂']}</svg>`;
    let places=[];
    const map=L.map('map-canvas').setView([14.8386,120.2842],14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    requestAnimationFrame(()=>map.invalidateSize({pan:false}));
    if('ResizeObserver' in window)new ResizeObserver(()=>map.invalidateSize({pan:false})).observe(document.querySelector('.map-card'));
    window.addEventListener('orientationchange',()=>setTimeout(()=>map.invalidateSize({pan:false}),200));
    const markerLayer=L.layerGroup().addTo(map);
    let selected=1,featureFilter='all',statusFilter='all';
    const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function filtered(){const q=$('#search').value.trim().toLowerCase(),cat=$('#category').value;return places.filter(p=>(!q||`${p.name} ${p.category} ${p.area}`.toLowerCase().includes(q))&&(cat==='all'||p.category===cat)&&(featureFilter==='all'||p.features[featureFilter]===statusFilter&&statusFilter!=='all'||(featureFilter!=='all'&&statusFilter==='all'&&p.features[featureFilter]!=='Unavailable'))&&(statusFilter==='all'||(featureFilter==='all'?Object.values(p.features).includes(statusFilter):p.features[featureFilter]===statusFilter)))}
    function cls(s){return s==='Unverified'?'u':s==='Unavailable'?'n':''}
    function render(){const list=filtered();$('#result-count').textContent=`${list.length} ${list.length===1?'place':'places'}`;$('#place-list').innerHTML=list.length?list.map(p=>`<div class="place-item ${p.id===selected?'active':''}" data-id="${p.id}" tabindex="0"><span class="place-symbol">${iconMarkup(p.icon)}</span><span class="place-info"><strong>${esc(p.name)}</strong><small>${esc(p.category)} · ${esc(p.area)}</small><span class="mini-status">${Object.values(p.features).map(s=>`<i class="${cls(s)}" title="${s}"></i>`).join('')}</span></span></div>`).join(''):'<div class="empty">No places match these filters. Try a different search.</div>';markerLayer.clearLayers();list.forEach(p=>{const marker=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'openpath-pin',html:`<span class="pin-icon">${iconMarkup(p.icon)}</span>`,iconSize:[42,48],iconAnchor:[21,46]})}).addTo(markerLayer).bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(p.category)} · ${esc(p.area)}`);marker.on('click',()=>{selected=p.id;render()})});const current=list.find(p=>p.id===selected)||list[0];if(current){selected=current.id;$('#detail').innerHTML=`<div class="detail-head"><h3>${esc(current.name)}</h3><span class="badge unverified">Illustrative</span></div><p class="address">${esc(current.category)} · ${esc(current.area)}, Olongapo</p><div class="at-glance">Accessibility at a glance</div><div class="feature-list">${Object.entries(current.features).map(([k,v])=>`<div class="feature"><b class="${cls(v)}"></b>${esc(k)}: <strong>${esc(v)}</strong></div>`).join('')}</div><p class="verify">${esc(current.verified)} · No real-world status confirmed</p>`}else $('#detail').innerHTML='<p class="empty">Choose a place to see its details.</p>';document.querySelectorAll('[data-id]').forEach(el=>{el.onclick=()=>{selected=Number(el.dataset.id);render()};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=Number(el.dataset.id);render()}}})}
    async function loadPlaces(){try{const response=await fetch('/api/places',{cache:'no-store'});if(!response.ok)throw new Error('Could not load saved destinations');places=await response.json();selected=places[0]?.id??null;render()}catch(error){$('#place-list').innerHTML='<p class="empty">Could not load destinations. Restart the Open Path server and refresh.</p>';$('#result-count').textContent='Places unavailable';console.error(error)}}
    $('#search').addEventListener('input',render);$('#category').addEventListener('change',render);$('#reset').addEventListener('click',()=>{$('#search').value='';$('#category').value='all';featureFilter='all';statusFilter='all';document.querySelectorAll('#feature-filters .chip').forEach(c=>c.classList.toggle('active',c.dataset.feature==='all'));document.querySelectorAll('#status-filters .chip').forEach(c=>c.classList.toggle('active',c.dataset.status==='all'));render()});$('#feature-filters').addEventListener('click',e=>{const b=e.target.closest('[data-feature]');if(!b)return;featureFilter=b.dataset.feature;$('#feature-filters').querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',c===b));render()});$('#status-filters').addEventListener('click',e=>{const b=e.target.closest('[data-status]');if(!b)return;statusFilter=b.dataset.status;$('#status-filters').querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',c===b));render()});loadPlaces();
