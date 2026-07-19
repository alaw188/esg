/** 按年度管理排放係數 */

const FactorSettings = {
  buildDefault(year) {
    return {
      region: 'HK',
      gridFactor: REGIONS.HK.gridFactor,
      marketFactor: 0.66,
      factors: JSON.parse(JSON.stringify(DEFAULT_FACTORS)),
    };
  },

  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /** 取得有記錄或已設定的所有年度（新至舊） */
  listYears(state) {
    const years = new Set();
    (state.entries || []).forEach((e) => years.add(e.year));
    Object.keys(state.yearSettings || {}).forEach((y) => years.add(Number(y)));
    years.add(new Date().getFullYear());
    years.add(new Date().getFullYear() + 1);
    return [...years].sort((a, b) => b - a);
  },

  /** 找最近一個已有儲存設定的较早年度 */
  findPrevious(state, year) {
    for (let y = year - 1; y >= year - 30; y--) {
      const cfg = state.yearSettings?.[String(y)];
      if (cfg) return { year: y, config: cfg };
    }
    return null;
  },

  /**
   * 解析指定年度應使用的係數（計算與顯示共用）
   * - saved: 該年已獨立儲存
   * - inherited: 沿用上一年（尚未儲存）
   * - default: 系統預設（找不到上一年）
   */
  resolve(state, year) {
    const key = String(year);
    if (state.yearSettings?.[key]) {
      return { config: state.yearSettings[key], source: 'saved', inheritedFrom: null };
    }
    const prev = this.findPrevious(state, year);
    if (prev) {
      return { config: this.clone(prev.config), source: 'inherited', inheritedFrom: prev.year };
    }
    return { config: this.buildDefault(year), source: 'default', inheritedFrom: null };
  },

  /** 手動從上一年複製並寫入（覆蓋現有設定） */
  copyFromPrevious(state, year) {
    const prev = this.findPrevious(state, year);
    if (!prev) return { ok: false, message: '找不到上一年的設定，請手動輸入或還原系統預設。' };
    if (!state.yearSettings) state.yearSettings = {};
    state.yearSettings[String(year)] = this.clone(prev.config);
    return { ok: true, fromYear: prev.year };
  },

  /** 還原為系統預設（只影響該年度） */
  resetToDefault(state, year) {
    if (!state.yearSettings) state.yearSettings = {};
    state.yearSettings[String(year)] = this.buildDefault(year);
  },

  /** 舊版資料遷移 */
  migrate(data) {
    if (data.yearSettings) return data;

    const currentYear = new Date().getFullYear();
    const region = data.region || 'HK';
    data.yearSettings = {
      [String(currentYear)]: {
        region,
        gridFactor: REGIONS[region]?.gridFactor ?? 0.66,
        marketFactor: data.marketFactor ?? 0.66,
        factors: data.customFactors
          ? this.clone(data.customFactors)
          : this.clone(DEFAULT_FACTORS),
      },
    };
    delete data.customFactors;
    delete data.region;
    delete data.marketFactor;
    return data;
  },

  toRegionConfig(yearConfig) {
    return {
      gridFactor: yearConfig.gridFactor,
      marketFactor: yearConfig.marketFactor,
      label: REGIONS[yearConfig.region]?.label || yearConfig.region,
    };
  },
};
