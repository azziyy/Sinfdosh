/* =====================================================
   FIREBASE SHARED SERVICE — Barcha o'yinlar uchun
   Umumiy balans, reyting, kunlik bonus
   ===================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getDatabase, ref, get, set, update, onValue, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCKQpBTOofMOxjc2A-fPJZx_gbVBfC-2lY",
  authDomain: "games-b909e.firebaseapp.com",
  databaseURL: "https://games-b909e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "games-b909e",
  storageBucket: "games-b909e.firebasestorage.app",
  messagingSenderId: "11875675257",
  appId: "1:11875675257:web:cce21690d9ad51cd35b8a8",
  measurementId: "G-CM5TF1XL1B"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* === CONSTANTLAR === */
const START_BALANCE = 10000;   // Yangi foydalanuvchi uchun boshlangʻich balans
const DAILY_BONUS   = 5000;    // Kunlik bonus

/* === Helper: bugungi sana (YYYY-MM-DD) === */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* === Foydalanuvchi nomini xavfsiz keyga aylantirish === */
function userKey(name) {
  if (!name) return 'guest';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[.#$/\[\]]/g, '_')
    .replace(/\s+/g, '_');
}

/* === currentUser ni localStorage-dan olish === */
function getCurrentUser() {
  try {
    const u = JSON.parse(localStorage.getItem('current_user'));
    if (u && u.name) return u;
  } catch(e){}
  return null;
}

/* =====================================================
   FOYDALANUVCHINI INITIALIZE QILISH
   - Yangi bo'lsa: 10 000 so'm + reyting kunlari
   - Mavjud bo'lsa: kunlik bonus tekshiriladi
   ===================================================== */
async function initUser(name) {
  if (!name) return null;
  const key = userKey(name);
  const userRef = ref(db, `users/${key}`);

  let bonusGiven = false;
  let bonusAmount = 0;

  await runTransaction(userRef, (cur) => {
    const now = Date.now();
    const today = todayStr();
    if (!cur) {
      // Yangi foydalanuvchi
      bonusGiven = true;
      bonusAmount = START_BALANCE;
      return {
        name: name,
        balance: START_BALANCE,
        totalWon: 0,
        totalBet: 0,
        gamesPlayed: 0,
        lastBonusDate: today,
        createdAt: now,
        updatedAt: now
      };
    }
    // Mavjud foydalanuvchi — kunlik bonus tekshirish
    if (cur.lastBonusDate !== today) {
      cur.balance = (cur.balance || 0) + DAILY_BONUS;
      cur.lastBonusDate = today;
      cur.updatedAt = now;
      bonusGiven = true;
      bonusAmount = DAILY_BONUS;
    }
    // ism o'zgargan bo'lishi mumkin (katta/kichik harf)
    if (cur.name !== name) cur.name = name;
    return cur;
  });

  const snap = await get(userRef);
  return { data: snap.val(), bonusGiven, bonusAmount, key };
}

/* === Balansni olish === */
async function getBalance(name) {
  const key = userKey(name);
  const snap = await get(ref(db, `users/${key}/balance`));
  return snap.exists() ? Number(snap.val()) : 0;
}

/* === Balansga qo'shish/ayirish (atomar) === */
async function changeBalance(name, delta, meta = {}) {
  const key = userKey(name);
  const userRef = ref(db, `users/${key}`);
  let newBal = 0;
  await runTransaction(userRef, (cur) => {
    if (!cur) cur = { name, balance: 0, totalWon: 0, totalBet: 0, gamesPlayed: 0, lastBonusDate: todayStr(), createdAt: Date.now() };
    cur.balance = Math.max(0, (cur.balance || 0) + delta);
    if (meta.isBet)  cur.totalBet = (cur.totalBet || 0) + Math.abs(delta);
    if (meta.isWin)  cur.totalWon = (cur.totalWon || 0) + delta;
    if (meta.gameEnd) cur.gamesPlayed = (cur.gamesPlayed || 0) + 1;
    cur.updatedAt = Date.now();
    newBal = cur.balance;
    return cur;
  });
  return newBal;
}

/* === Balansni real-time kuzatish === */
function watchBalance(name, callback) {
  const key = userKey(name);
  return onValue(ref(db, `users/${key}/balance`), (snap) => {
    callback(snap.exists() ? Number(snap.val()) : 0);
  });
}

/* === O'yin natijasini yozish (tarix uchun) === */
async function logGame(name, gameId, bet, win, multiplier = 1) {
  const key = userKey(name);
  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  await set(ref(db, `gameHistory/${key}/${id}`), {
    game: gameId,
    bet: bet,
    win: win,
    profit: win - bet,
    multiplier: multiplier,
    at: Date.now()
  });
}

/* === REYTING — barcha foydalanuvchilarni balans bo'yicha === */
function watchLeaderboard(callback) {
  return onValue(ref(db, 'users'), (snap) => {
    const list = [];
    snap.forEach(child => {
      const v = child.val();
      list.push({
        key: child.key,
        name: v.name || child.key,
        balance: Number(v.balance) || 0,
        totalWon: Number(v.totalWon) || 0,
        totalBet: Number(v.totalBet) || 0,
        gamesPlayed: Number(v.gamesPlayed) || 0
      });
    });
    list.sort((a, b) => b.balance - a.balance);
    callback(list);
  });
}

/* === Bitta foydalanuvchining ma'lumotini real-time === */
function watchUser(name, callback) {
  const key = userKey(name);
  return onValue(ref(db, `users/${key}`), (snap) => {
    callback(snap.val());
  });
}

/* === Pul formatlash === */
function fmtMoney(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

/* === Global eksport (Firebase modulasi import bo'lmagan joylar uchun) === */
window.GamesAPI = {
  initUser,
  getBalance,
  changeBalance,
  watchBalance,
  watchLeaderboard,
  watchUser,
  logGame,
  getCurrentUser,
  userKey,
  fmtMoney,
  DAILY_BONUS,
  START_BALANCE
};

// Sahifa yuklanganda current user uchun init qilish (agar bor bo'lsa)
(async () => {
  const u = getCurrentUser();
  if (u && u.name) {
    try {
      const res = await initUser(u.name);
      if (res && res.bonusGiven && res.bonusAmount > 0) {
        // Bonus xabari — agar showToast mavjud bo'lsa
        const msg = res.data.gamesPlayed === 0 && res.bonusAmount === START_BALANCE
          ? `🎁 Boshlangʻich balans: ${fmtMoney(res.bonusAmount)} soʻm`
          : `🎁 Kunlik bonus: +${fmtMoney(res.bonusAmount)} soʻm`;
        // toast yo'q bo'lishi mumkin — kichik delay
        setTimeout(() => {
          if (typeof window.showToast === 'function') {
            window.showToast(msg, 'success');
          } else {
            // Custom event
            window.dispatchEvent(new CustomEvent('games:bonus', { detail: { msg, amount: res.bonusAmount }}));
          }
        }, 800);
      }
      window.dispatchEvent(new CustomEvent('games:ready', { detail: res }));
    } catch(e){ console.warn('initUser xato:', e); }
  }
})();

export {
  initUser, getBalance, changeBalance, watchBalance,
  watchLeaderboard, watchUser, logGame, userKey, fmtMoney,
  getCurrentUser, DAILY_BONUS, START_BALANCE
};
