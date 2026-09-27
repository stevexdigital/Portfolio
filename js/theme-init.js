// Runs before first paint so there's no flash of the wrong theme.
(function(){
  var d = document.documentElement;
  d.classList.add('js');
  try {
    var t = localStorage.getItem('site-theme');
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (t === 'dark') d.classList.add('dark');
  } catch(e){}
})();
