// Apply the saved theme before first paint (no flash of the wrong theme)
(function(){
  try {
    var t = localStorage.getItem('cms-theme');
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch(e){}
})();
