/* The auditorium wall behind the hero. A port of ruixen.ui's Tilted Grid Hero (21st.dev) with
   the same cylinder and camera: the frame's edge sits `bend` round the arc, the camera 1.6 radii
   out. Widened from one row into a wall that fills the hero, and the cards are wireframes drawn
   here rather than images: agent flows, a review queue, a prompt, a board of stickies. Each card
   carries a mark that spins while it comes in from the right and turns into a tick as it crosses
   the centre, where a person looks at it. WebGL so every strip is a true perspective facet; no
   library, nothing downloaded. Pauses off screen; reduced motion gets one still frame. */
(function(){
  'use strict';

  var hero = document.querySelector('.hero');
  var c = document.createElement('canvas');
  var gl = hero && c.getContext && c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var TAU = Math.PI * 2, INK = '42,42,46';
  var text = hero && hero.querySelector('.hero__grid > div');

  var SW = 512, SH = 320, SM = 14, AC = 4, AR = 3;   // the atlas: 4x3 slots, each a card plus its shadow margin

  function wireframes(){
    var CW = SW - 2 * SM, CH = SH - 2 * SM;
    var a = document.createElement('canvas'); a.width = SW * AC; a.height = SH * AR;
    var g = a.getContext('2d');
    var PAPER = '#FCFCFB', SOFT = '#F3F3F0', DARK = 'rgba(42,42,46,.6)', LIGHT = '#FCFCFB';
    var TAPE = 'rgba(214,200,162,.8)', NOTE = 'rgba(240,224,140,.9)', WARM = 'rgba(196,176,120,.95)';
    function ink(o){ return typeof o === 'string' ? o : 'rgba(' + INK + ',' + o + ')'; }
    function rr(x, y, w, h, r){ g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
    function bar(x, y, w, h, o){ h = h || 8; rr(x, y, w, h, h / 2); g.fillStyle = ink(o == null ? .1 : o); g.fill(); }
    function box(x, y, w, h, r, fill, o){
      rr(x, y, w, h, r == null ? 6 : r);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (o !== 0) { g.strokeStyle = ink(o == null ? .14 : o); g.lineWidth = 1.5; g.stroke(); }
    }
    function ln(p, o, w, dash){
      g.beginPath(); g.moveTo(p[0], p[1]);
      for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
      g.strokeStyle = ink(o == null ? .3 : o); g.lineWidth = w || 1.5; g.lineCap = 'round'; g.lineJoin = 'round';
      g.setLineDash(dash || []); g.stroke(); g.setLineDash([]);
    }
    function dot(x, y, r, fill, o){
      g.beginPath(); g.arc(x, y, r, 0, TAU);
      if (fill) { g.fillStyle = ink(fill); g.fill(); }
      if (o) { g.strokeStyle = ink(o); g.lineWidth = 1.5; g.stroke(); }
    }
    function txt(s, x, y, size, col, align){
      g.font = '500 ' + size + 'px "IBM Plex Mono", ui-monospace, monospace';
      g.fillStyle = col; g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillText(s, x, y);
    }
    function chrome(){ dot(16, 16, 3.5, .16); dot(28, 16, 3.5, .16); dot(40, 16, 3.5, .16); bar(58, 12, 96, 8, .07); ln([0, 32, CW, 32], .08); }
    function toggle(x, y, on){ box(x, y, 44, 24, 12, on ? DARK : ink(.12), 0); dot(on ? x + 32 : x + 12, y + 12, 9, LIGHT); }
    function scribble(x, y, w, o){ var p = [x, y]; for (var k = 1; k <= 6; k++) p.push(x + k * w / 6, y + (k % 2 ? 1.4 : -1.4)); ln(p, o || .42, 2); }

    var cards = [
      function flow(){                  // an agent pipeline with a human step at the end
        chrome();
        for (var y = 46; y < CH; y += 18) for (var x = 12; x < CW; x += 18) dot(x, y, 1, .08);
        function node(x, y, w, h, fill){ box(x, y, w, h, 8, fill || '#fff', .2); }
        function wire(x1, y1, x2, y2){
          var m = (x1 + x2) / 2;
          g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(m, y1, m, y2, x2 - 5, y2);
          g.strokeStyle = ink(.32); g.lineWidth = 1.5; g.stroke();
          g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 7, y2 - 4); g.lineTo(x2 - 7, y2 + 4); g.closePath(); g.fillStyle = ink(.32); g.fill();
        }
        node(18, 132, 66, 34); dot(35, 149, 6, .2); bar(47, 145, 28, 8, .14);
        node(116, 118, 108, 62); dot(133, 137, 7, DARK); bar(147, 133, 62, 8, .2); bar(130, 154, 78, 7, .09); bar(130, 166, 52, 7, .09);
        node(262, 74, 98, 48); dot(279, 98, 6, .2); bar(291, 94, 54, 8, .14);
        node(262, 176, 98, 48); dot(279, 200, 6, .2); bar(291, 196, 54, 8, .14);
        node(392, 122, 76, 56, TAPE);
        dot(430, 140, 6.5, .55); g.beginPath(); g.arc(430, 162, 11, Math.PI, 0); g.strokeStyle = ink(.55); g.lineWidth = 2; g.stroke();
        wire(84, 149, 116, 149); wire(224, 140, 262, 98); wire(224, 158, 262, 200); wire(360, 98, 392, 140); wire(360, 200, 392, 160);
        box(184, 250, 116, 28, 14, '#fff', .14); for (var i = 0; i < 4; i++) dot(205 + i * 25, 264, 3, .22);
      },
      function chat(){                  // an agent conversation, one step a tool call
        g.fillStyle = SOFT; g.fillRect(0, 0, 118, CH); ln([118, 0, 118, CH], .08);
        dot(22, 22, 7, .2); bar(36, 18, 56, 8, .12);
        for (var i = 0; i < 7; i++) {
          if (i === 1) box(10, 44 + i * 30, 98, 26, 6, '#fff', .1);
          bar(22, 53 + i * 30, i === 1 ? 68 : 46 + (i * 17) % 30, 8, i === 1 ? .18 : .08);
        }
        box(136, 22, 196, 36, 12, SOFT, 0); bar(150, 31, 150, 7, .14); bar(150, 43, 100, 7, .1);
        box(254, 70, 210, 36, 12, DARK, 0); bar(268, 80, 172, 7, 'rgba(252,252,251,.5)'); bar(268, 92, 110, 7, 'rgba(252,252,251,.35)');
        rr(136, 120, 178, 28, 8); g.fillStyle = '#fff'; g.fill(); g.setLineDash([4, 3]); g.strokeStyle = ink(.3); g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
        txt('search_docs()', 150, 134, 12, ink(.55));
        box(136, 160, 254, 54, 12, SOFT, 0); bar(150, 171, 212, 7, .14); bar(150, 183, 182, 7, .1); bar(150, 195, 120, 7, .1);
        box(136, 222, 58, 22, 11, '#fff', .12); for (var k = 0; k < 3; k++) dot(152 + k * 13, 233, 3, .25);
        box(136, 252, 330, 30, 15, '#fff', .16); bar(154, 263, 140, 8, .08); dot(451, 267, 10, DARK);
        ln([451, 272, 451, 262], LIGHT, 2); ln([446, 266, 451, 261, 456, 266], LIGHT, 2);
      },
      function review(){                // the human-in-the-loop step: read, then approve or reject
        chrome();
        bar(22, 48, 190, 12, .22); bar(22, 68, 120, 8, .09);
        box(366, 46, 96, 24, 12, TAPE, 0); txt('Review', 414, 58, 12, ink(.7), 'center');
        box(22, 90, 440, 112, 8, SOFT, .08);
        var ws = [300, 240, 330, 200, 270];
        for (var i = 0; i < 5; i++) {
          var y = 104 + i * 19, add = i % 3 !== 1;
          g.fillStyle = add ? WARM : ink(.16); g.fillRect(34, y - 4, 8, 8);
          bar(52, y - 4, ws[i], 8, add ? .16 : .09);
        }
        box(22, 212, 440, 26, 6, '#fff', .12); bar(34, 221, 170, 7, .08);
        box(298, 248, 78, 32, 8, '#fff', .22); txt('Reject', 337, 264, 12, ink(.6), 'center');
        box(384, 248, 78, 32, 8, DARK, 0); txt('Approve', 423, 264, 12, LIGHT, 'center');
      },
      function dashboard(){
        g.fillStyle = SOFT; g.fillRect(0, 0, 44, CH); ln([44, 0, 44, CH], .08);
        box(12, 14, 20, 20, 6, DARK, 0);
        for (var i = 0; i < 6; i++) box(13, 54 + i * 30, 18, 18, 5, i === 1 ? '#fff' : ink(.08), i === 1 ? .22 : 0);
        bar(60, 16, 120, 10, .2);
        for (var k = 0; k < 3; k++) {
          var x = 60 + k * 136;
          box(x, 38, 124, 60, 8, '#fff', .12); bar(x + 12, 50, 54, 7, .1); bar(x + 12, 66, 66, 14, .24);
          ln([x + 84, 86, x + 94, 78, x + 102, 82, x + 114, 68], k === 1 ? WARM : .35, 1.8);
        }
        box(60, 108, 272, 172, 8, '#fff', .12); bar(72, 120, 90, 8, .14);
        for (i = 0; i < 4; i++) ln([72, 160 + i * 28, 320, 160 + i * 28], .05);
        var pts = [72, 240, 104, 220, 136, 228, 168, 190, 200, 200, 232, 168, 264, 176, 296, 150, 320, 156];
        g.beginPath(); g.moveTo(72, 262); for (i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.lineTo(320, 262); g.closePath();
        g.fillStyle = 'rgba(214,200,162,.35)'; g.fill();
        ln(pts, .5, 2);
        box(344, 108, 120, 172, 8, '#fff', .12);
        var lw = [70, 56, 80, 48, 64, 52];
        for (i = 0; i < 6; i++) { dot(358, 132 + i * 24, 5, .18); bar(370, 128 + i * 24, lw[i], 8, .1); }
      },
      function config(){                // an agent's settings
        chrome();
        bar(22, 48, 150, 12, .22);
        for (var i = 0; i < 3; i++) {
          var y = 78 + i * 58;
          bar(22, y, 70 + i * 14, 7, .14); box(22, y + 14, 200, 30, 7, '#fff', .16); bar(34, y + 25, 90 + (i * 37) % 60, 8, .07);
        }
        bar(250, 78, 80, 7, .14); toggle(250, 92, true); bar(306, 100, 100, 8, .08);
        bar(250, 136, 60, 7, .14); ln([252, 164, 460, 164], .12, 4); ln([252, 164, 350, 164], .75, 4); dot(350, 164, 9, '#fff', .35);
        bar(250, 190, 90, 7, .14); box(250, 204, 212, 30, 7, '#fff', .16); bar(262, 215, 80, 8, .08); ln([440, 216, 446, 222, 452, 216], .4, 1.8);
        box(398, 250, 64, 30, 8, DARK, 0); txt('Save', 430, 265, 12, LIGHT, 'center');
      },
      function prompt(){                // where an idea starts
        chrome();
        g.save(); g.translate(242, 62); g.beginPath();
        for (var k = 0; k < 8; k++) { var r = k % 2 ? 3.5 : 11, t = k * Math.PI / 4 - Math.PI / 2; g.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
        g.closePath(); g.fillStyle = WARM; g.fill(); g.restore();
        bar(147, 86, 190, 14, .22); bar(177, 108, 130, 8, .09);
        box(62, 130, 360, 70, 12, '#fff', .2); bar(78, 146, 220, 8, .1); bar(78, 162, 150, 8, .07); ln([234, 158, 234, 172], .6, 1.5);
        dot(400, 180, 11, DARK); ln([400, 185, 400, 175], LIGHT, 2); ln([395, 179, 400, 174, 405, 179], LIGHT, 2);
        var chips = [[88, 92], [188, 100], [296, 100]];
        for (var i = 0; i < 3; i++) { box(chips[i][0], 212, chips[i][1], 24, 12, '#fff', .14); dot(chips[i][0] + 14, 224, 4, TAPE); bar(chips[i][0] + 24, 220, chips[i][1] - 36, 8, .1); }
        for (i = 0; i < 3; i++) { box(62 + i * 124, 248, 112, 34, 8, SOFT, .08); bar(74 + i * 124, 261, 70, 8, .12); }
      },
      function kanban(){
        chrome();
        var hs = [[52, 62, 44], [62, 46, 52], [44, 56, 60]];
        for (var c = 0; c < 3; c++) {
          var x = 14 + c * 156, y = 66;
          bar(x + 4, 46, 60, 8, .18); dot(x + 78, 50, 7, .08);
          for (var i = 0; i < 3; i++) {
            var h = hs[c][i];
            if (c === 1 && i === 1) {          // one card is a sticky note, taped on
              g.save(); g.translate(x + 72, y + h / 2); g.rotate(-.045);
              g.fillStyle = NOTE; g.fillRect(-72, -h / 2, 144, h);
              g.fillStyle = 'rgba(214,200,162,.85)'; g.fillRect(-20, -h / 2 - 6, 40, 12);
              scribble(-58, -6, 96); scribble(-58, 8, 64);
              g.restore();
            } else {
              box(x, y, 144, h, 8, '#fff', .14); bar(x + 12, y + 12, 100 - (i * 23) % 40, 7, .14); bar(x + 12, y + 26, 70, 6, .08);
              if (h > 50) dot(x + 126, y + h - 14, 7, .15);
            }
            y += h + 10;
          }
        }
      },
      function timeline(){
        chrome();
        g.fillStyle = SOFT; g.fillRect(0, 33, 112, CH); ln([112, 33, 112, CH], .08);
        for (var q = 0; q < 4; q++) { bar(130 + q * 88, 42, 40, 7, .12); ln([124 + q * 88, 58, 124 + q * 88, CH], .05); }
        var bs = [[130, 70, .7], [170, 110, 't'], [150, 60, .2], [240, 120, .7], [200, 90, 't'], [290, 140, .2], [330, 110, .7]];
        for (var i = 0; i < 7; i++) {
          var y = 74 + i * 29, b = bs[i];
          bar(16, y + 5, 60 + (i * 29) % 30, 8, .12);
          rr(b[0], y, b[1], 18, 9); g.fillStyle = b[2] === 't' ? TAPE : ink(b[2]); g.fill();
        }
        ln([318, 72, 318, CH], .4, 1.5, [4, 4]); box(292, 54, 52, 16, 8, DARK, 0); txt('today', 318, 62, 10, LIGHT, 'center');
      },
      function library(){               // a design system page
        chrome();
        box(22, 48, 90, 30, 8, DARK, 0); txt('Button', 67, 63, 12, LIGHT, 'center');
        box(120, 48, 90, 30, 8, '#fff', .22); txt('Button', 165, 63, 12, ink(.6), 'center');
        toggle(226, 51, true); toggle(278, 51, false);
        box(340, 53, 22, 22, 5, DARK, 0); ln([345, 64, 349, 69, 357, 59], LIGHT, 2); box(372, 53, 22, 22, 5, '#fff', .25);
        dot(420, 64, 10, '#fff', .25); dot(420, 64, 5, DARK); dot(450, 64, 10, '#fff', .25);
        bar(22, 96, 60, 7, .14); box(22, 110, 210, 32, 7, '#fff', .18); bar(34, 122, 110, 8, .07);
        ln([254, 126, 460, 126], .12, 4); ln([254, 126, 330, 126], .75, 4); dot(330, 126, 9, '#fff', .35);
        box(22, 158, 262, 32, 8, SOFT, .08); box(26, 162, 84, 24, 6, '#fff', .14); bar(44, 170, 48, 8, .18); bar(130, 170, 48, 8, .08); bar(214, 170, 48, 8, .08);
        var av = ['#E3E3DF', '#D6C8A2', '#C6C6C1', '#EFE8D8'];
        for (var k = 0; k < 4; k++) dot(318 + k * 22, 174, 14, av[k], .25);
        box(22, 204, 440, 40, 8, 'rgba(214,200,162,.3)', 0); dot(44, 224, 9, WARM); bar(62, 216, 200, 8, .18); bar(62, 229, 140, 7, .1);
        var pf = ['#fff', SOFT, 'rgba(214,200,162,.5)', DARK];
        for (k = 0; k < 4; k++) box(22 + k * 72, 256, 62, 22, 11, pf[k], k === 3 ? 0 : .14);
      },
      function board(){                 // a FigJam board: the human end of the work
        for (var y = 14; y < CH; y += 16) for (var x = 14; x < CW; x += 16) dot(x, y, 1.1, .12);
        function sticky(x, y, rot, fill, n){
          g.save(); g.translate(x, y); g.rotate(rot);
          g.shadowColor = 'rgba(0,0,0,.08)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
          g.fillStyle = fill; g.fillRect(-46, -42, 92, 84);
          g.shadowColor = 'transparent';
          for (var i = 0; i < n; i++) scribble(-34, -22 + i * 15, i === n - 1 ? 40 : 64);
          g.restore();
        }
        sticky(80, 96, -.06, NOTE, 3); sticky(206, 122, .04, '#EFE8D8', 2); sticky(380, 88, .07, NOTE, 3); sticky(330, 214, -.05, 'rgba(214,200,162,.9)', 2);
        g.beginPath(); g.moveTo(128, 62); g.bezierCurveTo(190, 26, 262, 22, 326, 50);
        g.strokeStyle = ink(.55); g.lineWidth = 2.2; g.lineCap = 'round'; g.stroke();
        ln([314, 40, 327, 51, 312, 58], .55, 2.2);
        g.beginPath(); g.moveTo(220, 168); g.bezierCurveTo(222, 196, 250, 212, 280, 214); g.stroke();
        ln([268, 205, 281, 214, 268, 222], .55, 2.2);
        g.save(); g.translate(122, 214);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 15); g.lineTo(4, 11.5); g.lineTo(6.6, 17); g.lineTo(9, 16); g.lineTo(6.5, 10.4); g.lineTo(11.5, 10.4); g.closePath();
        g.fillStyle = DARK; g.fill();
        box(12, 17, 40, 20, 10, DARK, 0); txt('you', 32, 27, 11, LIGHT, 'center');
        g.restore();
      },
      function table(){
        chrome();
        box(14, 44, 456, 28, 6, SOFT, 0); bar(28, 54, 60, 8, .16); bar(190, 54, 46, 8, .16); bar(290, 54, 56, 8, .16); bar(398, 54, 40, 8, .16);
        var av = ['#E3E3DF', '#D6C8A2', '#C6C6C1', '#EFE8D8', '#E3E3DF', '#D6C8A2'], pr = [70, 30, 55, 80, 20, 45];
        for (var i = 0; i < 6; i++) {
          var y = 80 + i * 34, s = i % 3;
          ln([14, y + 30, 470, y + 30], .06);
          dot(36, y + 15, 10, av[i], .2); bar(54, y + 11, 70 + (i * 31) % 50, 8, .16);
          box(190, y + 6, 64, 18, 9, s === 0 ? 'rgba(214,200,162,.6)' : s === 1 ? SOFT : '#fff', s === 2 ? .25 : 0); bar(202, y + 11, 40, 7, .14);
          ln([290, y + 15, 370, y + 15], .1, 5); ln([290, y + 15, 290 + pr[i], y + 15], .55, 5);
          dot(440, y + 15, 2, .3); dot(448, y + 15, 2, .3); dot(456, y + 15, 2, .3);
        }
      },
      function sources(){               // an answer that shows where it came from
        chrome();
        g.fillStyle = SOFT; g.fillRect(300, 33, CW - 300, CH); ln([300, 33, 300, CH], .08);
        bar(22, 48, 200, 12, .22);
        var paras = [[240, 226, 236, 170], [232, 240, 190], [228, 238, 214, 140]], y = 78, n = 1;
        for (var p = 0; p < 3; p++) {
          for (var l = 0; l < paras[p].length; l++) {
            var w = paras[p][l];
            if (l === 1) { rr(60, y - 3, 96, 13, 3); g.fillStyle = 'rgba(214,200,162,.5)'; g.fill(); }
            bar(22, y, w, 7, .12);
            if (l === 1) { dot(22 + w + 9, y + 3, 6, '#fff', .3); txt(String(n++), 22 + w + 9, y + 3.5, 8, ink(.6), 'center'); }
            y += 16;
          }
          y += 12;
        }
        bar(316, 48, 70, 8, .16);
        for (var k = 0; k < 3; k++) {
          var yy = 70 + k * 68;
          box(314, yy, 156, 58, 8, '#fff', .12); box(326, yy + 12, 20, 26, 3, '#fff', .25);
          bar(354, yy + 14, 84, 7, .16); bar(354, yy + 28, 64, 7, .08);
          dot(452, yy + 18, 8, DARK); txt(String(k + 1), 452, yy + 18.5, 9, LIGHT, 'center');
        }
      }
    ];

    cards.forEach(function(draw, i){
      g.save();
      g.translate((i % AC) * SW + SM, Math.floor(i / AC) * SH + SM);
      g.save();
      g.shadowColor = 'rgba(42,42,46,.10)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
      rr(0, 0, CW, CH, 16); g.fillStyle = PAPER; g.fill();
      g.restore();
      g.save(); rr(0, 0, CW, CH, 16); g.clip(); draw(); g.restore();
      rr(.75, .75, CW - 1.5, CH - 1.5, 16); g.strokeStyle = ink(.13); g.lineWidth = 1.5; g.stroke();
      g.restore();
    });
    return a;
  }

  var VS = [
    'attribute vec4 aTile;',          // u across the card, v down it, the card's angle on the loop, its row offset
    'attribute vec2 aSlot;',          // the card's corner in the atlas
    'uniform float uTime, uSweep, uLimit, uR, uP, uTileH, uTileA;',
    'uniform vec2 uHalf, uSlot;',
    'varying vec2 vUV, vLocal; varying float vPhase;',
    'void main(){',
    '  float c = mod(aTile.z - uTime + uSweep, 2.0 * uSweep) - uSweep;',
    '  vLocal = aTile.xy; vPhase = c; vUV = aSlot + aTile.xy * uSlot;',
    '  if (abs(c) > uLimit) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }',
    '  float th = c + (aTile.x - 0.5) * uTileA;',
    '  float X = uR * sin(th), Z = uR * (1.0 - cos(th)), Y = aTile.w + (aTile.y - 0.5) * uTileH;',
    '  gl_Position = vec4(X / uHalf.x, -Y / uHalf.y, 0.0, (uP - Z) / uP);',
    '}'
  ].join('\n');

  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes; uniform vec4 uClear; uniform float uFade, uClock, uAA, uAlpha;',
    'varying vec2 vUV, vLocal; varying float vPhase;',
    'float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }',
    'void main(){',
    '  vec4 col = texture2D(uTex, vUV);',
    '  vec3 ink = vec3(0.165, 0.165, 0.18);',
    /* the review mark, in the top-right corner of each card, in units of the card's height */
    '  vec2 e = vec2((vLocal.x - 0.9336) * 1.6, vLocal.y - 0.0969);',
    '  float d = length(e);',
    '  float done = step(vPhase, 0.0) * smoothstep(-0.75, -0.35, vPhase);',
    '  float pend = step(0.0, vPhase) * (1.0 - smoothstep(0.12, 0.5, vPhase));',
    '  float R = 0.032 * (1.0 + 0.45 * exp(-vPhase * vPhase * 400.0) * step(vPhase, 0.0));',
    '  float disc = (1.0 - smoothstep(R - uAA, R + uAA, d)) * done;',
    '  vec2 q = e / R;',
    '  float t = min(seg(q, vec2(-0.4, 0.02), vec2(-0.1, 0.32)), seg(q, vec2(-0.1, 0.32), vec2(0.42, -0.26)));',
    '  float tick = 1.0 - smoothstep(0.13 - uAA / R, 0.13 + uAA / R, t);',
    '  col = col * (1.0 - disc) + vec4(mix(ink, vec3(0.99), tick), 1.0) * disc;',
    '  float ring = 1.0 - smoothstep(0.0, uAA * 1.5, abs(d - R * 0.8) - R * 0.12);',
    '  float arc = step(fract(atan(e.y, e.x) / 6.2832 + uClock * 0.8), 0.28);',
    '  float pa = ring * (0.18 + 0.6 * arc) * pend;',
    '  col = col * (1.0 - pa) + vec4(ink, 1.0) * pa;',
    /* the wall fades into the page at the frame's sides, and thins out behind the headline */
    '  vec2 p = gl_FragCoord.xy / uRes;',
    '  float a = smoothstep(0.0, uFade, p.x) * smoothstep(0.0, uFade, 1.0 - p.x) * smoothstep(0.0, 0.1, p.y) * smoothstep(0.0, 0.08, 1.0 - p.y);',
    '  a *= mix(0.1, 1.0, smoothstep(0.5, 1.3, length((gl_FragCoord.xy - uClear.xy) / uClear.zw)));',
    '  gl_FragColor = col * a * uAlpha;',
    '}'
  ].join('\n');

  function shader(type, src){
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  c.className = 'hero__wall';
  c.setAttribute('aria-hidden', 'true');
  hero.insertBefore(c, hero.firstChild);

  var U = {};
  ['uTime', 'uSweep', 'uLimit', 'uR', 'uP', 'uTileH', 'uTileA', 'uHalf', 'uSlot', 'uTex', 'uRes', 'uClear', 'uFade', 'uClock', 'uAA', 'uAlpha']
    .forEach(function(n){ U[n] = gl.getUniformLocation(prog, n); });
  var aTile = gl.getAttribLocation(prog, 'aTile'), aSlot = gl.getAttribLocation(prog, 'aSlot');
  var vbo = gl.createBuffer(), ibo = gl.createBuffer(), tex = gl.createTexture(), count = 0;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  function upload(){
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wireframes());
  }
  upload();
  /* the button labels and chips use the mono face; draw the cards again once it has arrived */
  if (document.fonts && document.fonts.load) document.fonts.load('500 12px "IBM Plex Mono"').then(function(){ upload(); if (!running) render(lastT); });

  var CAMERA = 1.6, ASPECT = SW / SH, SEG = 24, SECS = 9;   // SECS: seconds for the wall to move one card
  var W = 1, H = 1, dpr = 1, tileA = 1, nudge = 0, lastT = 2.2;

  function layout(){
    var r = hero.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var phone = W < 640, vh = Math.min(H, window.innerHeight || H);
    var bend = (phone ? 62 : 74) * Math.PI / 180;
    var R = W * (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend));
    var tileH = Math.min((phone ? .14 : .2) * vh, (phone ? .44 : .5) * W / ASPECT);
    tileA = ASPECT * tileH / R;
    var limit = bend + tileA / 2;
    var cols = Math.min(60, Math.max(2, Math.ceil(2 * limit / tileA)));
    var sweep = cols * tileA / 2;
    var n = Math.ceil((H / 2 + tileH) / tileH);

    /* one strip mesh per card; rows alternate by half a card, like brickwork */
    var verts = [], idx = [], base = 0;
    for (var k = -n; k <= n; k++) {
      for (var j = 0; j < cols; j++) {
        var s = ((j * 5 + (k + n) * 7) % 12 + 12) % 12;
        var ang = -sweep + (j + .5) * tileA + (k & 1 ? tileA / 2 : 0);
        var su = (s % AC) / AC, sv = Math.floor(s / AC) / AR;
        for (var i = 0; i <= SEG; i++) verts.push(i / SEG, 0, ang, k * tileH, su, sv, i / SEG, 1, ang, k * tileH, su, sv);
        for (i = 0; i < SEG; i++) { var o = base + i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
        base += (SEG + 1) * 2;
      }
    }
    count = idx.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aTile); gl.vertexAttribPointer(aTile, 4, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(aSlot); gl.vertexAttribPointer(aSlot, 2, gl.FLOAT, false, 24, 16);

    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    gl.viewport(0, 0, c.width, c.height);
    gl.uniform1f(U.uSweep, sweep); gl.uniform1f(U.uLimit, limit);
    gl.uniform1f(U.uR, R); gl.uniform1f(U.uP, CAMERA * R);
    gl.uniform1f(U.uTileH, tileH); gl.uniform1f(U.uTileA, tileA);
    gl.uniform2f(U.uHalf, W / 2, H / 2);
    gl.uniform2f(U.uSlot, 1 / AC, 1 / AR);
    gl.uniform1i(U.uTex, 0);
    gl.uniform2f(U.uRes, c.width, c.height);
    /* an elliptical clearing round the headline block, so the copy sits on calm ground */
    var t = text ? text.getBoundingClientRect() : { left: r.left, top: r.top + H * .3, width: W * .55, height: H * .4 };
    gl.uniform4f(U.uClear, (t.left - r.left + t.width / 2) * dpr, (H - (t.top - r.top + t.height / 2)) * dpr, t.width * .7 * dpr, t.height * .8 * dpr);
    gl.uniform1f(U.uFade, phone ? .06 : .1);
    gl.uniform1f(U.uAA, 1.2 / (tileH * dpr));
    gl.uniform1f(U.uAlpha, .82);
  }

  function render(t){
    gl.uniform1f(U.uTime, t * tileA / SECS + nudge);
    gl.uniform1f(U.uClock, t);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
  }

  /* the pointer leans on the wall a little, and scrolling turns it on */
  var ptrX = .5, ptrAt = -1e9;
  if (fine && !reduced) addEventListener('pointermove', function(e){ ptrX = e.clientX / innerWidth; ptrAt = performance.now(); }, { passive: true });

  var raf = 0, running = false, onScreen = true, last = 0, clock = 0;
  function frame(now){
    raf = requestAnimationFrame(frame);
    var dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60;
    last = now; clock += dt;
    var want = (now - ptrAt < 4000 ? (ptrX - .5) * -.16 : 0) + Math.max(0, scrollY) * .0009;
    nudge += (want - nudge) * Math.min(1, dt / .6);
    lastT = clock; render(clock);
  }
  function start(){ if (running || reduced || !onScreen || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  layout();
  if (reduced) render(lastT); else start();
  requestAnimationFrame(function(){ c.classList.add('is-on'); });

  if ('IntersectionObserver' in window) new IntersectionObserver(function(es){
    onScreen = es[es.length - 1].isIntersecting; onScreen ? start() : stop();
  }).observe(hero);
  document.addEventListener('visibilitychange', function(){ document.hidden ? stop() : start(); });
  var rt = 0;
  function relayout(){ clearTimeout(rt); rt = setTimeout(function(){ layout(); if (!running) render(lastT); }, 150); }
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(hero); else addEventListener('resize', relayout);
  c.addEventListener('webglcontextlost', function(e){ e.preventDefault(); stop(); c.remove(); });
})();
