/* Shared motion. Transform/opacity only, one rAF loop, reduced-motion aware. */
(function(){
  'use strict';

  /* ---- inside the house's case-study popup ----
     The popup supplies the chrome, so the page drops its own nav; links back to
     the homepage and Esc close the popup instead of navigating the frame. */
  if (window.parent !== window && /(?:^|[?&])embed(?:[=&]|$)/.test(location.search)) {
    document.documentElement.classList.add('embed');
    var toParent = function(){ window.parent.postMessage({ type: 'close-case' }, location.origin); };
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href]');
      if (a && /^(index|house)\.html(#.*)?$/.test(a.getAttribute('href'))) { e.preventDefault(); toParent(); }
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') toParent(); });
  }
  var rmq = matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = rmq.matches;
  /* Toggling Reduce Motion mid-session used to do nothing until a reload. */
  if (rmq.addEventListener) rmq.addEventListener('change', function(){ location.reload(); });

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

    /* offsetHeight forces layout, so read it once and on resize, never per frame */
    var heroH = hero.offsetHeight || 1;
    addEventListener('resize', function(){ heroH = hero.offsetHeight || 1; }, { passive: true });

    var raf = 0, live = false;

    function tick(){
      cx += (tx - cx) * 0.08;                       // the lag is what gives them mass
      cy += (ty - cy) * 0.08;
      var sp = Math.max(0, Math.min(1, scrollY / heroH));
      planes.forEach(function(p){
        var x = cx * p.px, y = cy * p.py + sp * p.s;
        var rot = p.rot ? ' rotate(' + (cx * p.rot).toFixed(2) + 'deg)' : '';
        p.el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)' + p.base + rot;
      });
      raf = requestAnimationFrame(tick);
    }

    /* The loop used to run for the life of the page, writing transforms to five
       promoted layers while the hero was thousands of pixels off screen. */
    function start(){ if (live) return; live = true;
      planes.forEach(function(p){ p.el.style.willChange = 'transform'; });
      raf = requestAnimationFrame(tick); }
    function stop(){ if (!live) return; live = false;
      cancelAnimationFrame(raf);
      planes.forEach(function(p){ p.el.style.willChange = 'auto'; }); }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function(es){
        es[es.length - 1].isIntersecting ? start() : stop();
      }, { threshold: 0 }).observe(stack);
    } else { start(); }

    document.addEventListener('visibilitychange', function(){
      document.hidden ? stop() : (stack.getBoundingClientRect().bottom > 0 && start());
    });
  }

  /* ---- hero scene: its loops pause whenever the hero is off screen ----
     Observers batch entries, so a fast scroll away and back delivers both.
     The last entry is the current state; the first one is stale. */
  if (stack && !reduced && 'IntersectionObserver' in window) {
    new IntersectionObserver(function(es){
      stack.classList.toggle('is-idle', !es[es.length - 1].isIntersecting);
    }, { threshold: 0 }).observe(stack);
  }

  /* ---- hero scene: the hover story ----
     Hover plays it and staying keeps it looping; leaving winds it down. Touch
     has no hover, so it plays once when the scene scrolls into view and again
     on tap. Reduced motion skips straight to the finished workflow. */
  if (stack && stack.hasAttribute('data-phase')) {
    var STEPS = [['typing',0],['thinking',900],['confused',2300],['ideas',4300],
                 ['idea',5700],['build',6700],['run',8300],['success',10300]];
    var storyTimers = [];
    function setPhase(p){ stack.setAttribute('data-phase', p); }
    function clearStory(){ storyTimers.forEach(clearTimeout); storyTimers = []; }
    function playStory(loop){
      clearStory();
      if (reduced) { setPhase('success'); return; }
      STEPS.forEach(function(s){ storyTimers.push(setTimeout(function(){ setPhase(s[0]); }, s[1])); });
      storyTimers.push(setTimeout(function(){
        if (!loop) { setPhase('idle'); return; }
        setPhase('typing');
        storyTimers.push(setTimeout(function(){ playStory(true); }, 700));
      }, 13600));
    }
    function stopStory(){ clearStory(); setPhase('idle'); }
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      stack.addEventListener('pointerenter', function(){ playStory(true); });
      stack.addEventListener('pointerleave', stopStory);
    } else {
      var storySeen = false;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function(es){
          var e = es[es.length - 1];
          if (e.isIntersecting && !storySeen) { storySeen = true; playStory(false); }
        }, { threshold: 0.6 }).observe(stack);
      }
      stack.addEventListener('click', function(){ playStory(false); });
    }
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
        links.forEach(function(l, k){
          l.classList.toggle('is-here', k === i);
          /* the tick said "you are here" to sighted users only */
          if (k === i) l.setAttribute('aria-current', 'true');
          else l.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    secs.forEach(function(s){ if (s) io.observe(s); });
  }

  /* ---- s15 prompt demo: the process assembles while you read ----
     Explanatory loop. Runs only while on screen, never when the visitor
     asks for reduced motion, and tears itself down when it leaves.     */
  var pd = document.querySelector('.pd');
  if (pd) {
    var SENTENCE = 'an agent that reviews pull requests';
    var typeEl = pd.querySelector('.pd-type');
    var caret  = pd.querySelector('.pd-caret');
    var nodes  = [].slice.call(pd.querySelectorAll('.pd-node'));
    var lines  = [].slice.call(pd.querySelectorAll('.pd-link, .pd-stem, .pd-rail, .pd-feed'));

    lines.forEach(function(l){ l.style.setProperty('--len', Math.ceil(l.getTotalLength())); });

    if (reduced) {
      typeEl.textContent = SENTENCE;                  // static end state
    } else {
      var timers = [], running = false;

      var at = function(ms, fn){ timers.push(setTimeout(fn, ms)); };
      var clearAll = function(){ timers.forEach(clearTimeout); timers = []; };

      var reset = function(){
        typeEl.textContent = '';
        caret.setAttribute('x', 70);
        pd.classList.remove('is-built');
        nodes.forEach(function(n){ n.classList.remove('on'); });
        lines.forEach(function(l){ l.classList.remove('on'); });
      };

      var cycle = function(){
        if (!running) return;
        reset();
        pd.classList.add('is-typing');
        for (var i = 1; i <= SENTENCE.length; i++) {
          (function(i){
            at(i * 34, function(){
              typeEl.textContent = SENTENCE.slice(0, i);
              caret.setAttribute('x', 70 + typeEl.getComputedTextLength() + 3);
            });
          })(i);
        }
        var t = SENTENCE.length * 34;
        // the point of the demo: assembly starts before the sentence is finished
        at(t * 0.55,        function(){ nodes[0].classList.add('on'); lines[2].classList.add('on'); });
        at(t * 0.55 + 260,  function(){ lines[0].classList.add('on'); });
        at(t * 0.55 + 420,  function(){ nodes[1].classList.add('on'); lines[3].classList.add('on'); });
        at(t * 0.55 + 680,  function(){ lines[1].classList.add('on'); });
        at(t * 0.55 + 840,  function(){ nodes[2].classList.add('on'); lines[4].classList.add('on'); });
        at(t + 260,         function(){ lines[5].classList.add('on'); lines[6].classList.add('on'); });
        at(t + 520,         function(){ pd.classList.remove('is-typing'); pd.classList.add('is-built'); });
        at(t + 3000,        cycle);                   // hold, then run again
      };

      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if (e.isIntersecting && !running) { running = true; cycle(); }
          else if (!e.isIntersecting && running) { running = false; clearAll(); reset(); }
        });
      }, { threshold: 0.35 });
      io.observe(pd);
    }
  }

})();
