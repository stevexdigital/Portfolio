(function(){
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  function sync(){ btn.setAttribute('aria-pressed', String(root.classList.contains('dark'))); }
  sync();
  btn.addEventListener('click', function(){
    var next = root.classList.contains('dark') ? 'light' : 'dark';
    root.classList.toggle('dark', next === 'dark');
    try { localStorage.setItem('site-theme', next); } catch(e){}
    sync();
  });

  document.getElementById('missing-path').textContent = location.pathname + location.search;

  // Only offer "Go back" when the visitor actually came from this site
  var back = document.getElementById('go-back');
  try {
    if (document.referrer && new URL(document.referrer).host === location.host && history.length > 1){
      back.hidden = false;
      back.addEventListener('click', function(){ history.back(); });
    }
  } catch(e){}

  // Show the real brand name from the CMS (best effort — the page works fine without it)
  fetch('https://vqthioychxlqknfwboqk.supabase.co/rest/v1/site_content?select=value&key=eq.brand_name', {
    headers: { apikey: 'sb_publishable_pD_0O9o-4s6hzKh4wUFuRg_y6MoUoF8' }
  }).then(function(r){ return r.ok ? r.json() : []; }).then(function(rows){
    if (rows && rows[0] && rows[0].value){
      document.getElementById('brand-name').textContent = rows[0].value;
      document.title = 'Page not found — ' + rows[0].value;
    }
  }).catch(function(){});
})();
