/** 碳排放計算引擎 */

const Calculator = {
  /** 計算單筆排放 (kg CO₂e) — 使用該記錄所屬年度的係數設定 */
  calcEntry(entry, yearConfig) {
    const factors = yearConfig.factors;
    const region = FactorSettings.toRegionConfig(yearConfig);
    const def = this.getFactorDef(entry.scope, entry.sourceType, factors);
    if (!def) return 0;

    let factor = def.factor;
    if (def.factorKey === 'gridFactor') {
      factor = region.gridFactor ?? REGIONS.HK.gridFactor;
    } else if (def.factorKey === 'marketFactor') {
      factor = entry.marketFactor ?? region.marketFactor ?? region.gridFactor ?? REGIONS.HK.gridFactor;
    }

    const qty = Number(entry.quantity) || 0;
    return qty * factor;
  },

  getFactorDef(scope, sourceType, factors) {
    const pool = scope === 1 ? factors.scope1 : factors.scope2;
    return pool[sourceType] || null;
  },

  getSourceOptions(scope, factors) {
    const pool = scope === 1 ? factors.scope1 : factors.scope2;
    return Object.entries(pool).map(([key, val]) => ({
      id: key,
      label: val.label,
      unit: val.unit,
      unitEmission: val.unitEmission,
    }));
  },

  /** 彙總所有排放記錄 */
  summarize(entries, projects, getYearConfig) {
    const byScope = { 1: 0, 2: 0 };
    const byProject = {};
    const bySource = {};
    const byMonth = Array(12).fill(0);
    const details = [];

    entries.forEach((entry) => {
      const yearConfig = getYearConfig(entry.year);
      const kg = this.calcEntry(entry, yearConfig);
      const tonnes = kg / 1000;

      byScope[entry.scope] = (byScope[entry.scope] || 0) + tonnes;

      const pid = entry.projectId || 'unassigned';
      byProject[pid] = (byProject[pid] || 0) + tonnes;

      const srcKey = `scope${entry.scope}_${entry.sourceType}`;
      bySource[srcKey] = (bySource[srcKey] || 0) + tonnes;

      const monthIdx = (entry.month || 1) - 1;
      if (monthIdx >= 0 && monthIdx < 12) byMonth[monthIdx] += tonnes;

      const project = projects.find((p) => p.id === entry.projectId);
      const def = this.getFactorDef(entry.scope, entry.sourceType, yearConfig.factors);

      details.push({
        ...entry,
        kgCO2e: kg,
        tonnesCO2e: tonnes,
        projectName: project?.name || '未分配',
        sourceLabel: def?.label || entry.sourceType,
      });
    });

    const total = byScope[1] + byScope[2];

    return {
      total,
      byScope,
      byProject,
      bySource,
      byMonth,
      details,
      scope1Pct: total ? (byScope[1] / total) * 100 : 0,
      scope2Pct: total ? (byScope[2] / total) * 100 : 0,
    };
  },

  formatTonnes(value, decimals = 2) {
    if (value >= 1000) return (value / 1000).toFixed(decimals) + ' 千噸';
    return value.toFixed(decimals) + ' 噸';
  },

  formatKg(value) {
    if (value >= 1000) return (value / 1000).toFixed(2) + ' 噸';
    return value.toFixed(1) + ' kg';
  },
};
