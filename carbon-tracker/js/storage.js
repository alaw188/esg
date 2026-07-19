/** 本地資料持久化 */

const Storage = {
  KEY: 'carbon-tracker-data-v1',

  defaultData() {
    const year = new Date().getFullYear();
    return {
      yearSettings: {
        [String(year)]: FactorSettings.buildDefault(year),
      },
      projects: [
        {
          id: 'demo-1',
          name: '維港居 · 第一期',
          type: 'residential',
          phase: 'construction',
          location: '香港 · 九龍',
          area: 45000,
          startYear: 2024,
          notes: '示範項目',
        },
        {
          id: 'demo-2',
          name: '企業總部大樓',
          type: 'corporate',
          phase: 'operation',
          location: '香港 · 中環',
          area: 12000,
          startYear: 2022,
          notes: '',
        },
      ],
      entries: [
        { id: 'e1', projectId: 'demo-1', scope: 1, year, month: 3, sourceType: 'diesel', quantity: 8500, notes: '地盤發電機及工程車輛' },
        { id: 'e2', projectId: 'demo-1', scope: 1, year, month: 3, sourceType: 'naturalGas_m3', quantity: 1200, notes: '工人宿舍暖水' },
        { id: 'e3', projectId: 'demo-1', scope: 2, year, month: 3, sourceType: 'electricity_location', quantity: 185000, notes: '地盤施工用電' },
        { id: 'e4', projectId: 'demo-2', scope: 2, year, month: 3, sourceType: 'electricity_location', quantity: 42000, notes: '總部辦公室' },
        { id: 'e5', projectId: 'demo-2', scope: 1, year, month: 2, sourceType: 'petrol', quantity: 680, notes: '公司車隊' },
      ],
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaultData();
      const data = JSON.parse(raw);
      const merged = { ...this.defaultData(), ...data };
      return FactorSettings.migrate(merged);
    } catch {
      return this.defaultData();
    }
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  uid() {
    return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  exportJSON(data) {
    return JSON.stringify(data, null, 2);
  },

  exportCSV(details, getYearConfig) {
    const headers = ['年度', '月份', '項目', '範疇', '排放源', '用量', '單位', 'kg CO₂e', '噸 CO₂e', '備註'];
    const rows = details.map((d) => {
      const cfg = getYearConfig(d.year);
      const def = Calculator.getFactorDef(d.scope, d.sourceType, cfg.factors);
      return [
        d.year,
        d.month,
        d.projectName,
        `Scope ${d.scope}`,
        d.sourceLabel,
        d.quantity,
        def?.unit || '',
        d.kgCO2e.toFixed(2),
        d.tonnesCO2e.toFixed(4),
        d.notes || '',
      ];
    });
    return [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  },
};
