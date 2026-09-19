/* Near-full-screen case study popup with a back button.
   It pushes the case study's own address, so browser Back and Esc close it, and the link is shareable. */
const pop = document.getElementById('popup');
const frame = pop.querySelector('.popup__doc');
const back = pop.querySelector('.popup__back');
const title = document.getElementById('popup-title');
const root = document.documentElement;
const behind = () => [...document.querySelectorAll('.nav, #main, .footer')];
let opener = null;
let houseUrl = location.href;

export function openCase(url, label, from) {
  opener = from || document.activeElement;
  frame.src = url + (url.includes('?') ? '&' : '?') + 'embed=1';
  title.textContent = label || 'Case study';
  pop.hidden = false;
  root.classList.add('popup-open');
  behind().forEach((el) => { el.inert = true; });
  houseUrl = location.href;
  history.pushState({ houseCase: url }, '', url);
  back.focus();
}

function hideCase() {
  if (pop.hidden) return;
  pop.hidden = true;
  root.classList.remove('popup-open');
  behind().forEach((el) => { el.inert = false; });
  frame.src = 'about:blank';
  if (opener && opener.focus) opener.focus({ preventScroll: true });
}

export function closeCase() {
  // hide first, so the popup closes even if the browser defers or ignores the history step
  const pushed = history.state && history.state.houseCase;
  hideCase();
  if (!pushed) return;
  history.back();
  // browsers may skip a step that was added without a user gesture; then just put the house's address back
  setTimeout(() => {
    if (pop.hidden && history.state && history.state.houseCase) history.replaceState(null, '', houseUrl);
  }, 400);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-case]');
  if (!b) return;
  e.preventDefault();
  openCase(b.dataset.case, b.dataset.title, b);
});
back.addEventListener('click', closeCase);
addEventListener('popstate', () => { if (!(history.state && history.state.houseCase)) hideCase(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) closeCase(); });
addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data && e.data.type === 'close-case') closeCase();
});
