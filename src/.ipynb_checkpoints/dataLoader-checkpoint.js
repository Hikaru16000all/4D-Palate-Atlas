// src/dataLoader.js

// 假设你的数据文件位于 public/data/ 目录下
const DATA_URLS = {
  geneExpression: '/data/gene_expression.csv',
  tfActivity: '/data/tf_activity.csv', 
  spatial: '/data/spatial_locations.csv',
  cellType: '/data/cell_types.csv',
  section: '/data/section_info.csv'
};

// 解析CSV数据的辅助函数
function parseCSV(text, delimiter = '\t') {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return { headers: [], data: [] };
  
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return { headers, data };
}

// 主要的数据加载和转换函数
export async function loadRealData() {
  try {
    console.log('开始加载真实数据...');
    
    // 加载所有数据文件
    const [geneResponse, tfResponse, spatialResponse, cellTypeResponse, sectionResponse] = await Promise.all([
      fetch(DATA_URLS.geneExpression),
      fetch(DATA_URLS.tfActivity),
      fetch(DATA_URLS.spatial),
      fetch(DATA_URLS.cellType),
      fetch(DATA_URLS.section)
    ]);

    const [geneText, tfText, spatialText, cellTypeText, sectionText] = await Promise.all([
      geneResponse.text(),
      tfResponse.text(),
      spatialResponse.text(),
      cellTypeResponse.text(),
      sectionResponse.text()
    ]);

    console.log('数据文件加载完成，开始解析...');

    // 解析CSV数据
    const geneData = parseCSV(geneText);
    const tfData = parseCSV(tfText);
    const spatialData = parseCSV(spatialText);
    const cellTypeData = parseCSV(cellTypeText);
    const sectionData = parseCSV(sectionText);

    console.log('数据解析完成，开始转换格式...');

    // 转换数据格式
    return transformData(geneData, tfData, spatialData, cellTypeData, sectionData);
  } catch (error) {
    console.error('Error loading data:', error);
    // 如果真实数据加载失败，返回模拟数据
    console.log('使用模拟数据作为后备...');
    return createMockData();
  }
}

function transformData(geneData, tfData, spatialData, cellTypeData, sectionData) {
  console.log('基因数据样本:', geneData.data[0]);
  console.log('TF数据样本:', tfData.data[0]);
  console.log('空间数据样本:', spatialData.data[0]);
  console.log('细胞类型数据样本:', cellTypeData.data[0]);
  console.log('切片数据样本:', sectionData.data[0]);

  // 创建细胞ID到各种属性的映射
  const sectionMap = {};
  sectionData.data.forEach(row => {
    const cellId = Object.keys(row)[0];
    sectionMap[row[cellId]] = row.section || row[Object.keys(row)[1]]; // 尝试不同的键名
  });

  const cellTypeMap = {};
  cellTypeData.data.forEach(row => {
    const cellId = Object.keys(row)[0];
    cellTypeMap[row[cellId]] = row.celltype || row[Object.keys(row)[1]];
  });

  const spatialMap = {};
  spatialData.data.forEach(row => {
    const cellId = Object.keys(row)[0];
    spatialMap[row[cellId]] = {
      x: parseFloat(row.x) || parseFloat(row[Object.keys(row)[1]]) || 0,
      y: parseFloat(row.y) || parseFloat(row[Object.keys(row)[2]]) || 0
    };
  });

  // 提取所有基因名（跳过第一列细胞ID）
  const geneNames = geneData.headers.slice(1);
  
  // 提取所有TF名（跳过第一列，并清理名称）
  const tfNames = tfData.headers.slice(1).map(name => 
    name.replace(' activity(direct)', '').replace(' activity', '').trim()
  );

  console.log('发现的基因:', geneNames);
  console.log('发现的TF:', tfNames);

  // 创建基因表达映射
  const geneExpressionMap = {};
  geneData.data.forEach(row => {
    const cellId = Object.keys(row)[0];
    geneExpressionMap[cellId] = {};
    geneNames.forEach(gene => {
      geneExpressionMap[cellId][gene] = parseFloat(row[gene]) || 0;
    });
  });

  // 创建TF活性映射
  const tfActivityMap = {};
  tfData.data.forEach(row => {
    const cellId = Object.keys(row)[0];
    tfActivityMap[cellId] = {};
    tfData.headers.slice(1).forEach((tfHeader, index) => {
      const tfName = tfNames[index];
      tfActivityMap[cellId][tfName] = parseFloat(row[tfHeader]) || 0;
    });
  });

  // 收集所有唯一的细胞ID（从所有数据源合并）
  const allCellIds = new Set([
    ...geneData.data.map(row => Object.keys(row)[0]),
    ...tfData.data.map(row => Object.keys(row)[0]),
    ...spatialData.data.map(row => Object.keys(row)[0]),
    ...cellTypeData.data.map(row => Object.keys(row)[0]),
    ...sectionData.data.map(row => Object.keys(row)[0])
  ]);

  console.log(`找到 ${allCellIds.size} 个细胞`);

  // 构建最终数据数组
  const transformedData = Array.from(allCellIds).map(cellId => {
    const slice = sectionMap[cellId] || 'Unknown';
    const region = cellTypeMap[cellId] || 'Unknown';
    const spatialInfo = spatialMap[cellId] || { x: 0, y: 0 };

    const cellData = {
      id: cellId,
      slice: slice,
      region: region,
      x: spatialInfo.x,
      y: spatialInfo.y
    };

    // 添加基因表达数据
    if (geneExpressionMap[cellId]) {
      geneNames.forEach(gene => {
        cellData[`gene_${gene}`] = geneExpressionMap[cellId][gene] || 0;
      });
    }

    // 添加TF活性数据
    if (tfActivityMap[cellId]) {
      tfNames.forEach(tf => {
        cellData[`tf_${tf}`] = tfActivityMap[cellId][tf] || 0;
      });
    }

    return cellData;
  });

  // 提取所有唯一的切片和区域
  const allSlices = [...new Set(transformedData.map(d => d.slice))].filter(Boolean);
  const allRegions = [...new Set(transformedData.map(d => d.region))].filter(Boolean);

  console.log(`找到 ${allSlices.length} 个切片:`, allSlices);
  console.log(`找到 ${allRegions.length} 个区域:`, allRegions);
  console.log(`找到 ${geneNames.length} 个基因`);
  console.log(`找到 ${tfNames.length} 个TF`);

  // 如果没有找到基因或TF，添加一些默认值
  if (geneNames.length === 0) {
    console.log('未找到基因，添加默认基因...');
    geneNames.push('Sox2', 'Tbx5', 'Pax6');
  }

  if (tfNames.length === 0) {
    console.log('未找到TF，添加默认TF...');
    tfNames.push('STAT1', 'Smad4', 'Alx1');
  }

  // 构建trait分类
  const traitCategories = [
    { key: 'gene', label: 'Gene' },
    { key: 'tf_activity', label: 'TF Activity' }
  ];

  // 构建所有trait的扁平列表
  const allTraitsFlat = [
    ...geneNames.map(gene => ({
      key: `gene_${gene}`,
      label: gene,
      category: 'gene'
    })),
    ...tfNames.map(tf => ({
      key: `tf_${tf}`,
      label: `${tf} Activity`,
      category: 'tf_activity'
    }))
  ];

  // 构建切片数据
  const sectionDataFormatted = [
    { 
      tissue: 'Embryo', 
      sections: allSlices.map(slice => ({ 
        key: slice, 
        label: slice 
      })) 
    }
  ];

  // 构建区域颜色映射
  const regionColors = allRegions.reduce((acc, region, index) => {
    acc[region] = `hsl(${index * (360 / Math.max(allRegions.length, 1))}, 70%, 50%)`;
    return acc;
  }, {});

  const result = {
    data: transformedData,
    allSlices,
    allRegions,
    traitCategories,
    allTraitsFlat,
    sectionData: sectionDataFormatted,
    regionColors
  };

  console.log('数据转换完成:', result);
  return result;
}

