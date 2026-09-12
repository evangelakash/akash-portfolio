/* Shared motion. Transform/opacity only, one rAF loop, reduced-motion aware. */
(function(){
  'use strict';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- entrance + scroll reveals ---- */
  document.documentElement.classList.add('js');
  requestAnimationFrame(function(){ document.body.classList.add('is-ready'); });

  var reveals = [].slice.call(document.querySelectorAll('.reveal'));
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(function(el){ el.classList.add('is-in'); });
  } else {
    var ro = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        ro.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    reveals.forEach(function(el){ ro.observe(el); });
  }

  /* ---- hero: layered parallax, pointer + scroll ---- */
  var stack = document.querySelector('.stack');
  if (stack && !reduced && matchMedia('(pointer:fine)').matches) {
    var planes = [].slice.call(stack.querySelectorAll('.plane')).map(function(el){
      return { el: el, px: +el.dataset.px || 0, py: +el.dataset.py || 0,
               s: +el.dataset.s || 0, rot: +el.dataset.rot || 0,
               base: el.dataset.base || '' };
    });
    var tx = 0, ty = 0, cx = 0, cy = 0;
    addEventListener('mousemove', function(e){
      var r = stack.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width/2)) / (innerWidth/2)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height/2)) / (innerHeight/2)));
    }, { passive: true });

    var hero = document.querySelector('.hero') || document.body;
    (function tick(){
      cx += (tx - cx) * 0.08;                       // the lag is what gives them mass
      cy += (ty - cy) * 0.08;
      var sp = Math.max(0, Math.min(1, scrollY / (hero.offsetHeight || 1)));
      planes.forEach(function(p){
        var x = cx * p.px, y = cy * p.py + sp * p.s;
        var rot = p.rot ? ' rotate(' + (cx * p.rot).toFixed(2) + 'deg)' : '';
        p.el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)' + p.base + rot;
      });
      requestAnimationFrame(tick);
    })();
  }

  /* ---- scroll cue: draws once, retires once you've scrolled ---- */
  var cue = document.querySelector('.cue');
  if (cue) {
    document.querySelectorAll('.cue path').forEach(function(p){
      p.style.setProperty('--len', Math.ceil(p.getTotalLength()));
    });
    var done = false;
    addEventListener('scroll', function(){
      if (done || scrollY < innerHeight * 0.14) return;
      cue.classList.add('is-done'); done = true;
    }, { passive: true });
  }

  /* ---- pipeline: status cycles, a collaborator drifts through ---- */
  var statusText = document.getElementById('statusText');
  if (statusText && !reduced) {
    var states = ['Queued', 'Running', 'Needs review'], si = 0;
    setInterval(function(){
      si = (si + 1) % states.length;
      statusText.style.transition = 'opacity .2s'; statusText.style.opacity = 0;
      setTimeout(function(){ statusText.textContent = states[si]; statusText.style.opacity = 1; }, 200);
    }, 2800);
  }
  var mp = document.getElementById('mp'), ring = document.getElementById('selRing');
  if (mp && ring && !reduced) {
    var drift = function(){
      mp.animate([
        {transform:'translate(8px,510px)',   opacity:0},
        {transform:'translate(72px,452px)',  opacity:1, offset:.14},
        {transform:'translate(150px,392px)', opacity:1, offset:.44},
        {transform:'translate(155px,396px)', opacity:1, offset:.62},
        {transform:'translate(280px,356px)', opacity:1, offset:.88},
        {transform:'translate(342px,326px)', opacity:0}
      ], { duration: 5200, easing: 'ease-in-out' });
      ring.animate([{opacity:0},{opacity:0,offset:.44},{opacity:1,offset:.5},
                    {opacity:1,offset:.62},{opacity:0,offset:.7},{opacity:0}], { duration: 5200 });
    };
    setTimeout(drift, 3200);
    setInterval(drift, 11000);
  }

  /* ---- sketch diagrams: draw themselves in when their section arrives ---- */
  var sketches = [].slice.call(document.querySelectorAll('.sketch'));
  sketches.forEach(function(sk){
    sk.querySelectorAll('.ink').forEach(function(p){
      if (p.getTotalLength) p.style.setProperty('--len', Math.ceil(p.getTotalLength()));
    });
  });
  if (sketches.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      sketches.forEach(function(s){ s.classList.add('is-drawn'); });
    } else {
      var so = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if (!e.isIntersecting) return;
          e.target.classList.add('is-drawn');
          so.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -18% 0px', threshold: 0.2 });
      sketches.forEach(function(s){ so.observe(s); });
    }
  }

  /* ---- case study rail: scroll spy ---- */
  var rail = document.querySelector('.cs-rail');
  if (rail && 'IntersectionObserver' in window) {
    var links = [].slice.call(rail.querySelectorAll('a'));
    var secs  = links.map(function(a){ return document.querySelector(a.getAttribute('href')); });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (!e.isIntersecting) return;
        var i = secs.indexOf(e.target);
        links.forEach(function(l, k){ l.classList.toggle('is-here', k === i); });
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    secs.forEach(function(s){ if (s) io.observe(s); });
  }
})();
