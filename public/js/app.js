import { initDragonScene } from '/js/dragon3d.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined && text !== null) {
    node.textContent = String(text);
  }
  return node;
}

function renderStateBox(container, { title, detail, isError = false, retryLabel, onRetry }) {
  container.replaceChildren();
  const box = el('div', isError ? 'state-box feedback-error' : 'state-box');
  if (isError) {
    box.setAttribute('role', 'alert');
  }
  box.appendChild(el('p', 'state-title', title));
  box.appendChild(el('p', 'state-detail', detail));

  if (retryLabel && typeof onRetry === 'function') {
    const retryBtn = el('button', 'btn btn-secondary', retryLabel);
    retryBtn.type = 'button';
    retryBtn.addEventListener('click', onRetry);
    box.appendChild(retryBtn);
  }

  container.appendChild(box);
}

function renderProjects(container, projects, onInspectDomain) {
  container.replaceChildren();
  if (!projects || projects.length === 0) {
    renderStateBox(container, {
      title: 'Belum ada proyek terpublikasi',
      detail: 'Data proyek di Supabase saat ini masih kosong.'
    });
    return;
  }

  projects.forEach((project, idx) => {
    const row = el('article', 'project-row');

    const num = el('div', 'project-num', String(idx + 1).padStart(2, '0'));
    row.appendChild(num);

    const metaCol = el('div', 'project-meta-col');
    metaCol.appendChild(el('h3', '', project.name));
    metaCol.appendChild(el('span', 'project-domain', project.domain));
    metaCol.appendChild(el('span', 'project-role', project.role_label || 'Developer'));
    row.appendChild(metaCol);

    const detailCol = el('div', 'project-detail-col');
    detailCol.appendChild(el('p', 'project-summary', project.summary));

    if (Array.isArray(project.stack) && project.stack.length > 0) {
      const stackList = el('ul', 'stack-list');
      project.stack.forEach((item) => {
        stackList.appendChild(el('li', 'stack-item', item));
      });
      detailCol.appendChild(stackList);
    }

    const actions = el('div', 'project-actions');
    const visitLink = el('a', 'btn btn-secondary', 'Buka situs');
    visitLink.href = project.url;
    visitLink.target = '_blank';
    visitLink.rel = 'noopener noreferrer';
    actions.appendChild(visitLink);

    const scanBtn = el('button', 'btn btn-ghost', 'Cek header keamanan');
    scanBtn.type = 'button';
    scanBtn.addEventListener('click', () => onInspectDomain(project.domain));
    actions.appendChild(scanBtn);

    detailCol.appendChild(actions);
    row.appendChild(detailCol);
    container.appendChild(row);
  });
}

function renderAchievements(container, achievements) {
  container.replaceChildren();
  if (!achievements || achievements.length === 0) {
    renderStateBox(container, {
      title: 'Belum ada catatan prestasi',
      detail: 'Data prestasi di Supabase saat ini belum tersedia.'
    });
    return;
  }

  achievements.forEach((item) => {
    const card = el('article', 'achievement-item');
    card.appendChild(el('p', 'achievement-rank', item.rank_label));
    card.appendChild(el('h3', '', item.title));
    const categoryText = item.year ? `${item.category}, ${item.year}` : item.category;
    card.appendChild(el('p', 'achievement-category', categoryText));
    container.appendChild(card);
  });
}

function renderScanHistory(container, scans) {
  container.replaceChildren();
  if (!scans || scans.length === 0) {
    container.appendChild(
      el('p', 'state-detail', 'Belum ada riwayat pemindaian tersimpan di Supabase.')
    );
    return;
  }

  scans.forEach((scan) => {
    const row = el('div', 'history-row');
    row.appendChild(el('span', 'history-domain', scan.domain));
    row.appendChild(
      el(
        'span',
        'history-meta',
        `Nilai ${scan.score}/100 (${scan.grade}) | ${scan.present_count}/${scan.total_checks}`
      )
    );
    container.appendChild(row);
  });
}

