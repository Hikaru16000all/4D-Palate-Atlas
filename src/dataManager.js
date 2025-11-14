// src/dataManager.js
import { loadSparseMatrix } from './sparseMatrixConverter';

const DATA_BASE_PATH = './data';
const GENE_EXPRESSION_SPARSE_FILE = `${DATA_BASE_PATH}/gene_expression_sparse.json`;
const TF_ACTIVITY_SPARSE_FILE = `${DATA_BASE_PATH}/tf_activity_sparse.json`;

class DataManager {
  constructor() {
    this.geneData = {}; // 已加载的基因数据 { geneName: { cellId: value } }
    this.tfData = {};   // 已加载的TF数据
    this.geneSparseMatrix = null; // 完整的基因稀疏矩阵（按需加载）
    this.tfSparseMatrix = null;   // 完整的TF稀疏矩阵（按需加载）
    this.isGeneMatrixLoaded = false;
    this.isTFMatrixLoaded = false;
    this.loadingPromises = {}; // 防止重复加载
  }

  // 按需加载单个基因的表达数据
  async loadGeneExpression(geneName) {
    if (this.geneData[geneName]) {
      return this.geneData[geneName];
    }

    // 如果已经在加载中，返回相同的promise
    if (this.loadingPromises[`gene_${geneName}`]) {
      return this.loadingPromises[`gene_${geneName}`];
    }

    const loadPromise = this._loadGeneExpressionImpl(geneName);
    this.loadingPromises[`gene_${geneName}`] = loadPromise;
    
    try {
      const result = await loadPromise;
      delete this.loadingPromises[`gene_${geneName}`];
      return result;
    } catch (error) {
      delete this.loadingPromises[`gene_${geneName}`];
      throw error;
    }
  }

  async _loadGeneExpressionImpl(geneName) {
    // 如果稀疏矩阵还没加载，先加载
    if (!this.isGeneMatrixLoaded) {
      console.log('Loading gene expression sparse matrix...');
      this.geneSparseMatrix = await loadSparseMatrix(GENE_EXPRESSION_SPARSE_FILE);
      this.isGeneMatrixLoaded = true;
      console.log(`Gene sparse matrix loaded with ${Object.keys(this.geneSparseMatrix).length} genes`);
    }

    // 获取该基因的数据
    const geneData = this.geneSparseMatrix[geneName] || {};
    this.geneData[geneName] = geneData;
    
    console.log(`Loaded gene ${geneName} with ${Object.keys(geneData).length} cells`);
    return geneData;
  }

  // 按需加载单个TF的活性数据
  async loadTFActivity(tfName) {
    if (this.tfData[tfName]) {
      return this.tfData[tfName];
    }

    if (this.loadingPromises[`tf_${tfName}`]) {
      return this.loadingPromises[`tf_${tfName}`];
    }

    const loadPromise = this._loadTFActivityImpl(tfName);
    this.loadingPromises[`tf_${tfName}`] = loadPromise;
    
    try {
      const result = await loadPromise;
      delete this.loadingPromises[`tf_${tfName}`];
      return result;
    } catch (error) {
      delete this.loadingPromises[`tf_${tfName}`];
      throw error;
    }
  }

  async _loadTFActivityImpl(tfName) {
    if (!this.isTFMatrixLoaded) {
      console.log('Loading TF activity sparse matrix...');
      this.tfSparseMatrix = await loadSparseMatrix(TF_ACTIVITY_SPARSE_FILE);
      this.isTFMatrixLoaded = true;
      console.log(`TF sparse matrix loaded with ${Object.keys(this.tfSparseMatrix).length} TFs`);
    }

    const tfData = this.tfSparseMatrix[tfName] || {};
    this.tfData[tfName] = tfData;
    
    console.log(`Loaded TF ${tfName} with ${Object.keys(tfData).length} cells`);
    return tfData;
  }

  // 批量加载多个特征（用于比较模式）
  async loadMultipleFeatures(featureNames) {
    const results = {};
    
    for (const featureName of featureNames) {
      // 判断是基因还是TF（根据命名规则或类别）
      if (featureName.includes('_activity') || featureName.includes('Activity')) {
        results[featureName] = await this.loadTFActivity(featureName);
      } else {
        results[featureName] = await this.loadGeneExpression(featureName);
      }
    }
    
    return results;
  }

  // 预加载特征列表（可选，用于提前加载索引）
  async preloadFeatureIndex() {
    if (!this.isGeneMatrixLoaded) {
      this.geneSparseMatrix = await loadSparseMatrix(GENE_EXPRESSION_SPARSE_FILE);
      this.isGeneMatrixLoaded = true;
    }
    if (!this.isTFMatrixLoaded) {
      this.tfSparseMatrix = await loadSparseMatrix(TF_ACTIVITY_SPARSE_FILE);
      this.isTFMatrixLoaded = true;
    }
    
    return {
      genes: Object.keys(this.geneSparseMatrix),
      tfs: Object.keys(this.tfSparseMatrix)
    };
  }

  // 清理缓存
  clearCache() {
    this.geneData = {};
    this.tfData = {};
    this.loadingPromises = {};
  }

  // 获取已加载的特征统计
  getStats() {
    return {
      loadedGenes: Object.keys(this.geneData).length,
      loadedTFs: Object.keys(this.tfData).length,
      totalGenes: this.geneSparseMatrix ? Object.keys(this.geneSparseMatrix).length : 0,
      totalTFs: this.tfSparseMatrix ? Object.keys(this.tfSparseMatrix).length : 0
    };
  }
}

// 创建单例实例
export const dataManager = new DataManager();
