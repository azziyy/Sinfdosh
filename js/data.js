/* ============================================
   DATA — Google Sheets dan ma'lumot olish
   ============================================ */

const DataService = {

  // gviz JSON javobni parse qilish
  parseGviz(text) {
    // Javob format: google.visualization.Query.setResponse({...})
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?/);
    if (!match) throw new Error('Invalid gviz response');
    const json = JSON.parse(match[1]);
    if (json.status === 'error') throw new Error(json.errors?.[0]?.detailed_message || 'Sheet error');

    const cols = (json.table.cols || []).map(c => c.label || c.id);
    const rows = (json.table.rows || []).map(r => {
      return (r.c || []).map(c => {
        if (!c) return '';
        // Sanani DD.MM.YYYY ga aylantirish
        if (c.f) return c.f;
        return c.v == null ? '' : c.v;
      });
    });
    return { cols, rows };
  },

  // Bitta varaqdan ma'lumot olish
  //
  // STRATEGIYA: "NETWORK-FIRST" (avval tarmoq) — yangi ma'lumotlar HAR DOIM
  // bir refresh bilan ko'rinadi. Cache faqat ZAXIRA sifatida ishlatiladi:
  //   1) Internet bo'lmasa yoki Google Sheets javob bermasa — eski cache ko'rsatiladi.
  //   2) URL ga vaqt belgisi (_=timestamp) qo'shiladi — brauzer eski (stale)
  //      javobni o'z keshidan bermaydi, har safar haqiqiy yangi ma'lumot keladi.
  async fetchSheet(gid, opts = {}) {
    const { forceFresh = false } = opts;
    const cacheKey = `sheet_${gid}`;

    // Cache-busting: gviz endpointi noma'lum parametrlarni e'tiborsiz qoldiradi,
    // shuning uchun _=<vaqt> qo'shish xavfsiz va brauzer keshini chetlab o'tadi.
    const url = buildSheetUrl(gid) + `&_=${Date.now()}`;
    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const data = this.parseGviz(text);
      // Muvaffaqiyatli — yangi ma'lumotni zaxira (offline) uchun saqlaymiz
      Storage.set(cacheKey, { t: Date.now(), data });
      return data;
    } catch (e) {
      // Tarmoq xatosi — agar majburiy yangilash bo'lmasa, eski cache ni qaytaramiz
      if (!forceFresh) {
        const cached = Storage.get(cacheKey);
        if (cached && cached.data) {
          console.warn(`fetchSheet(${gid}) tarmoq xatosi — eski cache ishlatildi`, e);
          return cached.data;
        }
      }
      throw e;
    }
  },

  // Cachni tozalash
  clearCache() {
    Object.values(CONFIG.SHEETS).forEach(s => Storage.remove(`sheet_${s.gid}`));
  },

  // BAZA — a'zolar
  async getMembers() {
    const { rows } = await this.fetchSheet(CONFIG.SHEETS.baza.gid);
    return rows
      .filter(r => r[0] && String(r[0]).trim())
      .map(r => ({
        name: String(r[0] || '').trim(),
        birthday: String(r[1] || '').trim(),
        phone: String(r[2] || '').trim(),
        image: String(r[3] || '').trim(),
        password: String(r[4] || '').trim()
      }));
  },

  // OSH NAVBATI
  async getOsh() {
    const { rows } = await this.fetchSheet(CONFIG.SHEETS.osh.gid);
    return rows
      .filter(r => r[0] && r[1])
      .map(r => ({
        year: parseInt(String(r[0]).replace(/\D/g, '')) || new Date().getFullYear(),
        month: String(r[1] || '').trim(),
        member: String(r[2] || '').trim()
      }));
  },

  // FOND
  // A ustun: yil, B ustun: oy, C ustun: aʼzo ismi, D ustun: qoʻshilgan summa,
  // E ustun: chiqim (agar shu qatorda yozilsa, oʻsha oy/yil uchun chiqim hisoblanadi).
  // Bitta qatorda C/D (toʻlov) yoki faqat E (chiqim) boʻlishi mumkin — ikkalasi ham
  // boʻlsa, ikkalasi ham hisobga olinadi.
  async getFond() {
    const { rows } = await this.fetchSheet(CONFIG.SHEETS.fond.gid);
    const payments = [];
    const expenses = [];

    rows.forEach(r => {
      const year = parseInt(String(r[0] || '').replace(/\D/g, '')) || null;
      const month = String(r[1] || '').trim();
      if (!year || !month) return;

      const member = String(r[2] || '').trim();
      const amount = Number(String(r[3] || '0').replace(/[^\d.-]/g, '')) || 0;
      if (member && amount) {
        payments.push({ year, month, member, amount });
      }

      const expense = Number(String(r[4] || '0').replace(/[^\d.-]/g, '')) || 0;
      if (expense) {
        expenses.push({ year, month, amount: expense });
      }
    });

    return { payments, expenses };
  },

  // TO'YONA — A ustun: a'zo ismi (kimga to'yona qilingan)
  // B ustun: ko'p qatorli matn (kg go'sht, so'm, dollar — aralash bo'lishi mumkin)
  // Matnni shunchaki qator-qator saqlaymiz, summa hisoblamaymiz
  async getToyona() {
    const { rows } = await this.fetchSheet(CONFIG.SHEETS.toyona.gid);
    const grouped = {};
    let currentOwner = null;

    rows.forEach(r => {
      const aVal = String(r[0] || '').trim();
      const bVal = String(r[1] || '').trim();

      if (aVal) {
        currentOwner = aVal;
        if (!grouped[currentOwner]) grouped[currentOwner] = [];
      }
      if (currentOwner && bVal) {
        // Ko'p qatorli matnni qatorlarga bo'lish (\n, \r\n)
        const lines = bVal
          .split(/\r?\n+/)
          .map(l => l.trim())
          .filter(l => l.length > 0);
        grouped[currentOwner].push(...lines);
      }
    });

    return Object.entries(grouped).map(([owner, lines]) => ({
      owner,
      lines
    }));
  },

  // GALEREYA (Estalik uchun) — A ustun: Kategoriya nomi, B ustun: Rasm URL
  // Kategoriya bo'yicha guruhlanadi.
  async getGallery() {
    const { rows } = await this.fetchSheet(CONFIG.SHEETS.gallery.gid);
    const grouped = {};
    let currentCategory = null;
    rows.forEach(r => {
      const cat = String(r[0] || '').trim();
      const url = String(r[1] || '').trim();
      if (cat) {
        currentCategory = cat;
        if (!grouped[currentCategory]) grouped[currentCategory] = [];
      }
      // Faqat haqiqiy rasm URL bo'lsa qo'shamiz (header so'zlarini chiqarib tashlaymiz)
      if (currentCategory && url && /^https?:\/\//i.test(url)) {
        grouped[currentCategory].push(url);
      }
    });
    return Object.entries(grouped)
      .filter(([cat, images]) => images.length > 0)
      .map(([category, images]) => ({ category, images }));
  },

  // YANGILIKLAR
  async getNews() {
    const { rows } = await this.fetchSheet(CONFIG.SHEETS.news.gid);
    return rows
      .filter(r => r[0] || r[1])
      .map(r => ({
        title: String(r[0] || '').trim(),
        content: String(r[1] || '').trim(),
        image: String(r[2] || '').trim()
      }))
      .reverse(); // eng yangilari oldinda
  },

  // Hammasini bir vaqtda olish
  async loadAll() {
    const [members, osh, fondData, toyona, news] = await Promise.all([
      this.getMembers().catch(e => { console.error('members', e); return []; }),
      this.getOsh().catch(e => { console.error('osh', e); return []; }),
      this.getFond().catch(e => { console.error('fond', e); return { payments: [], expenses: [] }; }),
      this.getToyona().catch(e => { console.error('toyona', e); return []; }),
      this.getNews().catch(e => { console.error('news', e); return []; })
    ]);
    return { members, osh, fond: fondData.payments, fondExpenses: fondData.expenses, toyona, news };
  },

  // Majburiy yangilash — eski cache ni tozalab, hammasini tarmoqdan qayta yuklaydi.
  // "Yangilash" tugmasi va pastga tortib yangilash (pull-to-refresh) shuni chaqiradi.
  async refreshAll() {
    this.clearCache();
    return this.loadAll();
  },

  // A'zoni ismi bo'yicha topish
  // MUHIM: Faqat ANIQ moslik (exact match) — aks holda "Akmal" va "Akmaljon" kabi
  // ismlar bir-biri bilan adashtirib yuboriladi.
  // Qo'shimcha: bo'sh joylar va ismdagi taxalluslarga ham toqat qilamiz, lekin
  // qisman moslikni (startsWith/includes) qat'iyan ishlatmaymiz.
  findMember(members, name) {
    if (!name) return null;
    const n = String(name).toLowerCase().trim().replace(/\s+/g, ' ');
    // 1) To'liq aniq moslik
    let found = members.find(m => m.name.toLowerCase().trim().replace(/\s+/g, ' ') === n);
    if (found) return found;
    // 2) Birinchi so'z (ism) bo'yicha aniq moslik — "Akmal" → faqat "Akmal ..." topadi, "Akmaljon" emas
    const firstWord = n.split(' ')[0];
    found = members.find(m => {
      const memberFirst = m.name.toLowerCase().trim().split(/\s+/)[0];
      return memberFirst === firstWord;
    });
    if (found) return found;
    // 3) Topilmadi
    return null;
  }
};