function renderSecurityReport(container, report) {
  container.replaceChildren();

  const summary = el('div', 'scan-summary');
  const titleWrap = el('div');
  titleWrap.appendChild(el('h3', '', report.domain));
  titleWrap.appendChild(
    el(
      'p',
      'state-detail',
      `Status HTTP ${report.statusCode} | ${report.presentCount} dari ${report.totalChecks} header aktif${report.savedToSupabase ? ' | Tercatat di Supabase' : ''}`
    )
  );
  summary.appendChild(titleWrap);

  const scoreWrap = el('div', 'scan-score-block');
  scoreWrap.appendChild(el('span', 'scan-score', `${report.score}/100`));

  const gradeClass =
    report.grade === 'A'
      ? 'grade-tag grade-good'
      : report.grade === 'B' || report.grade === 'C'
        ? 'grade-tag grade-warn'
        : 'grade-tag grade-danger';
  scoreWrap.appendChild(el('span', gradeClass, `Grade ${report.grade}`));
  summary.appendChild(scoreWrap);
  container.appendChild(summary);

  const list = el('ul', 'header-check-list');
  (report.headers || []).forEach((item) => {
    const li = el('li', 'header-check-item');

    const top = el('div', 'header-check-top');
    top.appendChild(el('span', 'header-name', item.label));

    const badge = el(
      'span',
      item.present ? 'status-label status-good' : 'status-label status-danger',
      `${item.statusLabel} (${item.earned}/${item.weight})`
    );
    top.appendChild(badge);
    li.appendChild(top);

    if (item.present && item.value) {
      li.appendChild(el('p', 'header-value', item.value));
    } else if (item.recommendation) {
      li.appendChild(el('p', 'header-rec', item.recommendation));
    }

    list.appendChild(li);
  });
  container.appendChild(list);
}

function setupMobileNavigation() {
  const toggleBtn = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (!toggleBtn || !mobileNav) {
    return;
  }

  const closeMenu = (restoreFocus = false) => {
    toggleBtn.setAttribute('aria-expanded', 'false');
    mobileNav.hidden = true;
    if (restoreFocus) {
      toggleBtn.focus();
    }
  };

  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      closeMenu(false);
    } else {
      toggleBtn.setAttribute('aria-expanded', 'true');
      mobileNav.hidden = false;
    }
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMenu(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggleBtn.getAttribute('aria-expanded') === 'true') {
      closeMenu(true);
    }
  });
}

