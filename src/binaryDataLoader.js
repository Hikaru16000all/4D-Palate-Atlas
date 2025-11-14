// src/binaryDataLoader.js
class BinaryDataLoader {
    constructor(basePath = './data/binary') {
        this.basePath = basePath;
        this.metadata = null;
        this.baseData = null;
        this.loadedFeatures = new Map(); // 缓存已加载的特征
    }

    async init() {
        try {
            // 加载元数据
            this.metadata = await this._loadJSON(`${this.basePath}/metadata.json`);
            
            // 加载基础数据
            this.baseData = await this._loadBaseData();
            
            console.log('Binary data loader initialized', {
                totalCells: this.baseData.cellIds.length,
                totalGenes: this.metadata.genes.total,
                totalTFs: this.metadata.tfs.total
            });
            
            return true;
        } catch (error) {
            console.error('Failed to initialize binary data loader:', error);
            throw error;
        }
    }

    async _loadBaseData() {
        const [cellIds, coordinates, sections, celltypes] = await Promise.all([
            this._loadCellIds(),
            this._loadCoordinates(),
            this._loadSections(),
            this._loadCellTypes()
        ]);

        // 构建基础数据数组
        const baseData = [];
        for (let i = 0; i < cellIds.length; i++) {
            baseData.push({
                id: cellIds[i],
                x: coordinates[i].x,
                y: coordinates[i].y,
                slice: sections[i],
                region: celltypes[i]
            });
        }

        return {
            cellIds,
            coordinates,
            sections,
            celltypes,
            baseData
        };
    }

    async _loadCellIds() {
        const buffer = await this._fetchBinary(`${this.basePath}/base/cell_ids.bin`);
        const view = new DataView(buffer);
        let offset = 0;
        
        const count = view.getUint32(offset, true);
        offset += 4;
        
        const cellIds = [];
        for (let i = 0; i < count; i++) {
            const strLength = view.getUint32(offset, true);
            offset += 4;
            
            const strBytes = new Uint8Array(buffer, offset, strLength);
            offset += strLength;
            
            cellIds.push(new TextDecoder().decode(strBytes));
        }
        
        return cellIds;
    }

    async _loadCoordinates() {
        const buffer = await this._fetchBinary(`${this.basePath}/base/coordinates.bin`);
        const view = new DataView(buffer);
        let offset = 0;
        
        const count = view.getUint32(offset, true);
        offset += 4;
        
        const coordinates = [];
        for (let i = 0; i < count; i++) {
            coordinates.push({
                x: view.getFloat32(offset, true),
                y: view.getFloat32(offset + 4, true)
            });
            offset += 8;
        }
        
        return coordinates;
    }

    async _loadSections() {
        return this._loadStringArray(`${this.basePath}/base/sections.bin`);
    }

    async _loadCellTypes() {
        return this._loadStringArray(`${this.basePath}/base/celltypes.bin`);
    }

    async _loadStringArray(filePath) {
        const buffer = await this._fetchBinary(filePath);
        const view = new DataView(buffer);
        let offset = 0;
        
        const count = view.getUint32(offset, true);
        offset += 4;
        
        const strings = [];
        for (let i = 0; i < count; i++) {
            const strLength = view.getUint32(offset, true);
            offset += 4;
            
            const strBytes = new Uint8Array(buffer, offset, strLength);
            offset += strLength;
            
            strings.push(new TextDecoder().decode(strBytes));
        }
        
        return strings;
    }

    async loadFeature(featureName, category = 'genes') {
        // 检查缓存
        if (this.loadedFeatures.has(featureName)) {
            return this.loadedFeatures.get(featureName);
        }

        const filePath = `${this.basePath}/${category}/${featureName}.bin`;
        
        try {
            const buffer = await this._fetchBinary(filePath);
            const featureData = this._parseFeatureBinary(buffer);
            
            // 缓存结果
            this.loadedFeatures.set(featureName, featureData);
            
            return featureData;
        } catch (error) {
            console.warn(`Failed to load feature ${featureName}:`, error);
            // 返回全零数组
            return new Float32Array(this.baseData.cellIds.length).fill(0);
        }
    }

    async loadMultipleFeatures(featureNames, category = 'genes') {
        const promises = featureNames.map(name => this.loadFeature(name, category));
        const results = await Promise.all(promises);
        
        const combined = {};
        featureNames.forEach((name, index) => {
            combined[name] = results[index];
        });
        
        return combined;
    }

    _parseFeatureBinary(buffer) {
        const view = new DataView(buffer);
        let offset = 0;
        
        const nonZeroCount = view.getUint32(offset, true);
        offset += 4;
        
        // 创建全零数组
        const featureArray = new Float32Array(this.baseData.cellIds.length).fill(0);
        
        // 填充非零值
        for (let i = 0; i < nonZeroCount; i++) {
            const cellIndex = view.getUint32(offset, true);
            const value = view.getFloat32(offset + 4, true);
            offset += 8;
            
            if (cellIndex < featureArray.length) {
                featureArray[cellIndex] = value;
            }
        }
        
        return featureArray;
    }

    async _fetchBinary(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }
        return response.arrayBuffer();
    }

    async _loadJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }
        return response.json();
    }

    // 获取所有可用特征
    getAllFeatures() {
        return {
            genes: this.metadata.genes.features || [],
            tfs: this.metadata.tfs.features || []
        };
    }

    // 获取基础数据（用于初始化）
    getBaseData() {
        return this.baseData.baseData;
    }

    // 清理缓存
    clearCache() {
        this.loadedFeatures.clear();
    }

    // 获取数据统计
    getStats() {
        return {
            totalCells: this.baseData.cellIds.length,
            loadedFeatures: this.loadedFeatures.size,
            genes: this.metadata.genes.total,
            tfs: this.metadata.tfs.total
        };
    }
}

// 创建单例实例
export const binaryDataLoader = new BinaryDataLoader();