// PrishCraft site magic: stars, sparks, spellbook, lightbox, owl post.

// ---------- loading screen ----------
window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('loader').classList.add('done'), 350);
});
// never trap visitors if something stalls
setTimeout(() => document.getElementById('loader').classList.add('done'), 2500);

// ---------- starfield + floating particles ----------
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
let stars = [];

function seedStars() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const n = Math.min(180, Math.floor((innerWidth * innerHeight) / 9000));
  stars = Array.from({ length: n }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.6 + 0.4,
    tw: Math.random() * Math.PI * 2,
    sp: 0.04 + Math.random() * 0.12,
    gold: Math.random() < 0.12,
  }));
}
seedStars();
addEventListener('resize', seedStars);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

(function drawStars(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const day = document.documentElement.dataset.theme === 'day';
  for (const s of stars) {
    const twinkle = 0.55 + Math.sin(t / 900 + s.tw) * 0.45;
    ctx.globalAlpha = (day ? 0.25 : 0.9) * twinkle;
    ctx.fillStyle = s.gold ? '#ffd24a' : '#e8e6ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    s.y -= s.sp; // gentle float upward, like rising sparks
    if (s.y < -4) { s.y = canvas.height + 4; s.x = Math.random() * canvas.width; }
  }
  if (!reducedMotion) requestAnimationFrame(drawStars);
})(0);

// ---------- theme toggle ----------
const themeBtn = document.getElementById('theme-toggle');
themeBtn.addEventListener('click', () => {
  const root = document.documentElement;
  const day = root.dataset.theme === 'day';
  root.dataset.theme = day ? '' : 'day';
  themeBtn.textContent = day ? '🌙' : '☀️';
});

// ---------- scroll reveals ----------
const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
  { threshold: 0.15 },
);
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

// ---------- spell sparks on button clicks ----------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.spell-btn');
  if (!btn || reducedMotion) return;
  const colors = ['#ffd24a', '#b9a8ee', '#f0a6e8', '#7fd4f0'];
  for (let i = 0; i < 14; i++) {
    const spark = document.createElement('div');
    spark.className = 'spark';
    spark.style.left = `${e.clientX}px`;
    spark.style.top = `${e.clientY}px`;
    spark.style.background = colors[i % colors.length];
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 40 + Math.random() * 70;
    spark.style.setProperty('--sx', `${Math.cos(angle) * dist}px`);
    spark.style.setProperty('--sy', `${Math.sin(angle) * dist}px`);
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 750);
  }
});

// ---------- the spellbook ----------
const SPELLS = [
  { name: 'Fireball', rune: '🔥', kind: 'ATTACK · EMBER SCHOOL', desc: 'A rolling orb of cheerful flame. Excellent against Gloom, marshmallows, and chilly evenings.' },
  { name: 'Ice Blast', rune: '❄️', kind: 'CONTROL · TIDE SCHOOL', desc: 'Freezes a splash of sea into a bridge of ice. Slippery. Extremely fun.' },
  { name: 'Levitation', rune: '🪶', kind: 'MOTION · SKY SCHOOL', desc: 'Lifts blocks, boots, and occasionally startled chickens gently into the air.' },
  { name: 'Healing Light', rune: '💛', kind: 'BLESSING · DAWN SCHOOL', desc: 'A warm golden glow that mends scraped knees and refills brave hearts.' },
  { name: 'Lightning Strike', rune: '⚡', kind: 'ATTACK · STORM SCHOOL', desc: 'Calls one (1) polite bolt of lightning. Please aim away from the library.' },
  { name: 'Shield Charm', rune: '🛡️', kind: 'GUARD · STONE SCHOOL', desc: 'Wraps you in a shimmering bubble that whomping willows simply bounce off.' },
];
let page = 0;
const pageEl = document.getElementById('book-page');

function renderSpell() {
  const s = SPELLS[page];
  pageEl.innerHTML = `
    <span class="spell-rune">${s.rune}</span>
    <h3 class="spell-name">${s.name}</h3>
    <span class="spell-kind pixel">${s.kind}</span>
    <p class="spell-desc">${s.desc}</p>
    <span class="pixel">PAGE ${page + 1} OF ${SPELLS.length}</span>`;
}
function turnPage(dir) {
  page = (page + dir + SPELLS.length) % SPELLS.length;
  pageEl.classList.remove('flip');
  void pageEl.offsetWidth; // restart the animation
  pageEl.classList.add('flip');
  setTimeout(renderSpell, 200);
}
document.getElementById('page-prev').addEventListener('click', () => turnPage(-1));
document.getElementById('page-next').addEventListener('click', () => turnPage(1));
renderSpell();

// ---------- gallery lightbox ----------
const lightbox = document.getElementById('lightbox');
document.querySelectorAll('.gallery .shot').forEach((shot) => {
  shot.addEventListener('click', () => {
    const styles = getComputedStyle(shot);
    const art = document.getElementById('lightbox-art');
    art.style.setProperty('--g1', styles.getPropertyValue('--g1'));
    art.style.setProperty('--g2', styles.getPropertyValue('--g2'));
    document.getElementById('lightbox-emoji').textContent = shot.querySelector('span').textContent;
    document.getElementById('lightbox-title').textContent = shot.dataset.title;
    lightbox.showModal();
  });
});
document.getElementById('lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });

// ---------- trailer ----------
const trailer = document.getElementById('trailer');
document.getElementById('trailer-btn').addEventListener('click', () => trailer.showModal());
document.getElementById('trailer-close').addEventListener('click', () => trailer.close());
trailer.addEventListener('click', (e) => { if (e.target === trailer) trailer.close(); });

// ---------- owl post ----------
document.getElementById('owl-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('owl-email').value.trim();
  const owls = JSON.parse(localStorage.getItem('prishcraft.owls') || '[]');
  owls.push({ email, at: new Date().toISOString() });
  localStorage.setItem('prishcraft.owls', JSON.stringify(owls));
  e.target.hidden = true;
  document.getElementById('owl-confirm').hidden = false;
});
