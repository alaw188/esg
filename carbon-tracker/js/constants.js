/** 排放係數與分類定義 — 依 GHG Protocol Corporate Standard */

const REGIONS = {
  HK: { label: '香港', gridFactor: 0.66 },
  CN_GD: { label: '廣東', gridFactor: 0.527 },
  CN_BJ: { label: '北京', gridFactor: 0.558 },
  TW: { label: '台灣', gridFactor: 0.509 },
  SG: { label: '新加坡', gridFactor: 0.412 },
  CUSTOM: { label: '自訂', gridFactor: 0.5 },
};

const DEFAULT_FACTORS = {
  scope1: {
    naturalGas_m3: { label: '天然氣', unit: 'm³', factor: 2.034, unitEmission: 'kg CO₂e/m³' },
    naturalGas_kWh: { label: '天然氣', unit: 'kWh', factor: 0.204, unitEmission: 'kg CO₂e/kWh' },
    diesel: { label: '柴油', unit: '升', factor: 2.687, unitEmission: 'kg CO₂e/升' },
    petrol: { label: '汽油', unit: '升', factor: 2.296, unitEmission: 'kg CO₂e/升' },
    lpg: { label: '液化石油氣 (LPG)', unit: 'kg', factor: 1.512, unitEmission: 'kg CO₂e/kg' },
    townGas: { label: '煤氣 (Town Gas)', unit: 'MJ', factor: 0.054, unitEmission: 'kg CO₂e/MJ' },
    refrigerant: { label: '冷媒逸散', unit: 'kg 冷媒', factor: 1430, unitEmission: 'kg CO₂e/kg 冷媒 (R410A 估算)' },
  },
  scope2: {
    electricity_location: { label: '外購電力 (位置基礎)', unit: 'kWh', factorKey: 'gridFactor', unitEmission: 'kg CO₂e/kWh' },
    electricity_market: { label: '外購電力 (市場基礎)', unit: 'kWh', factorKey: 'marketFactor', unitEmission: 'kg CO₂e/kWh' },
    steam: { label: '外購蒸汽', unit: 'GJ', factor: 56.1, unitEmission: 'kg CO₂e/GJ' },
    heating: { label: '外購暖通 (區域供熱)', unit: 'GJ', factor: 56.1, unitEmission: 'kg CO₂e/GJ' },
    cooling: { label: '外購冷卻 (區域供冷)', unit: 'GJ', factor: 42.0, unitEmission: 'kg CO₂e/GJ' },
  },
};

const SCOPE1_CATEGORIES = [
  { id: 'stationary', label: '固定燃燒源', desc: '地盤發電機、辦公室鍋爐、示範單位暖通' },
  { id: 'mobile', label: '移動燃燒源', desc: '公司車隊、地盤運輸車輛' },
  { id: 'fugitive', label: '逸散排放', desc: '冷媒補充、滅火劑等' },
];

const SCOPE2_CATEGORIES = [
  { id: 'purchased_electricity', label: '外購電力', desc: '地盤、辦公室、銷售中心用電' },
  { id: 'purchased_energy', label: '外購能源', desc: '蒸汽、區域供冷供熱' },
];

const PROJECT_TYPES = [
  { id: 'residential', label: '住宅' },
  { id: 'commercial', label: '商業' },
  { id: 'mixed', label: '綜合用途' },
  { id: 'office', label: '寫字樓' },
  { id: 'site', label: '地盤施工' },
  { id: 'corporate', label: '總部/後勤' },
];

const PROJECT_PHASES = [
  { id: 'planning', label: '規劃設計' },
  { id: 'construction', label: '施工建造' },
  { id: 'sales', label: '銷售/示範' },
  { id: 'operation', label: '營運管理' },
  { id: 'handover', label: '交樓/移交' },
];

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
