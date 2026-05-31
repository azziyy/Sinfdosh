/* ============================================
   CONFIG — Google Sheets sozlamalari
   ============================================ */

const CONFIG = {
  // Google Sheets hujjat IDsi
  SHEET_ID: '1Mb0SIaF_GQX1rGEbS0x-BJ_35ZA_DEaWvHnfl2PnaDE',

  // Har bir varaqning GID raqami
  SHEETS: {
    baza:     { gid: '0',           name: 'Baza' },
    osh:      { gid: '1869561715',  name: 'Osh navbati' },
    fond:     { gid: '990494192',   name: 'Fond' },
    toyona:   { gid: '1906390244',  name: 'Toʻyona roʻyxati' },
    news:     { gid: '1043946789',  name: 'Yangiliklar' },
    gallery:  { gid: '1215266897',  name: 'Estalik uchun (Galereya)' }
  },

  // Oylar nomi
  MONTHS: [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ],
  MONTHS_SHORT: [
    'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn',
    'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'
  ],

  // Ilova versiyasi — statik fayllar (css/js) o'zgarganda bu raqamni oshiring.
  // Service Worker va fayl havolalaridagi ?v= shu versiyaga bog'langan.
  APP_VERSION: '2.4.0',

  // Cache muddati (ms) — ENDI bu faqat ZAXIRA (offline) uchun ishlatiladi.
  // Ma'lumotlar har doim avval tarmoqdan (network-first) olinadi, shuning uchun
  // yangi qo'shilgan ma'lumot bir refresh bilan darhol ko'rinadi.
  CACHE_TTL: 24 * 60 * 60 * 1000
};

// Google Sheets gviz JSON URL yaratuvchi
function buildSheetUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
}

// Pulni formatlash: 50000 -> "50 000 soʻm"
function formatMoney(value) {
  if (value == null || value === '' || isNaN(value)) return '0 soʻm';
  const n = Number(value);
  return n.toLocaleString('ru-RU').replace(/,/g, ' ') + ' soʻm';
}

// Pul ko'rsatish — har doim to'liq soʻm formatida (foydalanuvchi talabiga ko'ra)
// Eski "50K" / "1.5 mln" qisqartmalari endi ishlatilmaydi — barcha joyda soʻmda yoziladi.
function shortMoney(value) {
  return formatMoney(value);
}

// Sanani parse qilish: "18.03.2000" yoki Date obyekti -> Date
function parseDate(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  const s = String(str).trim();
  // dd.mm.yyyy
  const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    y = y.length === 2 ? '20' + y : y;
    return new Date(parseInt(y), parseInt(mo) - 1, parseInt(d));
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

// Tug'ilgan kungacha kun
function daysUntilBirthday(birthday) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const next = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
}

// Yoshi
function calcAge(birthday) {
  if (!birthday) return null;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const m = today.getMonth() - birthday.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthday.getDate())) age--;
  return age;
}

// Toast ko'rsatish
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  setTimeout(() => t.classList.add('hidden'), 2800);
  t.classList.remove('hidden');
}

// LocalStorage yordamchilar
const Storage = {
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
  remove(k) { try { localStorage.removeItem(k); } catch(e){} }
};

// Oy nomini index-ga aylantirish (variantlarni qoʻllab-quvvatlaydi:
// "Sentyabr"/"Sentabr", "Oktyabr"/"Oktabr", "Iyul'"/"Iyul" va h.k.)
function monthIndex(monthStr) {
  if (!monthStr) return -1;
  let s = String(monthStr).toLowerCase().trim();
  // Variant imlolarini normallashtirish
  s = s
    .replace(/sentyabr/g, 'sentabr')
    .replace(/oktyabr/g, 'oktabr')
    .replace(/[ʼ'`]/g, '');
  return CONFIG.MONTHS.findIndex(m => {
    const ml = m.toLowerCase().replace(/[ʼ'`]/g, '');
    return s.includes(ml) || ml.includes(s);
  });
}

// Initiallarni olish (ism uchun)
function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Rasm yoki avatar
function avatarHTML(name, imageUrl, sizeClass = '') {
  if (imageUrl && imageUrl.trim()) {
    return `<img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(name)}" class="${sizeClass}" onerror="this.outerHTML='<div class=\\'member-avatar ${sizeClass}\\'>${escapeAttr(getInitials(name))}</div>'"/>`;
  }
  return `<div class="member-avatar ${sizeClass}">${escapeAttr(getInitials(name))}</div>`;
}

function escapeHTML(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHTML(s);
}
