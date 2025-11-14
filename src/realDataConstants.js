// src/realDataConstants.js
import { binaryDataLoader } from './binaryDataLoader';

// 默认空数据
const ALL_SLICES = [];
const ALL_REGIONS = [];
const SECTION_DATA = [];
const TRAIT_CATEGORIES = [
  { key: 'gene', label: 'Gene' },
  { key: 'tf_activity', label: 'TF Activity' },
];
const ALL_TRAITS_FLAT = [];
const BASE_DATA = [];

// 数据加载状态
let isInitialized = false;

// 初始化数据加载器
export const initializeData = async () => {
  if (isInitialized) return true;
  
  try {
    await binaryDataLoader.init();
    
    const baseData = binaryDataLoader.getBaseData();
    const features = binaryDataLoader.getAllFeatures();
    
    console.log('=== DEBUG: Available Features ===');
    console.log('Genes count:', features.genes ? features.genes.length : 0);
    console.log('First 5 genes:', features.genes ? features.genes.slice(0, 5) : []);
    console.log('TFs count:', features.tfs ? features.tfs.length : 0);
    console.log('First 5 TFs:', features.tfs ? features.tfs.slice(0, 5) : []);
    
    // 提取常量
    ALL_SLICES.length = 0;
    ALL_REGIONS.length = 0;
    
    const slicesSet = new Set();
    const regionsSet = new Set();
    
    baseData.forEach(cell => {
      slicesSet.add(cell.slice);
      regionsSet.add(cell.region);
    });
    
    ALL_SLICES.push(...Array.from(slicesSet).sort());
    ALL_REGIONS.push(...Array.from(regionsSet).sort());
    
    // 构建特性列表
    ALL_TRAITS_FLAT.length = 0;
    
    // 添加基因
    if (features.genes && features.genes.length > 0) {
      console.log(`Adding ${features.genes.length} genes to trait list`);
      features.genes.forEach(gene => {
        ALL_TRAITS_FLAT.push({
          key: gene,
          label: gene,
          category: 'gene'
        });
      });
    }
    
    // 添加TF
    if (features.tfs && features.tfs.length > 0) {
      console.log(`Adding ${features.tfs.length} TFs to trait list`);
      features.tfs.forEach(tf => {
        const label = tf.includes('(direct)') 
          ? tf.replace(' activity(direct)', ' Activity (Direct)')
          : tf.includes('(extended)')
          ? tf.replace(' activity(extended)', ' Activity (Extended)')
          : tf + '';
        
        ALL_TRAITS_FLAT.push({
          key: tf,
          label: label,
          category: 'tf_activity'
        });
      });
    }
    
    // 设置基础数据
    BASE_DATA.length = 0;
    BASE_DATA.push(...baseData);
    
    // 构建切片数据
    SECTION_DATA.length = 0;
    SECTION_DATA.push({
      tissue: 'Embryo',
      sections: ALL_SLICES.map(s => ({ key: s, label: s }))
    });
    
    isInitialized = true;
    console.log('Data initialization complete');
    console.log('Total traits available:', ALL_TRAITS_FLAT.length);
    
    return true;
  } catch (error) {
    console.error('Failed to initialize data:', error);
    throw error;
  }
};

// 按需加载特征数据
export const loadFeatureData = async (featureName, category = 'genes') => {
  if (!isInitialized) {
    await initializeData();
  }
  
  const featureArray = await binaryDataLoader.loadFeature(featureName, category);
  
  // 将特征数据合并到基础数据中
  return BASE_DATA.map((cell, index) => ({
    ...cell,
    [featureName]: featureArray[index]
  }));
};

// 批量加载多个特征
export const loadMultipleFeaturesData = async (featureNames, category = 'genes') => {
  if (!isInitialized) {
    await initializeData();
  }
  
  const featuresData = await binaryDataLoader.loadMultipleFeatures(featureNames, category);
  
  // 合并所有特征数据
  return BASE_DATA.map((cell, index) => {
    const cellWithFeatures = { ...cell };
    featureNames.forEach(featureName => {
      cellWithFeatures[featureName] = featuresData[featureName][index];
    });
    return cellWithFeatures;
  });
};

// 获取基础数据
export const getBaseData = () => {
  return BASE_DATA;
};

// 获取数据统计
export const getDataStats = () => {
  return binaryDataLoader.getStats();
};

// 检查是否已初始化
export const isDataInitialized = () => {
  return isInitialized;
};

// 统一导出所有常量
export {
  ALL_SLICES,
  ALL_REGIONS,
  SECTION_DATA,
  TRAIT_CATEGORIES,
  ALL_TRAITS_FLAT,
  BASE_DATA
};