function setupApp() {
  setupMobileNavigation();

  initDragonScene({
    canvas: document.getElementById('dragon-canvas'),
    fallbackImg: document.getElementById('dragon-fallback'),
    motionToggleBtn: document.getElementById('motion-toggle')
  });

  const proyekContainer = document.getElementById('proyek-container');
  const prestasiContainer = document.getElementById('prestasi-container');
  const historyContainer = document.getElementById('riwayat-scan');
  const healthStatusEl = document.getElementById('api-health-status');
  const domainInput = document.getElementById('domain-input');
  const securityForm = document.getElementById('security-form');
  const scanSubmitBtn = document.getElementById('scan-submit');
  const scanResultEl = document.getElementById('scan-result');
  const selfScanBtn = document.getElementById('scan-self-btn');

  async function refreshHistoryOnly() {
    try {
      const res = await fetch('/api/security_check');
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error('Gagal memuat riwayat.');
      }
      if (data.source === 'unavailable') {
        historyContainer.replaceChildren(
          el('p', 'state-detail', 'Riwayat pemindaian menunggu koneksi Supabase aktif.')
        );
        return;
      }
      renderScanHistory(historyContainer, data.scans);
    } catch {
      historyContainer.replaceChildren(
        el('p', 'state-detail', 'Riwayat pemindaian gagal dimuat dari server Python.')
      );
    }
  }

  async function runSecurityInspection(rawDomain) {
    const trimmed = (rawDomain || '').trim();
    if (!trimmed) {
      renderStateBox(scanResultEl, {
        title: 'Domain belum diisi',
        detail: 'Masukkan nama domain HTTPS publik, misalnya remover.id.',
        isError: true
      });
      domainInput.focus();
      return;
    }

    domainInput.value = trimmed;
    scanSubmitBtn.disabled = true;
    scanSubmitBtn.textContent = 'Memeriksa header...';

    renderStateBox(scanResultEl, {
      title: `Memeriksa ${trimmed}...`,
      detail: 'Backend Python sedang melakukan resolusi DNS aman dan inspeksi header HTTPS.'
    });

    try {
      const res = await fetch('/api/security_check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: trimmed })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        renderStateBox(scanResultEl, {
          title: 'Inspeksi tidak dapat dilanjutkan',
          detail: data.error || 'Terjadi kesalahan saat memeriksa header domain tersebut.',
          isError: true
        });
        return;
      }

      renderSecurityReport(scanResultEl, data);
      refreshHistoryOnly();
    } catch {
      renderStateBox(scanResultEl, {
        title: 'Koneksi ke server Python gagal',
        detail: 'Periksa jaringan Anda lalu coba kirim permintaan audit kembali.',
        isError: true
      });
    } finally {
      scanSubmitBtn.disabled = false;
      scanSubmitBtn.textContent = 'Periksa header';
    }
  }

  const jumpAndInspect = (domain) => {
    document.getElementById('lab-keamanan')?.scrollIntoView({ behavior: 'smooth' });
    runSecurityInspection(domain);
  };

  async function loadPortfolioData() {
    renderStateBox(proyekContainer, {
      title: 'Memuat data proyek...',
      detail: 'Menghubungi layanan portofolio di server.'
    });
    renderStateBox(prestasiContainer, {
      title: 'Memuat daftar prestasi...',
      detail: 'Mengambil rekaman prestasi terverifikasi dari Supabase.'
    });

    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();

      if (!res.ok || !data.ok) {
        const reason = data.error || 'Layanan portofolio Supabase belum tersedia.';
        renderStateBox(proyekContainer, {
          title: 'Data proyek belum tersedia',
          detail: reason,
          isError: true,
          retryLabel: 'Muat ulang data',
          onRetry: loadPortfolioData
        });
        renderStateBox(prestasiContainer, {
          title: 'Data prestasi belum tersedia',
          detail: reason,
          isError: true,
          retryLabel: 'Muat ulang data',
          onRetry: loadPortfolioData
        });
        refreshHistoryOnly();
        return;
      }

      renderProjects(proyekContainer, data.projects, jumpAndInspect);
      renderAchievements(prestasiContainer, data.achievements);
      renderScanHistory(historyContainer, data.recentScans);
    } catch {
      const msg = 'Gagal terhubung ke API portofolio (/api/portfolio).';
      renderStateBox(proyekContainer, {
        title: 'Koneksi gagal',
        detail: msg,
        isError: true,
        retryLabel: 'Coba lagi',
        onRetry: loadPortfolioData
      });
      renderStateBox(prestasiContainer, {
        title: 'Koneksi gagal',
        detail: msg,
        isError: true,
        retryLabel: 'Coba lagi',
        onRetry: loadPortfolioData
      });
    }
  }

  async function loadHealthStatus() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (res.ok && data.ok) {
        healthStatusEl.textContent = data.supabaseConfigured
          ? 'API Node.js + Python aktif | Supabase terhubung'
          : 'API Node.js + Python aktif | Supabase belum terkonfigurasi';
      } else {
        healthStatusEl.textContent = 'Status API tidak merespons normal';
      }
    } catch {
      healthStatusEl.textContent = 'Status API tidak terjangkau';
    }
  }

  securityForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    runSecurityInspection(domainInput.value);
  });

  document.querySelectorAll('.btn-chip[data-domain]').forEach((btn) => {
    btn.addEventListener('click', () => {
      runSecurityInspection(btn.getAttribute('data-domain'));
    });
  });

  selfScanBtn?.addEventListener('click', () => {
    const currentHost = window.location.hostname;
    if (currentHost === '127.0.0.1' || currentHost === 'localhost') {
      renderStateBox(scanResultEl, {
        title: 'Domain lokal tidak diaudit',
        detail:
          'Demi proteksi anti-SSRF, host lokal seperti 127.0.0.1 atau localhost diblokir. Gunakan tombol remover.id, aureonmind.vercel.app, atau uji situs ini setelah terbit di URL publik Vercel.',
        isError: true
      });
      return;
    }
    runSecurityInspection(currentHost);
  });

  const contactForm = document.getElementById('contact-form');
  const contactSubmitBtn = document.getElementById('contact-submit');
  const contactFeedback = document.getElementById('contact-feedback');

  const showContactFeedback = (message, isError = false) => {
    contactFeedback.replaceChildren();
    const banner = el(
      'div',
      isError ? 'feedback-banner feedback-error' : 'feedback-banner feedback-success',
      message
    );
    banner.setAttribute('role', isError ? 'alert' : 'status');
    contactFeedback.appendChild(banner);
  };

  contactForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const message = document.getElementById('contact-message').value.trim();
    const website = document.getElementById('contact-website').value.trim();

    if (name.length < 2) {
      showContactFeedback('Nama lengkap minimal 2 karakter.', true);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showContactFeedback('Masukkan alamat email yang valid.', true);
      return;
    }
    if (message.length < 10) {
      showContactFeedback('Pesan minimal 10 karakter agar jelas dibaca.', true);
      return;
    }

    contactSubmitBtn.disabled = true;
    contactSubmitBtn.textContent = 'Mengirim pesan...';
    contactFeedback.replaceChildren();

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, website })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showContactFeedback(data.error || 'Pesan gagal dikirim. Silakan periksa kembali isian Anda.', true);
        return;
      }

      contactForm.reset();
      showContactFeedback(
        `${data.message}${data.id ? ` (ID arsip: ${String(data.id).slice(0, 8)})` : ''}`,
        false
      );
    } catch {
      showContactFeedback('Gagal menghubungi server kontak. Coba beberapa saat lagi.', true);
    } finally {
      contactSubmitBtn.disabled = false;
      contactSubmitBtn.textContent = 'Kirim pesan';
    }
  });

  loadPortfolioData();
  loadHealthStatus();
}

setupApp();
