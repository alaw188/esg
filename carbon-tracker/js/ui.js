/** UI 渲染與互動 */

const UI = {
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  },

  el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v);
    });
    children.forEach((c) => {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  },

  showModal(html, onClose) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = html;
    overlay.classList.remove('hidden');
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
        onClose?.();
      }
    };
    content.querySelector('[data-close]')?.addEventListener('click', () => {
      overlay.classList.add('hidden');
      onClose?.();
    });
  },

  hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  renderStatCard(label, value, sub, accent) {
    return `<div class="stat-card ${accent || ''}">
      <span class="stat-label">${this.esc(label)}</span>
      <span class="stat-value">${value}</span>
      ${sub ? `<span class="stat-sub">${this.esc(sub)}</span>` : ''}
    </div>`;
  },

  renderDonut(scope1Pct, scope2Pct, total) {
    const s1 = scope1Pct || 0;
    const s2 = scope2Pct || 0;
    const circumference = 2 * Math.PI * 54;
    const s1Len = (s1 / 100) * circumference;
    const s2Len = (s2 / 100) * circumference;

    return `<div class="donut-wrap">
      <svg viewBox="0 0 120 120" class="donut">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#e8edf2" stroke-width="12"/>
        <circle cx="60" cy="60" r="54" fill="none" stroke="#2d6a4f" stroke-width="12"
          stroke-dasharray="${s1Len} ${circumference}" stroke-dashoffset="0" transform="rotate(-90 60 60)"/>
        <circle cx="60" cy="60" r="54" fill="none" stroke="#40916c" stroke-width="12"
          stroke-dasharray="${s2Len} ${circumference}" stroke-dashoffset="${-s1Len}" transform="rotate(-90 60 60)"/>
      </svg>
      <div class="donut-center">
        <strong>${Calculator.formatTonnes(total, 1)}</strong>
        <span>CO₂e 總量</span>
      </div>
    </div>
    <div class="legend">
      <div><span class="dot s1"></span> 範疇一 ${s1.toFixed(1)}%</div>
      <div><span class="dot s2"></span> 範疇二 ${s2.toFixed(1)}%</div>
    </div>`;
  },

  renderBarChart(byMonth) {
    const max = Math.max(...byMonth, 0.001);
    const bars = byMonth
      .map(
        (v, i) =>
          `<div class="bar-col" title="${MONTHS[i]}: ${v.toFixed(2)} 噸">
        <div class="bar-fill" style="height:${(v / max) * 100}%"></div>
        <span>${i + 1}</span>
      </div>`
      )
      .join('');
    return `<div class="bar-chart">${bars}</div>`;
  },

  renderDashboard(state, summary) {
    const el = document.getElementById('view-dashboard');
    const projectCount = state.projects.length;
    const entryCount = summary.details.length;
    const intensity =
      state.projects.reduce((s, p) => s + (Number(p.area) || 0), 0) > 0
        ? summary.total / (state.projects.reduce((s, p) => s + (Number(p.area) || 0), 0) / 1000)
        : 0;

    const topProjects = Object.entries(summary.byProject)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pid, t]) => {
        const p = state.projects.find((x) => x.id === pid);
        return `<div class="list-row">
          <span>${this.esc(p?.name || '未分配')}</span>
          <strong>${t.toFixed(2)} 噸</strong>
        </div>`;
      })
      .join('') || '<p class="empty">暫無數據</p>';

    el.innerHTML = `
      <div class="stats-grid">
        ${this.renderStatCard('總排放量', Calculator.formatTonnes(summary.total, 2), 'Scope 1 + 2', 'accent-green')}
        ${this.renderStatCard('範疇一', Calculator.formatTonnes(summary.byScope[1] || 0, 2), '直接排放', 'accent-dark')}
        ${this.renderStatCard('範疇二', Calculator.formatTonnes(summary.byScope[2] || 0, 2), '外購能源', 'accent-mid')}
        ${this.renderStatCard('排放強度', intensity ? intensity.toFixed(3) + ' 噸/千m²' : '—', `${projectCount} 個項目 · ${entryCount} 筆記錄`)}
      </div>
      <div class="grid-2">
        <section class="card">
          <h3>範疇分佈</h3>
          ${this.renderDonut(summary.scope1Pct, summary.scope2Pct, summary.total)}
        </section>
        <section class="card">
          <h3>月度趨勢</h3>
          ${this.renderBarChart(summary.byMonth)}
        </section>
      </div>
      <section class="card">
        <h3>項目排放排名</h3>
        ${topProjects}
      </section>
      <section class="card info-card">
        <h3>範疇說明</h3>
        <div class="scope-info">
          <div><strong>範疇一 (Scope 1)</strong><p>公司擁有或控制的直接排放源，例如地盤發電機、公司車隊燃油、辦公室天然氣鍋爐、冷媒逸散。</p></div>
          <div><strong>範疇二 (Scope 2)</strong><p>外購電力、蒸汽、暖通及供冷產生的間接排放。支援位置基礎與市場基礎兩種計算方法。</p></div>
        </div>
      </section>`;
  },

  renderProjects(state, callbacks) {
    const el = document.getElementById('view-projects');
    const rows = state.projects
      .map((p) => {
        const typeLabel = PROJECT_TYPES.find((t) => t.id === p.type)?.label || p.type;
        const phaseLabel = PROJECT_PHASES.find((t) => t.id === p.phase)?.label || p.phase;
        return `<tr>
          <td><strong>${this.esc(p.name)}</strong><br><span class="muted">${this.esc(p.location || '')}</span></td>
          <td>${this.esc(typeLabel)}</td>
          <td>${this.esc(phaseLabel)}</td>
          <td>${p.area ? Number(p.area).toLocaleString() + ' m²' : '—'}</td>
          <td class="actions">
            <button class="btn-sm" data-edit="${p.id}">編輯</button>
            <button class="btn-sm danger" data-del="${p.id}">刪除</button>
          </td>
        </tr>`;
      })
      .join('');

    el.innerHTML = `
      <div class="toolbar">
        <button class="btn primary" id="add-project">+ 新增項目</button>
      </div>
      <section class="card">
        <table class="table">
          <thead><tr><th>項目名稱</th><th>類型</th><th>階段</th><th>面積</th><th>操作</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty">尚未建立項目</td></tr>'}</tbody>
        </table>
      </section>`;

    document.getElementById('add-project')?.addEventListener('click', () => callbacks.onAddProject());
    el.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => callbacks.onEditProject(btn.dataset.edit))
    );
    el.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', () => callbacks.onDeleteProject(btn.dataset.del))
    );
  },

  projectForm(project, onSave) {
    const p = project || {};
    const typeOpts = PROJECT_TYPES.map((t) => `<option value="${t.id}" ${p.type === t.id ? 'selected' : ''}>${t.label}</option>`).join('');
    const phaseOpts = PROJECT_PHASES.map((t) => `<option value="${t.id}" ${p.phase === t.id ? 'selected' : ''}>${t.label}</option>`).join('');

    this.showModal(`
      <h3>${p.id ? '編輯項目' : '新增項目'}</h3>
      <form id="project-form" class="form">
        <label>項目名稱<input name="name" required value="${this.esc(p.name || '')}" /></label>
        <label>位置<input name="location" value="${this.esc(p.location || '')}" placeholder="例如：香港 · 將軍澳" /></label>
        <div class="form-row">
          <label>類型<select name="type">${typeOpts}</select></label>
          <label>階段<select name="phase">${phaseOpts}</select></label>
        </div>
        <div class="form-row">
          <label>總面積 (m²)<input name="area" type="number" min="0" value="${p.area || ''}" /></label>
          <label>開工/啟用年份<input name="startYear" type="number" value="${p.startYear || new Date().getFullYear()}" /></label>
        </div>
        <label>備註<textarea name="notes" rows="2">${this.esc(p.notes || '')}</textarea></label>
        <div class="form-actions">
          <button type="button" class="btn" data-close>取消</button>
          <button type="submit" class="btn primary">儲存</button>
        </div>
      </form>`, null);

    document.getElementById('project-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      onSave({
        id: p.id,
        name: fd.get('name'),
        location: fd.get('location'),
        type: fd.get('type'),
        phase: fd.get('phase'),
        area: fd.get('area'),
        startYear: fd.get('startYear'),
        notes: fd.get('notes'),
      });
      this.hideModal();
    });
  },

  renderEmissionEntries(state, scope, summary, callbacks) {
    const viewId = scope === 1 ? 'view-scope1' : 'view-scope2';
    const el = document.getElementById(viewId);
    const categories = scope === 1 ? SCOPE1_CATEGORIES : SCOPE2_CATEGORIES;
    const filtered = summary.details.filter((d) => d.scope === scope);

    const catCards = categories
      .map(
        (cat) => `<div class="category-card">
        <h4>${cat.label}</h4>
        <p>${cat.desc}</p>
      </div>`
      )
      .join('');

    const yearConfig = App.getYearConfig(App.filters.year);
    const sourceOpts = Calculator.getSourceOptions(scope, yearConfig.factors)
      .map((s) => `<option value="${s.id}">${s.label} (${s.unit})</option>`)
      .join('');
    const projectOpts = state.projects.map((p) => `<option value="${p.id}">${this.esc(p.name)}</option>`).join('');
    const monthOpts = MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');

    const rows = filtered
      .map(
        (d) => `<tr>
        <td>${d.year} / ${d.month}月</td>
        <td>${this.esc(d.projectName)}</td>
        <td>${this.esc(d.sourceLabel)}</td>
        <td>${Number(d.quantity).toLocaleString()}</td>
        <td><strong>${d.tonnesCO2e.toFixed(3)}</strong> 噸</td>
        <td class="actions">
          <button class="btn-sm danger" data-del-entry="${d.id}">刪除</button>
        </td>
      </tr>`
      )
      .join('');

    const scopeTotal = summary.byScope[scope] || 0;

    el.innerHTML = `
      <div class="scope-header">
        <div>
          <span class="scope-badge scope${scope}">Scope ${scope}</span>
          <strong class="scope-total">${Calculator.formatTonnes(scopeTotal, 2)} CO₂e</strong>
        </div>
      </div>
      <div class="category-grid">${catCards}</div>
      <section class="card">
        <h3>新增排放記錄</h3>
        <form id="entry-form-${scope}" class="form inline-form">
          <input type="hidden" name="scope" value="${scope}" />
          <label>項目<select name="projectId" required><option value="">選擇項目</option>${projectOpts}</select></label>
          <label>年度<input name="year" type="number" value="${App.filters.year}" required /></label>
          <label>月份<select name="month">${monthOpts}</select></label>
          <label>排放源<select name="sourceType" required>${sourceOpts}</select></label>
          <label>用量<input name="quantity" type="number" step="any" min="0" required placeholder="0" /></label>
          ${scope === 2 ? '<label class="market-field hidden" id="market-factor-field">市場係數 (kg/kWh)<input name="marketFactor" type="number" step="0.001" /></label>' : ''}
          <label>備註<input name="notes" placeholder="選填" /></label>
          <button type="submit" class="btn primary">加入記錄</button>
        </form>
      </section>
      <section class="card">
        <h3>記錄明細</h3>
        <table class="table">
          <thead><tr><th>期間</th><th>項目</th><th>排放源</th><th>用量</th><th>排放量</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="empty">尚無 Scope ${scope} 記錄</td></tr>`}</tbody>
        </table>
      </section>`;

    const form = document.getElementById(`entry-form-${scope}`);
    const sourceSelect = form.querySelector('[name="sourceType"]');
    const marketField = document.getElementById('market-factor-field');

    sourceSelect?.addEventListener('change', () => {
      if (scope === 2 && marketField) {
        marketField.classList.toggle('hidden', sourceSelect.value !== 'electricity_market');
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      callbacks.onAddEntry({
        scope,
        projectId: fd.get('projectId'),
        year: Number(fd.get('year')),
        month: Number(fd.get('month')),
        sourceType: fd.get('sourceType'),
        quantity: Number(fd.get('quantity')),
        marketFactor: fd.get('marketFactor') ? Number(fd.get('marketFactor')) : undefined,
        notes: fd.get('notes'),
      });
      form.reset();
      form.querySelector('[name="year"]').value = App.filters.year;
    });

    el.querySelectorAll('[data-del-entry]').forEach((btn) =>
      btn.addEventListener('click', () => callbacks.onDeleteEntry(btn.dataset.delEntry))
    );
  },

  renderReport(state, summary) {
    const el = document.getElementById('view-report');
    const yearConfig = App.getYearConfig(App.filters.year);
    const region = FactorSettings.toRegionConfig(yearConfig);

    const scope1Rows = summary.details
      .filter((d) => d.scope === 1)
      .reduce((acc, d) => {
        acc[d.sourceLabel] = (acc[d.sourceLabel] || 0) + d.tonnesCO2e;
        return acc;
      }, {});

    const scope2Rows = summary.details
      .filter((d) => d.scope === 2)
      .reduce((acc, d) => {
        acc[d.sourceLabel] = (acc[d.sourceLabel] || 0) + d.tonnesCO2e;
        return acc;
      }, {});

    const renderBreakdown = (obj) =>
      Object.entries(obj)
        .map(([k, v]) => `<div class="list-row"><span>${this.esc(k)}</span><strong>${v.toFixed(3)} 噸</strong></div>`)
        .join('') || '<p class="empty">無數據</p>';

    el.innerHTML = `
      <section class="card report-header">
        <h3>碳排放報告摘要</h3>
        <p>報告年度：<strong>${App.filters.year}</strong> · 地區：<strong>${region.label}</strong> · 電網係數：<strong>${yearConfig.gridFactor}</strong> kg CO₂e/kWh</p>
        <p class="muted">本報告涵蓋 GHG Protocol 範疇一及範疇二，不包含範疇三價值鏈排放。</p>
      </section>
      <div class="grid-2">
        <section class="card">
          <h3>範疇一明細</h3>
          <p class="total-line">小計：<strong>${Calculator.formatTonnes(summary.byScope[1] || 0, 3)}</strong></p>
          ${renderBreakdown(scope1Rows)}
        </section>
        <section class="card">
          <h3>範疇二明細</h3>
          <p class="total-line">小計：<strong>${Calculator.formatTonnes(summary.byScope[2] || 0, 3)}</strong></p>
          ${renderBreakdown(scope2Rows)}
        </section>
      </div>
      <section class="card">
        <h3>合規聲明</h3>
        <ul class="checklist">
          <li>✓ 組織邊界：營運控制法 (Operational Control)</li>
          <li>✓ 範疇一：固定燃燒、移動燃燒、逸散排放</li>
          <li>✓ 範疇二：外購電力（位置/市場基礎）、外購蒸汽及暖通</li>
          <li>✓ 排放係數：按報告年度獨立設定，可於「排放係數設定」調整</li>
        </ul>
      </section>
      <div class="toolbar">
        <button class="btn primary" id="export-csv">匯出 CSV 報告</button>
        <button class="btn" id="export-json">匯出 JSON 備份</button>
        <button class="btn danger" id="reset-data">重設所有數據</button>
      </div>`;

    document.getElementById('export-csv')?.addEventListener('click', () => App.exportCSV());
    document.getElementById('export-json')?.addEventListener('click', () => App.exportJSON());
    document.getElementById('reset-data')?.addEventListener('click', () => App.resetData());
  },

  renderSettings(state, callbacks) {
    const el = document.getElementById('view-settings');
    const year = callbacks.settingsYear;
    const resolved = FactorSettings.resolve(state, year);
    const yearConfig = resolved.config;
    const years = FactorSettings.listYears(state);
    const yearOpts = years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>${y} 年</option>`).join('');
    const prev = FactorSettings.findPrevious(state, year);

    const regionOpts = Object.entries(REGIONS)
      .map(([k, v]) => `<option value="${k}" ${yearConfig.region === k ? 'selected' : ''}>${v.label} (參考 ${v.gridFactor})</option>`)
      .join('');

    const factorRows = (pool, scopeKey) =>
      Object.entries(pool)
        .map(([key, val]) => {
          if (val.factorKey) return '';
          return `<tr>
          <td>${this.esc(val.label)}</td>
          <td>${this.esc(val.unit)}</td>
          <td><input type="number" step="0.001" data-factor="${scopeKey}.${key}" value="${val.factor}" class="factor-input" /></td>
          <td class="muted">${this.esc(val.unitEmission)}</td>
        </tr>`;
        })
        .join('');

    const noticeHtml = callbacks.notice
      ? `<div class="notice-banner">${this.esc(callbacks.notice)}</div>`
      : '';

    const statusHtml =
      resolved.source === 'saved'
        ? `<span class="status-badge saved">已儲存獨立設定</span>`
        : resolved.source === 'inherited'
          ? `<span class="status-badge inherited">沿用 ${resolved.inheritedFrom} 年（尚未儲存）</span>`
          : `<span class="status-badge default">使用系統預設</span>`;

    el.innerHTML = `
      <section class="card settings-toolbar">
        <div class="settings-toolbar-row">
          <label class="settings-year-label">設定年度
            <select id="settings-year">${yearOpts}</select>
          </label>
          ${statusHtml}
        </div>
        <div class="toolbar">
          <button class="btn" id="copy-prev-year" ${prev ? '' : 'disabled'}>↩ 跟隨上一年${prev ? ` (${prev.year})` : ''}</button>
          <button class="btn primary" id="save-year-settings">儲存 ${year} 年度設定</button>
          <button class="btn" id="reset-year">還原 ${year} 年為系統預設</button>
        </div>
        ${noticeHtml}
        <p class="muted note">每個年度的排放係數互不干擾。新年度預設沿用上一年數值；修改後請按「儲存本年度設定」才會固定該年設定。</p>
      </section>
      <section class="card">
        <h3>${year} 年 · 地區與電網係數</h3>
        <form id="region-form" class="form inline-form">
          <label>參考地區<select name="region" id="settings-region">${regionOpts}</select></label>
          <label>電網係數 (kg CO₂e/kWh)<input name="gridFactor" id="settings-grid" type="number" step="0.001" value="${yearConfig.gridFactor}" required /></label>
          <label>市場基礎預設 (kg/kWh)<input name="marketFactor" type="number" step="0.001" value="${yearConfig.marketFactor ?? 0.66}" /></label>
        </form>
      </section>
      <section class="card">
        <h3>${year} 年 · 範疇一排放係數</h3>
        <table class="table">
          <thead><tr><th>排放源</th><th>單位</th><th>係數</th><th>說明</th></tr></thead>
          <tbody>${factorRows(yearConfig.factors.scope1, 'scope1')}</tbody>
        </table>
      </section>
      <section class="card">
        <h3>${year} 年 · 範疇二排放係數</h3>
        <table class="table">
          <thead><tr><th>排放源</th><th>單位</th><th>係數</th><th>說明</th></tr></thead>
          <tbody>${factorRows(yearConfig.factors.scope2, 'scope2')}</tbody>
        </table>
        <p class="muted note">外購電力位置基礎係數取自上方「電網係數」；市場基礎可逐筆輸入或使用年度預設值。</p>
      </section>`;

    document.getElementById('settings-year')?.addEventListener('change', (e) => {
      callbacks.onChangeYear(Number(e.target.value));
    });

    document.getElementById('settings-region')?.addEventListener('change', (e) => {
      const reg = REGIONS[e.target.value];
      if (reg) document.getElementById('settings-grid').value = reg.gridFactor;
    });

    document.getElementById('copy-prev-year')?.addEventListener('click', () => {
      callbacks.onCopyFromPrevious(year);
    });

    document.getElementById('reset-year')?.addEventListener('click', () => {
      callbacks.onResetYear(year);
    });

    document.getElementById('save-year-settings')?.addEventListener('click', () => {
      const region = document.getElementById('settings-region').value;
      const gridFactor = Number(document.getElementById('settings-grid').value);
      const marketFactor = Number(document.querySelector('[name="marketFactor"]').value);
      const factors = FactorSettings.clone(yearConfig.factors);
      el.querySelectorAll('.factor-input').forEach((inp) => {
        const [scope, key] = inp.dataset.factor.split('.');
        factors[scope][key].factor = Number(inp.value);
      });
      callbacks.onSaveYearSettings(year, { region, gridFactor, marketFactor, factors });
    });
  },

  updateFilters(state) {
    const yearSel = document.getElementById('filter-year');
    const projSel = document.getElementById('filter-project');
    const years = FactorSettings.listYears(state);

    yearSel.innerHTML = years.map((y) => `<option value="${y}">${y} 年度</option>`).join('');
    yearSel.value = App.filters.year;

    projSel.innerHTML =
      `<option value="all">所有項目</option>` +
      state.projects.map((p) => `<option value="${p.id}">${this.esc(p.name)}</option>`).join('');
    projSel.value = App.filters.projectId;
  },
};
