/** 主應用程式 */

const App = {
  state: null,
  filters: { year: new Date().getFullYear(), projectId: 'all' },
  settingsYear: new Date().getFullYear(),
  settingsNotice: null,
  currentView: 'dashboard',

  init() {
    this.state = Storage.load();
    this.bindNav();
    this.bindFilters();
    this.render();
  },

  getYearConfig(year) {
    return FactorSettings.resolve(this.state, year).config;
  },

  getFilteredEntries() {
    return this.state.entries.filter((e) => {
      if (e.year !== this.filters.year) return false;
      if (this.filters.projectId !== 'all' && e.projectId !== this.filters.projectId) return false;
      return true;
    });
  },

  getSummary() {
    return Calculator.summarize(this.getFilteredEntries(), this.state.projects, (year) => this.getYearConfig(year));
  },

  persist() {
    Storage.save(this.state);
    this.render();
  },

  bindNav() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentView = btn.dataset.view;
        if (this.currentView === 'settings') {
          this.settingsYear = this.filters.year;
          this.settingsNotice = null;
        }
        this.render();
      });
    });
  },

  bindFilters() {
    document.getElementById('filter-year').addEventListener('change', (e) => {
      this.filters.year = Number(e.target.value);
      this.render();
    });
    document.getElementById('filter-project').addEventListener('change', (e) => {
      this.filters.projectId = e.target.value;
      this.render();
    });
  },

  setPageTitle(title, subtitle) {
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-subtitle').textContent = subtitle;
  },

  render() {
    UI.updateFilters(this.state);
    const summary = this.getSummary();

    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.getElementById(`view-${this.currentView}`)?.classList.add('active');

    const titles = {
      dashboard: ['總覽儀表板', '監察所有開發項目的碳排放表現'],
      projects: ['項目管理', '管理地盤、辦公室及營運資產'],
      scope1: ['範疇一 · 直接排放', '固定燃燒、移動源及逸散排放'],
      scope2: ['範疇二 · 間接排放', '外購電力、蒸汽及區域能源'],
      report: ['報告與匯出', '生成合規報告及數據備份'],
      settings: ['排放係數設定', '按年度獨立管理排放係數，互不影響'],
    };
    const [t, s] = titles[this.currentView] || titles.dashboard;
    this.setPageTitle(t, s);

    UI.renderDashboard(this.state, summary);

    UI.renderProjects(this.state, {
      onAddProject: () => this.openProjectForm(),
      onEditProject: (id) => this.openProjectForm(this.state.projects.find((p) => p.id === id)),
      onDeleteProject: (id) => this.deleteProject(id),
    });

    const entryCallbacks = {
      onAddEntry: (entry) => this.addEntry(entry),
      onDeleteEntry: (id) => this.deleteEntry(id),
    };
    UI.renderEmissionEntries(this.state, 1, summary, entryCallbacks);
    UI.renderEmissionEntries(this.state, 2, summary, entryCallbacks);
    UI.renderReport(this.state, summary);
    UI.renderSettings(this.state, {
      settingsYear: this.settingsYear,
      notice: this.settingsNotice,
      onChangeYear: (year) => {
        this.settingsYear = year;
        this.settingsNotice = null;
        const { source, inheritedFrom } = FactorSettings.resolve(this.state, year);
        if (source === 'inherited') {
          this.settingsNotice = `目前顯示 ${inheritedFrom} 年的沿用值。修改後請按「儲存 ${year} 年度設定」才會固定為該年獨立係數。`;
        }
        this.render();
      },
      onCopyFromPrevious: (year) => {
        const result = FactorSettings.copyFromPrevious(this.state, year);
        if (!result.ok) {
          alert(result.message);
          return;
        }
        this.settingsNotice = `已從 ${result.fromYear} 年複製設定。請確認數值後按「儲存本年度設定」。`;
        this.persist();
      },
      onSaveYearSettings: (year, data) => {
        if (!this.state.yearSettings) this.state.yearSettings = {};
        this.state.yearSettings[String(year)] = data;
        this.settingsNotice = `${year} 年排放係數已儲存。`;
        this.persist();
      },
      onResetYear: (year) => {
        if (!confirm(`確定將 ${year} 年還原為系統預設係數？（不影響其他年度）`)) return;
        FactorSettings.resetToDefault(this.state, year);
        this.settingsNotice = `${year} 年已還原為系統預設。`;
        this.persist();
      },
    });
  },

  openProjectForm(project) {
    UI.projectForm(project, (data) => {
      if (data.id) {
        const idx = this.state.projects.findIndex((p) => p.id === data.id);
        if (idx >= 0) this.state.projects[idx] = { ...this.state.projects[idx], ...data };
      } else {
        this.state.projects.push({ ...data, id: Storage.uid() });
      }
      this.persist();
    });
  },

  deleteProject(id) {
    if (!confirm('刪除此項目？相關排放記錄將保留但顯示為「未分配」。')) return;
    this.state.projects = this.state.projects.filter((p) => p.id !== id);
    this.persist();
  },

  addEntry(entry) {
    this.snapshotYearSettingsIfNeeded(entry.year);
    this.state.entries.push({ ...entry, id: Storage.uid() });
    this.persist();
  },

  /** 首次有排放記錄時，將沿用的係數固定為該年獨立設定 */
  snapshotYearSettingsIfNeeded(year) {
    const key = String(year);
    if (this.state.yearSettings?.[key]) return;
    const { config } = FactorSettings.resolve(this.state, year);
    if (!this.state.yearSettings) this.state.yearSettings = {};
    this.state.yearSettings[key] = FactorSettings.clone(config);
  },

  deleteEntry(id) {
    this.state.entries = this.state.entries.filter((e) => e.id !== id);
    this.persist();
  },

  exportCSV() {
    const summary = this.getSummary();
    const csv = Storage.exportCSV(summary.details, (year) => this.getYearConfig(year));
    this.downloadFile(`碳排放報告_${this.filters.year}.csv`, csv, 'text/csv;charset=utf-8');
  },

  exportJSON() {
    const json = Storage.exportJSON(this.state);
    this.downloadFile(`碳排放備份_${Date.now()}.json`, json, 'application/json');
  },

  downloadFile(name, content, type) {
    const blob = new Blob(['\ufeff' + content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  resetData() {
    if (!confirm('此操作將清除所有本地數據，確定繼續？')) return;
    localStorage.removeItem(Storage.KEY);
    this.state = Storage.load();
    this.settingsNotice = null;
    this.render();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