// 模拟数据作为后备
function createMockData() {
  console.log('创建模拟数据...');
  
  const allSlices = ['E125', 'E140'];
  const allRegions = ['Epithelial', 'Mesenchyme', 'Neural Tube', 'Heart', 'Liver', 'Kidney'];
  
  const mockData = [];
  
  allSlices.forEach(slice => {
    for (let i = 0; i < 200; i++) {
      const region = allRegions[Math.floor(Math.random() * allRegions.length)];
      mockData.push({
        id: `${slice}_cell_${i}`,
        slice: slice,
        region: region,
        x: Math.random() * 1000 - 500,
        y: Math.random() * 1000 - 500,
        gene_Sox2: Math.random() * 5,
        gene_Tbx5: Math.random() * 4,
        gene_Pax6: Math.random() * 6,
        tf_STAT1: Math.random() * 3,
        tf_Smad4: Math.random() * 2
      });
    }
  });
  
  const traitCategories = [
    { key: 'gene', label: 'Gene' },
    { key: 'tf_activity', label: 'TF Activity' }
  ];
  
  const allTraitsFlat = [
    { key: 'gene_Sox2', label: 'Sox2', category: 'gene' },
    { key: 'gene_Tbx5', label: 'Tbx5', category: 'gene' },
    { key: 'gene_Pax6', label: 'Pax6', category: 'gene' },
    { key: 'tf_STAT1', label: 'STAT1 Activity', category: 'tf_activity' },
    { key: 'tf_Smad4', label: 'Smad4 Activity', category: 'tf_activity' }
  ];
  
  const sectionData = [
    { 
      tissue: 'Embryo', 
      sections: allSlices.map(slice => ({ 
        key: slice, 
        label: slice 
      })) 
    }
  ];
  
  const regionColors = allRegions.reduce((acc, region, index) => {
    acc[region] = `hsl(${index * (360 / allRegions.length)}, 70%, 50%)`;
    return acc;
  }, {});
  
  return {
    data: mockData,
    allSlices,
    allRegions,
    traitCategories,
    allTraitsFlat,
    sectionData,
    regionColors
  };
}
