const themeButton=document.querySelector('#theme-toggle');
if(localStorage.getItem('openpath-theme')==='dark')document.documentElement.dataset.theme='dark';
function syncTheme(){const dark=document.documentElement.dataset.theme==='dark';themeButton.setAttribute('aria-label',`Switch to ${dark?'light':'dark'} mode`);document.querySelector('#theme-label').textContent=`${dark?'Light':'Dark'} Mode`;document.querySelector('meta[name="theme-color"]').content=dark?'#253747':'#fff9f2'}
syncTheme();themeButton.addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('openpath-theme',dark?'dark':'light');syncTheme()});
