const button=document.querySelector('#theme-toggle');
if(localStorage.getItem('openpath-theme')==='dark')document.documentElement.dataset.theme='dark';
function sync(){const dark=document.documentElement.dataset.theme==='dark';document.querySelector('#theme-label').textContent=dark?'Light Mode':'Dark Mode';button.setAttribute('aria-label',`Switch to ${dark?'light':'dark'} mode`);document.querySelector('meta[name="theme-color"]').content=dark?'#253747':'#fff9f2'}
sync();button.addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('openpath-theme',dark?'dark':'light');sync()});
