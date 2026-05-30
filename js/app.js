/* ============================================
   APP — Asosiy logika
   ============================================ */

const App = {
  data: { members: [], osh: [], fond: [], toyona: [], news: [] },
  currentUser: null,
  selectedMember: null,
  currentOshYear: new Date().getFullYear(),
  currentFondYear: new Date().getFullYear(),

  // INITIALIZE
  async init() {
    try {
      this.data = await DataService.loadAll();
    } catch (e) {
      console.error('Load error', e);
      showToast('Maʼlumotlarni yuklashda xato', 'error');
    }
    document.getElementById('loader').classList.add('hidden');

    // Saqlangan sessiya bormi?
    const saved = Storage.get('current_user');
    if (saved) {
      const m = DataService.findMember(this.data.members, saved.name);
      if (m && m.password === saved.password) {
        this.currentUser = m;
        this.showSplashStories();
        return;
      } else {
        Storage.remove('current_user');
      }
    }
    this.showLogin();
  },

  // =============== SCREENS ===============
  showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('splash-stories').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
  },

  showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('splash-stories').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    this.renderAll();
    // History stack-ni "home" sahifa bilan boshlaymiz
    this._historyInit = false;
    this.switchPage('home', { fromPop: false, replace: true });
  },

  // =============== LOGIN ===============
  bindLoginEvents() {
    document.getElementById('open-register').addEventListener('click', () => this.openRegister());

    // Modal close
    document.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-close');
        document.getElementById(id).classList.add('hidden');
      });
    });

    // Member search
    document.getElementById('member-search').addEventListener('input', (e) => {
      this.renderMemberList(e.target.value);
    });

    // Password toggle
    document.getElementById('toggle-password').addEventListener('click', () => {
      const inp = document.getElementById('password-input');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Login button
    document.getElementById('login-btn').addEventListener('click', () => this.doLogin());
    document.getElementById('password-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.doLogin();
    });

    // Back to list
    document.getElementById('back-to-list').addEventListener('click', () => {
      this.selectedMember = null;
      document.getElementById('password-step').classList.add('hidden');
      document.getElementById('member-list').style.display = 'flex';
      document.querySelector('.search-box').style.display = 'flex';
      document.getElementById('password-input').value = '';
      document.getElementById('password-error').textContent = '';
    });
  },

  openRegister() {
    if (this.data.members.length === 0) {
      showToast('Aʼzolar yuklanmadi. Qayta urinib koʻring', 'error');
      return;
    }
    document.getElementById('register-modal').classList.remove('hidden');
    document.getElementById('password-step').classList.add('hidden');
    document.getElementById('member-list').style.display = 'flex';
    document.querySelector('#register-modal .search-box').style.display = 'flex';
    this.renderMemberList('');
  },

  renderMemberList(filter = '') {
    const list = document.getElementById('member-list');
    const f = filter.toLowerCase().trim();
    const items = this.data.members.filter(m =>
      !f || m.name.toLowerCase().includes(f)
    );
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="emoji">🔍</div><p>Hech narsa topilmadi</p></div>`;
      return;
    }
    list.innerHTML = items.map(m => `
      <div class="member-item" data-name="${escapeAttr(m.name)}">
        ${avatarHTML(m.name, m.image)}
        <div class="info">
          <strong>${escapeHTML(m.name)}</strong>
          <span>${m.phone ? escapeHTML(m.phone) : 'Aʼzo'}</span>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.member-item').forEach(el => {
      el.addEventListener('click', () => {
        const name = el.getAttribute('data-name');
        this.selectMember(name);
      });
    });
  },

  selectMember(name) {
    this.selectedMember = this.data.members.find(m => m.name === name);
    if (!this.selectedMember) return;

    document.getElementById('member-list').style.display = 'none';
    document.querySelector('#register-modal .search-box').style.display = 'none';

    const info = document.getElementById('selected-member-info');
    info.innerHTML = `
      ${avatarHTML(this.selectedMember.name, this.selectedMember.image)}
      <div class="info">
        <strong>${escapeHTML(this.selectedMember.name)}</strong>
        <span>${this.selectedMember.phone ? escapeHTML(this.selectedMember.phone) : ''}</span>
      </div>
    `;
    document.getElementById('password-step').classList.remove('hidden');
    document.getElementById('password-input').value = '';
    document.getElementById('password-error').textContent = '';
    setTimeout(() => document.getElementById('password-input').focus(), 100);
  },

  doLogin() {
    const inp = document.getElementById('password-input');
    const err = document.getElementById('password-error');
    if (!this.selectedMember) return;
    const pw = inp.value.trim();
    if (!pw) {
      err.textContent = 'Maxfiy kodni kiriting';
      return;
    }
    if (String(this.selectedMember.password).trim() !== pw) {
      err.textContent = 'Maxfiy kod notoʻgʻri';
      return;
    }
    this.currentUser = this.selectedMember;
    Storage.set('current_user', { name: this.currentUser.name, password: pw });
    document.getElementById('register-modal').classList.add('hidden');
    showToast(`Xush kelibsiz, ${this.currentUser.name}!`, 'success');
    this.showSplashStories();
  },

  // =============== SPLASH STORIES ===============
  showSplashStories() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('splash-stories').classList.remove('hidden');
    this.renderStories();
  },

  buildStories() {
    const stories = [];
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = CONFIG.MONTHS[now.getMonth()];

    // 1. (Olib tashlangan) — "Salom, Azizbek!" salomlashish slaydi foydalanuvchi talabiga ko'ra o'chirildi.

    // 2. Bu oy fond
    const curMonthIdxS = monthIndex(curMonth);
    const monthFond = this.data.fond.filter(f =>
      f.year === curYear && monthIndex(f.month) === curMonthIdxS
    );
    const monthTotal = monthFond.reduce((s, f) => s + f.amount, 0);
    stories.push({
      bg: 'bg-2',
      content: `
        <div class="emoji">💰</div>
        <h2>${escapeHTML(curMonth)} oyi fondi</h2>
        <div class="big-number">${formatMoney(monthTotal)}</div>
        <p>${monthFond.length} ta aʼzo bu oy uchun toʻlov amalga oshirgan</p>
      `
    });

    // 3. Yaqin tug'ilgan kun
    const upcoming = this.data.members
      .map(m => ({ ...m, _bdate: parseDate(m.birthday) }))
      .filter(m => m._bdate)
      .map(m => ({ ...m, _days: daysUntilBirthday(m._bdate) }))
      .filter(m => m._days <= 60)
      .sort((a,b) => a._days - b._days)
      .slice(0, 3);

    if (upcoming.length > 0) {
      const top = upcoming[0];
      stories.push({
        bg: 'bg-3',
        content: `
          <div class="emoji">🎂</div>
          <h2>Yaqin tugʻilgan kun</h2>
          <img src="${escapeAttr(top.image)}" class="story-img" onerror="this.style.display='none'"/>
          <p style="font-size:20px;font-weight:700;margin-bottom:4px">${escapeHTML(top.name)}</p>
          <div class="big-number">${top._days === 0 ? 'Bugun!' : top._days + ' kun'}</div>
          <p>${escapeHTML(top.birthday)} — ${calcAge(top._bdate) + (top._days > 0 ? 1 : 0)} yoshda</p>
        `
      });
    }

    // 4. Bu oy osh navbati
    const oshThisMonth = this.data.osh.find(o =>
      o.year === curYear && monthIndex(o.month) === curMonthIdxS
    );
    if (oshThisMonth) {
      const m = DataService.findMember(this.data.members, oshThisMonth.member);
      stories.push({
        bg: 'bg-4',
        content: `
          <div class="emoji">🍲</div>
          <h2>${escapeHTML(curMonth)} oyi oshi</h2>
          ${m && m.image ? `<img src="${escapeAttr(m.image)}" class="story-img" onerror="this.style.display='none'"/>` : ''}
          <p style="font-size:22px;font-weight:700">${escapeHTML(oshThisMonth.member)}</p>
          <p>Bu oy oshxonani oʻtkazadi</p>
        `
      });
    }

    // 5. Mening fond holatim
    if (this.currentUser) {
      const myPayments = this.data.fond.filter(f =>
        f.year === curYear &&
        f.member.toLowerCase() === this.currentUser.name.toLowerCase()
      );
      const myTotal = myPayments.reduce((s, f) => s + f.amount, 0);
      const paidIdxSet = new Set(myPayments.map(p => monthIndex(p.month)).filter(i => i >= 0));
      const unpaidMonths = CONFIG.MONTHS.filter((m, i) =>
        !paidIdxSet.has(i) && i <= now.getMonth()
      );
      const paidMonths = paidIdxSet; // keyingi kod uchun
      stories.push({
        bg: 'bg-5',
        content: `
          <div class="emoji">📊</div>
          <h2>Mening hisobim ${curYear}</h2>
          <div class="big-number">${formatMoney(myTotal)}</div>
          <p>${paidMonths.size} oy uchun toʻlangan</p>
          ${unpaidMonths.length > 0 ? `
            <div class="story-list" style="margin-top:16px">
              <div class="story-list-item" style="justify-content:center;text-align:center">
                <span class="lbl" style="text-align:center">⚠️ Toʻlanmagan: <strong>${unpaidMonths.join(', ')}</strong></span>
              </div>
            </div>
          ` : `<p style="color:#a7f3d0;margin-top:8px">✓ Barcha oylar toʻlangan!</p>`}
        `
      });
    }

    // 6. So'nggi yangilik
    if (this.data.news.length > 0) {
      const last = this.data.news[0];
      stories.push({
        bg: 'bg-6',
        content: `
          <div class="emoji">📰</div>
          <h2>${escapeHTML(last.title)}</h2>
          <p>${escapeHTML(last.content.substring(0, 200))}${last.content.length > 200 ? '...' : ''}</p>
        `
      });
    }

    return stories;
  },

  renderStories() {
    const stories = this.buildStories();
    const container = document.getElementById('stories-container');
    const progress = document.getElementById('stories-progress');

    container.innerHTML = stories.map((s, i) => `
      <div class="story-slide ${s.bg} ${i === 0 ? 'active' : ''}" data-idx="${i}">
        ${s.content}
      </div>
    `).join('');

    progress.innerHTML = stories.map((_, i) => `
      <div class="story-bar" data-idx="${i}"><div class="fill"></div></div>
    `).join('');

    this.storyIndex = 0;
    this.storyTotal = stories.length;
    this.startStoryTimer();
  },

  startStoryTimer() {
    if (this.storyTimer) clearTimeout(this.storyTimer);
    document.querySelectorAll('.story-bar').forEach((b, i) => {
      b.classList.remove('active', 'done');
      if (i < this.storyIndex) b.classList.add('done');
      else if (i === this.storyIndex) {
        // restart animation
        const fill = b.querySelector('.fill');
        fill.style.transition = 'none';
        fill.style.width = '0';
        requestAnimationFrame(() => {
          b.classList.add('active');
          fill.style.transition = '';
        });
      }
    });

    document.querySelectorAll('.story-slide').forEach((s, i) => {
      s.classList.toggle('active', i === this.storyIndex);
    });

    this.storyTimer = setTimeout(() => this.nextStory(), 6000);
  },

  nextStory() {
    if (this.storyIndex < this.storyTotal - 1) {
      this.storyIndex++;
      this.startStoryTimer();
    } else {
      this.showApp();
    }
  },

  prevStory() {
    if (this.storyIndex > 0) {
      this.storyIndex--;
      this.startStoryTimer();
    }
  },

  bindStoryEvents() {
    document.getElementById('stories-prev').addEventListener('click', () => this.prevStory());
    document.getElementById('stories-next').addEventListener('click', () => this.nextStory());
    document.getElementById('stories-close').addEventListener('click', () => {
      if (this.storyTimer) clearTimeout(this.storyTimer);
      this.showApp();
    });
    document.getElementById('stories-to-home').addEventListener('click', () => {
      if (this.storyTimer) clearTimeout(this.storyTimer);
      this.showApp();
    });
  },

  // =============== APP ===============
  bindAppEvents() {
    // Bottom nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchPage(btn.dataset.page));
    });

    // Year switchers
    document.querySelectorAll('.year-btn').forEach(b => {
      b.addEventListener('click', () => {
        const dir = parseInt(b.dataset.dir);
        const target = b.dataset.target;
        if (target === 'fond') {
          this.currentFondYear += dir;
          this.renderFond();
        } else {
          this.currentOshYear += dir;
          this.renderOsh();
        }
      });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      if (confirm('Hisobdan chiqishni xohlaysizmi?')) {
        Storage.remove('current_user');
        this.currentUser = null;
        location.reload();
      }
    });

    // Yangilash (refresh) tugmasi — logout yonida
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    // Pastga tortib yangilash (pull-to-refresh)
    this.bindPullToRefresh();

    // Fond tabs
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const tabName = t.dataset.tab;
        document.querySelectorAll('.fond-tab').forEach(x => x.classList.remove('active'));
        document.getElementById('fond-' + tabName).classList.add('active');
      });
    });

    // To'yona search
    document.getElementById('toyona-search').addEventListener('input', (e) => {
      this.renderToyona(e.target.value);
    });

    // Header avatar click -> show profile
    document.getElementById('header-user').addEventListener('click', () => {
      if (this.currentUser) this.showMemberModal(this.currentUser.name);
    });
  },

  // =============== MA'LUMOTLARNI YANGILASH ===============
  // Tarmoqdan (Google Sheets) eng yangi ma'lumotni qayta yuklab, ekranni yangilaydi.
  // Ham "yangilash" tugmasi, ham pull-to-refresh shu funksiyani chaqiradi.
  async refreshData(opts = {}) {
    const { silent = false } = opts;
    if (this._refreshing) return;
    this._refreshing = true;

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.classList.add('spinning');

    try {
      const fresh = await DataService.refreshAll();
      // Bo'sh natija qaytsa (tarmoq uzilishi) eski ma'lumotni saqlab qolamiz
      const hasAny = fresh && (fresh.members.length || fresh.osh.length ||
        fresh.fond.length || fresh.toyona.length || fresh.news.length);
      if (hasAny) {
        this.data = fresh;
        // Joriy foydalanuvchini yangilangan ro'yxatdan qayta topamiz
        if (this.currentUser) {
          const me = DataService.findMember(this.data.members, this.currentUser.name);
          if (me) this.currentUser = me;
        }
        this.renderAll();
      }
      if (!silent) showToast('Yangilandi ✅', 'success');
    } catch (e) {
      console.error('refresh error', e);
      if (!silent) showToast('Yangilashda xato — internetni tekshiring', 'error');
    } finally {
      if (refreshBtn) {
        // Aylanish animatsiyasi biroz ko'rinib tursin
        setTimeout(() => refreshBtn.classList.remove('spinning'), 400);
      }
      this._refreshing = false;
    }
  },

  // =============== PULL TO REFRESH (pastga tortib yangilash) ===============
  bindPullToRefresh() {
    const appEl = document.getElementById('app');
    const indicator = document.getElementById('ptr-indicator');
    if (!appEl || !indicator) return;

    // Sezgirlikni kamaytirish uchun qiymatlar oshirildi:
    const ACTIVATE_DIST = 30;   // ko'rinishni boshlash uchun minimal masofa (px)
    const THRESHOLD = 110;      // shu masofadan ortiq tortilsa yangilanadi (oldin 75)
    const MAX_PULL = 150;       // indikatorning maksimal tushish masofasi
    const RESISTANCE = 0.35;    // qarshilik (kichikroq qiymat — sekinroq cho'ziladi, oldin 0.5)
    const MIN_COOLDOWN = 1500;  // yangilashlar orasidagi minimal pauza (ms)

    let startY = 0;
    let pulling = false;
    let activated = false;     // ACTIVATE_DIST oshib o'tganidan keyin true bo'ladi
    let distance = 0;
    let lastRefreshTs = 0;

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    appEl.addEventListener('touchstart', (e) => {
      if (this._refreshing) return;
      // Cooldown: oxirgi yangilashdan keyin biroz vaqt o'tmaguncha qayta ishga tushmasin
      if (Date.now() - lastRefreshTs < MIN_COOLDOWN) return;
      // Faqat bitta barmoq bilan va sahifa tepasida bo'lganda
      if (atTop() && e.touches.length === 1) {
        startY = e.touches[0].clientY;
        pulling = true;
        activated = false;
        distance = 0;
      } else {
        pulling = false;
      }
    }, { passive: true });

    appEl.addEventListener('touchmove', (e) => {
      if (!pulling || this._refreshing) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { // yuqoriga — odatiy skrol
        indicator.classList.remove('visible');
        distance = 0;
        activated = false;
        return;
      }
      // ACTIVATE_DIST oshmaguncha hech narsa ko'rsatmaymiz (tasodifiy tegishlardan himoya)
      if (dy < ACTIVATE_DIST) return;
      activated = true;
      // Qarshilik effekti (resistance) — cho'zilish sekinroq bo'lsin
      const effective = (dy - ACTIVATE_DIST) * RESISTANCE;
      distance = Math.min(MAX_PULL, effective);
      indicator.style.transform = `translateX(-50%) translateY(${distance}px)`;
      const ic = indicator.querySelector('.ptr-circle');
      if (ic) ic.style.transform = `rotate(${distance * 3}deg)`;
      indicator.classList.add('visible');
      indicator.classList.toggle('ready', distance >= THRESHOLD);
    }, { passive: true });

    const endPull = async () => {
      if (!pulling) return;
      pulling = false;
      // Faqat indikator ko'rinib turgan va threshold oshgan bo'lsa yangilash
      const willRefresh = activated && distance >= THRESHOLD;
      activated = false;
      if (willRefresh) {
        indicator.classList.add('loading');
        indicator.style.transform = `translateX(-50%) translateY(60px)`;
        lastRefreshTs = Date.now();
        await this.refreshData({ silent: true });
        lastRefreshTs = Date.now();
        showToast('Yangilandi ✅', 'success');
      }
      // Indikatorni qaytarib yashiramiz
      indicator.classList.remove('visible', 'ready', 'loading');
      indicator.style.transform = 'translateX(-50%) translateY(0)';
      distance = 0;
    };

    appEl.addEventListener('touchend', endPull, { passive: true });
    appEl.addEventListener('touchcancel', endPull, { passive: true });
  },

  switchPage(name, opts = {}) {
    const { fromPop = false, replace = false } = opts;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + name);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.page === name);
    });
    window.scrollTo(0, 0);
    this.currentPage = name;

    // History bilan ishlash — brauzerning orqaga tugmasi sahifalar orasida «orqaga» yursin
    if (!fromPop) {
      const state = { app: 'jamoa', type: 'page', page: name };
      try {
        if (replace || !this._historyInit) {
          history.replaceState(state, '', '#' + name);
          this._historyInit = true;
        } else {
          history.pushState(state, '', '#' + name);
        }
      } catch (e) { /* ignore */ }
    }
  },

  // Modalkalarni history bilan ochish/yopish
  openModalWithHistory(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    try {
      history.pushState({ app: 'jamoa', type: 'modal', id }, '', '#modal-' + id);
    } catch (e) {}
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  },

  // popstate — brauzerning orqaga tugmasi bosilganda
  handlePopState(ev) {
    const state = ev.state;

    // Agar modal ochiq boʻlsa — avval uni yopamiz
    const openModal = document.querySelector('.modal:not(.hidden)');
    if (openModal) {
      openModal.classList.add('hidden');
      return;
    }

    // Agar splash-stories ochiq boʻlsa — toʻgʻri ilovaga oʻtamiz
    const stories = document.getElementById('splash-stories');
    if (stories && !stories.classList.contains('hidden')) {
      if (this.storyTimer) clearTimeout(this.storyTimer);
      this.showApp();
      return;
    }

    // Asosiy ilovada — sahifani almashtiramiz
    if (state && state.type === 'page' && state.page) {
      this.switchPage(state.page, { fromPop: true });
    } else if (this.currentPage && this.currentPage !== 'home') {
      // Hech qanday state boʻlmasa — "home" ga qaytamiz
      this.switchPage('home', { fromPop: true, replace: true });
      // Ilovadan chiqib ketmaslik uchun yana bitta yozuv qoʻshamiz
      try { history.pushState({ app: 'jamoa', type: 'page', page: 'home' }, '', '#home'); } catch (e) {}
    } else {
      // home sahifada — ilovadan chiqib ketmaslik uchun history ga yana yozuv qoʻshamiz
      try { history.pushState({ app: 'jamoa', type: 'page', page: 'home' }, '', '#home'); } catch (e) {}
    }
  },

  // =============== RENDER ALL ===============
  renderAll() {
    this.renderHeader();
    this.renderHome();
    this.renderOsh();
    this.renderFond();
    this.renderToyona();
    this.renderNews();
  },

  renderHeader() {
    document.getElementById('header-name').textContent = this.currentUser.name;
    const avatar = document.getElementById('header-avatar');
    if (this.currentUser.image) {
      avatar.src = this.currentUser.image;
      avatar.onerror = () => {
        avatar.outerHTML = `<div class="member-avatar" style="width:40px;height:40px;border:2px solid var(--accent)">${getInitials(this.currentUser.name)}</div>`;
      };
    } else {
      avatar.outerHTML = `<div class="member-avatar" id="header-avatar" style="width:40px;height:40px;border:2px solid var(--accent)">${getInitials(this.currentUser.name)}</div>`;
    }
  },

  // =============== HOME ===============
  renderHome() {
    document.getElementById('welcome-text').textContent =
      `Salom, ${this.currentUser.name}. Bugun ${new Date().toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    // Stats
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = CONFIG.MONTHS[now.getMonth()];

    document.getElementById('stat-members').textContent = this.data.members.length;

    const curMonthIdxH = monthIndex(curMonth);
    const monthFond = this.data.fond
      .filter(f => f.year === curYear && monthIndex(f.month) === curMonthIdxH)
      .reduce((s, f) => s + f.amount, 0);
    document.getElementById('stat-fund').textContent = shortMoney(monthFond);

    const oshThis = this.data.osh.find(o =>
      o.year === curYear && monthIndex(o.month) === curMonthIdxH
    );
    document.getElementById('stat-osh').textContent = oshThis ? oshThis.member.split(' ')[0] : '—';

    // Yaqin tug'ilgan kun
    const upcoming = this.data.members
      .map(m => ({ ...m, _bdate: parseDate(m.birthday) }))
      .filter(m => m._bdate)
      .map(m => ({ ...m, _days: daysUntilBirthday(m._bdate) }))
      .sort((a,b) => a._days - b._days);

    document.getElementById('stat-bday').textContent =
      upcoming[0] ? upcoming[0].name.split(' ')[0] : '—';

    // News
    const newsBox = document.getElementById('home-news');
    if (this.data.news.length === 0) {
      newsBox.innerHTML = `<div class="empty-state"><div class="emoji">📭</div><p>Yangiliklar yoʻq</p></div>`;
    } else {
      newsBox.innerHTML = this.data.news.slice(0, 3).map((n, i) => `
        <div class="news-card" data-idx="${i}">
          ${n.image ? `<img src="${escapeAttr(n.image)}" onerror="this.style.display='none'"/>` : ''}
          <div class="news-body">
            <h4>${escapeHTML(n.title)}</h4>
            <p>${escapeHTML(n.content)}</p>
          </div>
        </div>
      `).join('');
    }

    // Birthdays
    const bdayBox = document.getElementById('home-bdays');
    const upcomingTop = upcoming.slice(0, 5);
    if (upcomingTop.length === 0) {
      bdayBox.innerHTML = `<div class="empty-state"><p>Maʼlumot yoʻq</p></div>`;
    } else {
      bdayBox.innerHTML = upcomingTop.map(m => `
        <div class="bday-card" data-name="${escapeAttr(m.name)}">
          ${avatarHTML(m.name, m.image)}
          <div class="info">
            <strong>${escapeHTML(m.name)}</strong>
            <span>${escapeHTML(m.birthday)} • ${calcAge(m._bdate) + (m._days > 0 ? 1 : 0)} yoshda</span>
          </div>
          <div class="days">${m._days === 0 ? 'Bugun!' : m._days + ' kun'}</div>
        </div>
      `).join('');
      bdayBox.querySelectorAll('.bday-card').forEach(c => {
        c.addEventListener('click', () => this.showMemberModal(c.dataset.name));
      });
    }
  },

  // =============== OSH ===============
  renderOsh() {
    document.getElementById('osh-year').textContent = this.currentOshYear;
    document.getElementById('osh-year-2').textContent = this.currentOshYear;

    const yearOsh = this.data.osh.filter(o => o.year === this.currentOshYear);
    const now = new Date();
    const curMonth = CONFIG.MONTHS[now.getMonth()];
    const curYear = now.getFullYear();

    const list = document.getElementById('osh-list');
    if (yearOsh.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="emoji">📅</div><p>Bu yilda osh navbati maʼlumotlari yoʻq</p></div>`;
      return;
    }

    // Oyga ko'ra tartiblash (variant imlolarni qoʻllab-quvvatlaydi)
    const sorted = yearOsh.slice().sort((a, b) => {
      const ai = monthIndex(a.month);
      const bi = monthIndex(b.month);
      // Topilmaganlarni oxiriga emas, balki o'rniga qo'ymaslik uchun — oxiriga surish
      const av = ai < 0 ? 999 : ai;
      const bv = bi < 0 ? 999 : bi;
      return av - bv;
    });

    list.innerHTML = sorted.map(o => {
      const monthIdx = monthIndex(o.month);
      const m = DataService.findMember(this.data.members, o.member);
      const curMonthIdx = monthIndex(curMonth);
      const oMonthIdx = monthIndex(o.month);
      const isCurrent = (this.currentOshYear === curYear && oMonthIdx === curMonthIdx && oMonthIdx >= 0);
      // Badge: sariq kvadrat o'rniga osh qiluvchi a'zoning DUMALOQ rasmi.
      // Agar rasm bo'lmasa — ismning bosh harflari ko'rsatiladi.
      const fullMonth = monthIdx >= 0 ? CONFIG.MONTHS[monthIdx] : o.month;
      const badgeHTML = (m && m.image)
        ? `<img src="${escapeAttr(m.image)}" alt="${escapeAttr(o.member)}" onerror="this.outerHTML='<div class=\\'osh-month-badge-fallback\\'>${escapeAttr(getInitials(o.member))}</div>'"/>`
        : `<div class="osh-month-badge-fallback">${escapeHTML(getInitials(o.member))}</div>`;
      return `
        <div class="osh-card ${isCurrent ? 'current' : ''}" data-name="${escapeAttr(o.member)}">
          <div class="osh-month-badge" title="${escapeAttr(fullMonth)}">
            ${badgeHTML}
          </div>
          <div class="info">
            <div class="month">${escapeHTML(o.month)} ${isCurrent ? '• Joriy' : ''}</div>
            <div class="who">
              ${escapeHTML(o.member)}
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.osh-card').forEach(c => {
      c.addEventListener('click', () => this.showMemberModal(c.dataset.name));
    });
  },

  // =============== FOND ===============
  renderFond() {
    document.getElementById('fond-year').textContent = this.currentFondYear;

    const yearFond = this.data.fond.filter(f => f.year === this.currentFondYear);
    const total = yearFond.reduce((s, f) => s + f.amount, 0);
    document.getElementById('fond-total').textContent = formatMoney(total);

    // Months horizontal scroll
    const monthsBox = document.getElementById('fond-months');
    const now = new Date();
    monthsBox.innerHTML = CONFIG.MONTHS.map((m, i) => {
      const monthData = yearFond.filter(f => monthIndex(f.month) === i);
      const sum = monthData.reduce((s, x) => s + x.amount, 0);
      const isCurrent = (this.currentFondYear === now.getFullYear() && i === now.getMonth());
      return `
        <div class="month-card ${isCurrent ? 'current' : ''}" data-month="${escapeAttr(m)}">
          <div class="m-name">${m}</div>
          <div class="m-sum">${shortMoney(sum)}</div>
          <div class="m-count">${monthData.length} kishi</div>
        </div>
      `;
    }).join('');
    monthsBox.querySelectorAll('.month-card').forEach(c => {
      c.addEventListener('click', () => this.showMonthDetail(c.dataset.month));
    });

    // Members
    const membersBox = document.getElementById('fond-members');
    const memberTotals = {};
    yearFond.forEach(f => {
      const key = f.member;
      memberTotals[key] = (memberTotals[key] || 0) + f.amount;
    });
    const memberList = Object.entries(memberTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amt]) => {
        const m = DataService.findMember(this.data.members, name);
        return `
          <div class="fond-member-card" data-name="${escapeAttr(name)}">
            ${avatarHTML(name, m ? m.image : '')}
            <div class="info">
              <strong>${escapeHTML(name)}</strong>
              <span>${this.currentFondYear} yil</span>
            </div>
            <div class="amount">${formatMoney(amt)}</div>
          </div>
        `;
      }).join('');

    membersBox.innerHTML = memberList || `<div class="empty-state"><p>Maʼlumot yoʻq</p></div>`;
    membersBox.querySelectorAll('.fond-member-card').forEach(c => {
      c.addEventListener('click', () => this.showMemberModal(c.dataset.name));
    });

    // Mening hisobim
    const meBox = document.getElementById('fond-me-list');
    const myPayments = yearFond.filter(f => f.member.toLowerCase() === this.currentUser.name.toLowerCase());
    const monthlyMine = {};
    myPayments.forEach(p => {
      const idx = monthIndex(p.month);
      if (idx >= 0) monthlyMine[idx] = (monthlyMine[idx] || 0) + p.amount;
    });
    meBox.innerHTML = CONFIG.MONTHS.map((m, i) => {
      const isPaid = monthlyMine[i] > 0;
      const isPast = (this.currentFondYear < now.getFullYear()) ||
                     (this.currentFondYear === now.getFullYear() && i <= now.getMonth());
      return `
        <div class="fond-me-item ${isPaid ? 'paid' : (isPast ? 'unpaid' : '')}">
          <span class="m">${m}</span>
          <span class="v ${isPaid ? 'paid' : (isPast ? 'unpaid' : '')}">
            ${isPaid ? '✓ ' + formatMoney(monthlyMine[i]) : (isPast ? '✗ Toʻlanmagan' : '—')}
          </span>
        </div>
      `;
    }).join('');
  },

  showMonthDetail(monthName) {
    const targetIdx = monthIndex(monthName);
    const yearFond = this.data.fond.filter(f =>
      f.year === this.currentFondYear && monthIndex(f.month) === targetIdx
    );
    const total = yearFond.reduce((s, f) => s + f.amount, 0);

    const body = document.getElementById('member-modal-body');
    body.innerHTML = `
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:48px;margin-bottom:8px">📅</div>
        <h2 class="mm-name">${escapeHTML(monthName)} ${this.currentFondYear}</h2>
        <p class="mm-info">Oylik toʻlovlar</p>
      </div>
      <div class="mm-stat-row">
        <div class="mm-stat">
          <div class="lbl">Jami</div>
          <div class="val green">${formatMoney(total)}</div>
        </div>
        <div class="mm-stat">
          <div class="lbl">Toʻlaganlar</div>
          <div class="val">${yearFond.length} kishi</div>
        </div>
      </div>
      <div class="mm-section">
        <h4>Toʻlaganlar roʻyxati</h4>
        <div class="fond-members" style="margin-top:8px">
          ${yearFond.map(f => {
            const m = DataService.findMember(this.data.members, f.member);
            return `
              <div class="fond-member-card" data-name="${escapeAttr(f.member)}">
                ${avatarHTML(f.member, m ? m.image : '')}
                <div class="info">
                  <strong>${escapeHTML(f.member)}</strong>
                  <span>${escapeHTML(monthName)}</span>
                </div>
                <div class="amount">${formatMoney(f.amount)}</div>
              </div>
            `;
          }).join('') || '<p style="text-align:center;color:var(--muted);padding:20px">Hech kim toʻlamagan</p>'}
        </div>
      </div>
    `;
    document.getElementById('member-modal').classList.remove('hidden');
    try { history.pushState({ app: 'jamoa', type: 'modal', id: 'member-modal' }, '', '#month-detail'); } catch (e) {}
    body.querySelectorAll('.fond-member-card').forEach(c => {
      c.addEventListener('click', () => this.showMemberModal(c.dataset.name));
    });
  },

  // =============== TO'YONA ===============
  // To'yonalar bo'yma-bo'y matn ko'rinishida ko'rsatiladi.
  // Kirituvchi pul (so'm/dollar) yoki kg go'sht yozishi mumkin, shuning uchun
  // umumiy summa hisoblanmaydi — shunchaki matn qatorlari namoyish etiladi.
  renderToyona(filter = '') {
    const f = filter.toLowerCase().trim();
    const items = this.data.toyona.filter(t => !f || t.owner.toLowerCase().includes(f));
    const box = document.getElementById('toyona-list');
    if (items.length === 0) {
      box.innerHTML = `<div class="empty-state"><div class="emoji">🎁</div><p>Maʼlumot topilmadi</p></div>`;
      return;
    }
    box.innerHTML = items.map(t => {
      const owner = DataService.findMember(this.data.members, t.owner);
      return `
        <div class="toyona-card">
          <div class="toyona-card-header" data-name="${escapeAttr(t.owner)}">
            ${avatarHTML(t.owner, owner ? owner.image : '')}
            <div class="info">
              <strong>${escapeHTML(t.owner)}</strong>
              <span>${t.lines.length} ta yozuv</span>
            </div>
          </div>
          <div class="toyona-lines">
            ${t.lines.map(line => `<div class="toyona-line">${escapeHTML(line)}</div>`).join('')}
          </div>
        </div>
      `;
    }).join('');
    // Click delegate — faqat owner avatariga
    box.querySelectorAll('.toyona-card-header').forEach(h => {
      h.addEventListener('click', () => this.showMemberModal(h.dataset.name));
    });
  },

  // =============== NEWS ===============
  renderNews() {
    const box = document.getElementById('news-list');
    if (this.data.news.length === 0) {
      box.innerHTML = `<div class="empty-state"><div class="emoji">📭</div><p>Yangiliklar yoʻq</p></div>`;
      return;
    }
    box.innerHTML = this.data.news.map(n => `
      <div class="news-card">
        ${n.image ? `<img src="${escapeAttr(n.image)}" onerror="this.style.display='none'"/>` : ''}
        <div class="news-body">
          <h4>${escapeHTML(n.title)}</h4>
          <p style="-webkit-line-clamp:unset;line-clamp:unset;display:block">${escapeHTML(n.content)}</p>
        </div>
      </div>
    `).join('');
  },

  // =============== MEMBER MODAL ===============
  showMemberModal(name) {
    const m = DataService.findMember(this.data.members, name);
    if (!m) {
      showToast(`"${name}" topilmadi`, 'error');
      return;
    }
    // Modalka history-da qayd etilsin (orqaga tugmasi uni yopadi)
    try { history.pushState({ app: 'jamoa', type: 'modal', id: 'member-modal' }, '', '#member'); } catch (e) {}
    const bdate = parseDate(m.birthday);
    const age = bdate ? calcAge(bdate) : null;
    const daysUntil = bdate ? daysUntilBirthday(bdate) : null;

    // Bu yil fond holati
    const curYear = this.currentFondYear;
    const myFond = this.data.fond.filter(f =>
      f.year === curYear && f.member.toLowerCase() === m.name.toLowerCase()
    );
    const monthlyData = {};
    myFond.forEach(p => {
      const idx = monthIndex(p.month);
      if (idx >= 0) monthlyData[idx] = (monthlyData[idx] || 0) + p.amount;
    });
    const totalFond = myFond.reduce((s, x) => s + x.amount, 0);

    // Osh navbati
    const myOsh = this.data.osh.filter(o =>
      o.member.toLowerCase() === m.name.toLowerCase()
    );

    // To'yona olgan (a'zoga qilingan to'yonalar matni) — ismni ANIQ moslikda topamiz,
    // shunda "Akmal" va "Akmaljon" bir-birining ro'yxatini ko'rmaydi.
    const memberNameLow = m.name.toLowerCase().trim();
    const receivedToyona = this.data.toyona.find(t => t.owner.toLowerCase().trim() === memberNameLow);
    // "To'yona bergan" ro'yxati foydalanuvchi talabiga ko'ra OLIB TASHLANDI —
    // chunki matn ichidan ism qidirish "Akmal" va "Akmaljon"ni adashtirib yuborardi.

    const body = document.getElementById('member-modal-body');
    body.innerHTML = `
      <div>
        ${m.image
          ? `<img src="${escapeAttr(m.image)}" class="mm-avatar" onerror="this.outerHTML='<div class=\\'member-avatar mm-avatar\\'>${escapeAttr(getInitials(m.name))}</div>'"/>`
          : `<div class="member-avatar mm-avatar">${escapeHTML(getInitials(m.name))}</div>`
        }
        <h2 class="mm-name">${escapeHTML(m.name)}</h2>
        ${m.birthday ? `<div class="mm-info">🎂 ${escapeHTML(m.birthday)}${age ? ` • ${age} yosh` : ''}</div>` : ''}
        ${m.phone ? `<div class="mm-info">📱 <a href="tel:${escapeAttr(m.phone)}" style="color:var(--accent);text-decoration:none">${escapeHTML(m.phone)}</a></div>` : ''}
        ${daysUntil != null && daysUntil <= 60 ? `<div style="margin-top:10px"><span class="days" style="background:var(--orange);color:white;padding:6px 14px;border-radius:100px;font-size:12px;font-weight:600">🎂 ${daysUntil === 0 ? 'Bugun tugʻilgan kun!' : daysUntil + ' kun qoldi'}</span></div>` : ''}
      </div>

      <div class="mm-stat-row" style="margin-top:24px">
        <div class="mm-stat">
          <div class="lbl">${curYear} fondi</div>
          <div class="val green">${shortMoney(totalFond)}</div>
        </div>
        <div class="mm-stat">
          <div class="lbl">Osh navbati</div>
          <div class="val orange">${myOsh.length}</div>
        </div>
      </div>

      <div class="mm-section">
        <h4>💰 ${curYear} Fond holati</h4>
        <div class="mm-months-grid">
          ${CONFIG.MONTHS.map((mname, i) => {
            const isPaid = monthlyData[i] > 0;
            return `
              <div class="mm-month-cell ${isPaid ? 'paid' : ''}">
                <div class="mname">${CONFIG.MONTHS_SHORT[i]}</div>
                <div class="mval">${isPaid ? shortMoney(monthlyData[i]) : '—'}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      ${myOsh.length > 0 ? `
        <div class="mm-section">
          <h4>🍲 Osh navbatlari</h4>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${myOsh.map(o => `
              <span style="background:var(--bg-soft);padding:8px 14px;border-radius:100px;font-size:13px;border:1px solid var(--border)">
                ${escapeHTML(o.month)} ${o.year}
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${receivedToyona ? `
        <div class="mm-section">
          <h4>🎁 Toʻyona olgan</h4>
          <div style="background:var(--bg-soft);padding:14px;border-radius:12px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--muted);font-size:13px">Jami yozuvlar</span>
              <strong>${receivedToyona.lines.length} ta</strong>
            </div>
          </div>
          <div class="toyona-lines" style="background:var(--bg-soft);border-radius:12px;padding:8px">
            ${receivedToyona.lines.map(line => `<div class="toyona-line">${escapeHTML(line)}</div>`).join('')}
          </div>
        </div>
      ` : ''}

    `;
    document.getElementById('member-modal').classList.remove('hidden');
  }
};

// =============== START ===============
document.addEventListener('DOMContentLoaded', () => {
  App.bindLoginEvents();
  App.bindStoryEvents();
  App.bindAppEvents();

  // Brauzerning «Orqaga» tugmasi — sahifalar va modalkalarni boshqaradi
  window.addEventListener('popstate', (ev) => App.handlePopState(ev));

  App.init();
});
