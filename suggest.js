(() => {
  const form=document.querySelector('#suggest-form'); if(!form||!window.L)return;
  const map=L.map('suggest-map').setView([14.8386,120.2842],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  let pin;
  const setPin=(lat,lng)=>{form.elements.lat.value=lat;form.elements.lng.value=lng;if(pin)map.removeLayer(pin);pin=L.marker([lat,lng],{draggable:true}).addTo(map);pin.on('dragend',e=>{const p=e.target.getLatLng();form.elements.lat.value=p.lat;form.elements.lng.value=p.lng})};
  map.on('click',e=>setPin(e.latlng.lat,e.latlng.lng));
  form.addEventListener('submit',async e=>{e.preventDefault();const message=document.querySelector('#suggest-message');if(!form.elements.lat.value){message.textContent='Please pin the place on the map first.';return}const d=new FormData(form);const request={name:d.get('name'),category:d.get('category'),area:d.get('area'),description:d.get('description'),submitter:d.get('submitter'),lat:Number(d.get('lat')),lng:Number(d.get('lng')),features:{Ramp:d.get('ramp'),'Step-free entrance':d.get('stepfree'),'Accessible restroom':d.get('restroom'),Elevator:d.get('elevator')},notes:''};try{const response=await fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to send request');message.textContent='Thanks! Your location request was sent to the Open Path admins for review.';form.reset();if(pin){map.removeLayer(pin);pin=null}}catch(err){message.textContent=err.message}});
  setTimeout(()=>map.invalidateSize(),150);
})();
