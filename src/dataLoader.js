// src/dataLoader.js
import Papa from 'papaparse';
import { dataManager } from './dataManager';

// 公共数据文件路径
const DATA_BASE_PATH = './data';
const SECTION_FILE = `${DATA_BASE_PATH}/section.csv`;
const COORDINATES_FILE = `${DATA_BASE_PATH}/coordinates.csv`;
const CELLTYPE_FILE = `${DATA_BASE_PATH}/celltype.csv`;

// 加载和解析CSV文件（用于基础数据）
const loadCSV = async (filePath) => {
  try {
    console.log(`Loading CSV from: ${filePath}`);
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load ${filePath}: ${response.status}`);
    }
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log(`Loaded ${results.data.length} rows from ${filePath}`, results.data[0]);
          if (results.data.length === 0) {
            console.warn(`No data found in ${filePath}`);
          }
          resolve(results.data);
        },
        error: (error) => {
          console.error(`Error parsing ${filePath}:`, error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    throw error;
  }
};

// 主数据加载函数 - 只加载基础数据
export const loadRealData = async () => {
  console.log('Loading base data from CSV files...');
  
  try {
    // 只并行加载基础文件
    const [sectionData, coordinateData, celltypeData] = await Promise.all([
      loadCSV(SECTION_FILE),
      loadCSV(COORDINATES_FILE),
      loadCSV(CELLTYPE_FILE)
    ]);

    console.log('Base data loaded:', {
      section: sectionData.length,
      coordinates: coordinateData.length,
      celltype: celltypeData.length
    });

    // 预加载特征索引（但不加载具体数据）
    const featureIndex = await dataManager.preloadFeatureIndex();
    console.log('Feature index preloaded:', {
      genes: featureIndex.genes.length,
      tfs: featureIndex.tfs.length
    });

    return combineData(sectionData, coordinateData, celltypeData, featureIndex);
  } catch (error) {
    console.error('Failed to load data:', error);
    throw error;
  }
};

// 处理基础数据（保持不变）
const processSectionData = (sectionData) => {
  const sectionMap = {};
  let processedCount = 0;
  
  sectionData.forEach(row => {
    const cellId = row[''];
    const section = row.section;
    
    if (cellId && section) {
      sectionMap[cellId] = section;
      processedCount++;
    }
  });
  
  console.log(`Processed ${processedCount} section entries`);
  return sectionMap;
};

const processCoordinateData = (coordinateData) => {
  const coordMap = {};
  let processedCount = 0;
  
  coordinateData.forEach(row => {
    const cellId = row[''];
    const x = parseFloat(row.x);
    const y = parseFloat(row.y);
    
    if (cellId && !isNaN(x) && !isNaN(y)) {
      coordMap[cellId] = { x, y };
      processedCount++;
    }
  });
  
  console.log(`Processed ${processedCount} coordinate entries`);
  return coordMap;
};

const processCelltypeData = (celltypeData) => {
  const celltypeMap = {};
  let processedCount = 0;
  
  celltypeData.forEach(row => {
    const cellId = row[''];
    const celltype = row.celltype;
    
    if (cellId && celltype) {
      celltypeMap[cellId] = celltype;
      processedCount++;
    }
  });
  
  console.log(`Processed ${processedCount} celltype entries`);
  return celltypeMap;
};

// 合并基础数据
const combineData = (rawSectionData, rawCoordinateData, rawCelltypeData, featureIndex) => {
  console.log('Combining base data...');
  
  // 处理原始数据
  const sectionMap = processSectionData(rawSectionData);
  const coordMap = processCoordinateData(rawCoordinateData);
  const celltypeMap = processCelltypeData(rawCelltypeData);

  console.log('Maps sizes:', {
    section: Object.keys(sectionMap).length,
    coord: Object.keys(coordMap).length,
    celltype: Object.keys(celltypeMap).length
  });

  // 获取所有细胞ID
  const allCellIds = new Set([
    ...Object.keys(sectionMap),
    ...Object.keys(coordMap),
    ...Object.keys(celltypeMap)
  ]);
  
  console.log('Total unique cells found:', allCellIds.size);

  const combinedData = [];
  let skippedCells = 0;

  allCellIds.forEach(cellId => {
    const section = sectionMap[cellId];
    const coord = coordMap[cellId];
    const celltype = celltypeMap[cellId] || 'Unknown';

    // 必须有切片信息和坐标信息
    if (section && coord && !isNaN(coord.x) && !isNaN(coord.y)) {
      combinedData.push({
        id: cellId,
        x: coord.x,
        y: coord.y,
        slice: section,
        region: celltype
        // 注意：不包含基因和TF数据，这些将按需加载
      });
    } else {
      skippedCells++;
    }
  });

  console.log(`Successfully combined ${combinedData.length} cells, skipped ${skippedCells} cells`);
  
  if (combinedData.length === 0) {
    console.error('No valid cells found after combining data');
    return createSampleData();
  }
  
  // 返回基础数据和特征索引
  return {
    baseData: normalizeCoordinates(combinedData),
    featureIndex
  };
};

// 创建示例数据（保持不变）
const createSampleData = () => {
  // ... 保持不变
};

// 坐标归一化（保持不变）
const normalizeCoordinates = (data) => {
  // ... 保持不变
};

// 从合并的数据中提取常量
export const extractConstantsFromData = (data) => {
  console.log('Extracting constants from data...');
  
  const baseData = data.baseData;
  const featureIndex = data.featureIndex;
  
  // 提取所有切片
  const ALL_SLICES = [...new Set(baseData.map(d => d.slice))].sort();
  
  // 提取所有区域（细胞类型）
  const ALL_REGIONS = [...new Set(baseData.map(d => d.region))].sort();

  // 从特征索引创建特性列表
  const ALL_TRAITS_FLAT = [
    ...featureIndex.genes.map(gene => ({
      key: gene,
      label: gene,
      category: 'gene'
    })),
    ...featureIndex.tfs.map(tf => {
      const label = tf.includes('(direct)') 
        ? tf.replace(' activity(direct)', ' Activity (Direct)')
        : tf.includes('(extended)')
        ? tf.replace(' activity(extended)', ' Activity (Extended)')
        : tf + ' Activity';
      
      return {
        key: tf,
        label: label,
        category: 'tf_activity'
      };
    })
  ];

  // 定义特性分类
  const TRAIT_CATEGORIES = [
    { key: 'gene', label: 'Gene' },
    { key: 'tf_activity', label: 'TF Activity' },
  ];

  // 切片数据
  const SECTION_DATA = [
    { 
      tissue: 'Embryo', 
      sections: ALL_SLICES.map(s => ({ key: s, label: s })) 
    },
  ];

  console.log('Constants extracted:', {
    slices: ALL_SLICES,
    regions: ALL_REGIONS,
    traits: ALL_TRAITS_FLAT.length,
    genes: featureIndex.genes.length,
    tfs: featureIndex.tfs.length
  });

  return {
    ALL_SLICES,
    ALL_REGIONS,
    SECTION_DATA,
    TRAIT_CATEGORIES,
    ALL_TRAITS_FLAT,
    BASE_DATA: baseData, // 重命名为BASE_DATA以明确不包含特征数据
    FEATURE_INDEX: featureIndex
  };
};

// 按需加载特征数据并合并到基础数据中
export const loadFeatureData = async (baseData, traitKey) => {
  console.log(`Loading feature data for: ${traitKey}`);
  
  let featureData;
  if (traitKey.includes('_activity') || traitKey.includes('Activity')) {
    featureData = await dataManager.loadTFActivity(traitKey);
  } else {
    featureData = await dataManager.loadGeneExpression(traitKey);
  }

  // 将特征数据合并到基础数据中
  const enhancedData = baseData.map(cell => ({
    ...cell,
    [traitKey]: featureData[cell.id] || 0 // 默认值为0
  }));

  console.log(`Enhanced data with ${traitKey}, non-zero cells: ${Object.keys(featureData).length}`);
  return enhancedData;
};

// 批量加载多个特征用于比较模式
export const loadMultipleFeaturesData = async (baseData, traitKeys) => {
  console.log(`Loading multiple features: ${traitKeys.join(', ')}`);
  
  const featuresData = await dataManager.loadMultipleFeatures(traitKeys);
  
  // 合并所有特征数据到基础数据中
  const enhancedData = baseData.map(cell => {
    const cellWithFeatures = { ...cell };
    
    traitKeys.forEach(traitKey => {
      cellWithFeatures[traitKey] = featuresData[traitKey]?.[cell.id] || 0;
    });
    
    return cellWithFeatures;
  });

  console.log(`Enhanced data with ${traitKeys.length} features`);
  return enhancedData;
};