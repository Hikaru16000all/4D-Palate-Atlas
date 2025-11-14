// src/realDataConstants.js
import { loadRealData, extractConstantsFromData } from './dataLoader';

// 默认空数据
export const ALL_SLICES = [];
export const ALL_REGIONS = [];
export const SECTION_DATA = [];
export const TRAIT_CATEGORIES = [
  { key: 'gene', label: 'Gene' },
  { key: 'tf_activity', label: 'TF Activity' },
];
export const ALL_TRAITS_FLAT = [];
export const REAL_DATA = [];

// 导出数据加载函数
export { loadRealData, extractConstantsFromData };
