const themeButton=document.querySelector('#theme-toggle');
if(localStorage.getItem('openpath-theme')==='dark')document.documentElement.dataset.theme='dark';
function syncTheme(){const dark=document.documentElement.dataset.theme==='dark';themeButton.setAttribute('aria-label',`Switch to ${dark?'light':'dark'} mode`);document.querySelector('#theme-label').textContent=`${dark?'Light':'Dark'} Mode`;document.querySelector('meta[name="theme-color"]').content=dark?'#253747':'#fff9f2'}
syncTheme();themeButton.addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('openpath-theme',dark?'dark':'light');syncTheme()});
const featureTrack=document.querySelector('.featured-track');
const featuredGroup=document.querySelector('#featured-group');
const htmlSafe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function startFeaturedMotion(){
  if(!featureTrack||!featuredGroup||!featuredGroup.children.length||featureTrack.dataset.ready)return;
  featureTrack.dataset.ready='true';
  const duplicate=featuredGroup.cloneNode(true);
  duplicate.setAttribute('aria-hidden','true');
  duplicate.inert=false;
  duplicate.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(element=>element.tabIndex=-1);
  featureTrack.append(duplicate);
  featuredGroup.addEventListener('focusin',()=>featureTrack.style.setProperty('transform','translateX(0)','important'));
  featuredGroup.addEventListener('focusout',event=>{if(!featuredGroup.contains(event.relatedTarget))featureTrack.style.removeProperty('transform')});
  const setSpeed=()=>featureTrack.style.setProperty('--featured-duration',`${Math.max(45,featuredGroup.scrollWidth/14)}s`);
  setSpeed();
  new ResizeObserver(setSpeed).observe(featuredGroup);
}
function renderFeatured(places){if(!featuredGroup)return;const items=places.filter(place=>place.highlighted);const statusClass=value=>value==='Available'?'available':value==='Unavailable'?'unavailable':'unverified';featuredGroup.innerHTML=items.length?items.map(place=>{const features=place.features||{},checks=[['Ramp','Wheelchair Ramp'],['Handrails','Handrails'],['Accessible restroom','Accessible Restroom'],['Elevator','Elevator']].filter(([key])=>features[key]).slice(0,2);const knownPhoto=place.imageRemoved?'':/rizal triangle|rizal park/i.test(place.name)?'/assets/rizal-triangle.png':/marikit/i.test(place.name)?'/assets/marikit-park.png':/sm city/i.test(place.name)?'/assets/sm-city-card.png':'';const photo=place.image||knownPhoto;return `<article class="place-card"><img src="${htmlSafe(photo||'/assets/hero-sm-city.png')}" alt="${photo?'Photo of '+htmlSafe(place.name):''}"><div class="place-card-content"><h3>${htmlSafe(place.name)}</h3><p class="place-type">${htmlSafe(place.category||'Establishment')}</p><p class="place-address">${htmlSafe(place.area||'Olongapo City, Zambales')}</p><ul class="access-list">${checks.length?checks.map(([key,label])=>`<li><span class="status ${statusClass(features[key])}">${htmlSafe(features[key])}</span><strong>${label}</strong></li>`).join(''):'<li><span class="status unverified">Not Verified</span><strong>Accessibility details</strong></li>'}</ul><a class="details-link" aria-label="View accessibility details for ${htmlSafe(place.name)}" href="/map?place=${encodeURIComponent(place.id)}">View Accessibility Details</a></div></article>`}).join(''):'<p class="featured-empty">Destinations selected by admins will appear here.</p>';startFeaturedMotion()}
if(featureTrack){fetch('/api/places',{cache:'no-store'}).then(response=>response.ok?response.json():[]).then(renderFeatured).catch(()=>{})}
