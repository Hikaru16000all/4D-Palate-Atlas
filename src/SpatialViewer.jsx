// src/SpatialViewer.jsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { DeckGL } from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { OrthographicView, OrthographicController } from '@deck.gl/core';

// --- 细胞类型颜色映射 ---
const CELL_TYPE_COLORS = {
  'Epithelial': '#FADF92',
  'Palatal Mesenchyme': '#B43E44', 
  'Odontogenic': '#F2C9D5',
  'Fibroblastic': '#904869',
  'Osteogenic': '#496496'
};

// 将十六进制颜色转换为 RGB 数组
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16), 
    parseInt(result[3], 16),
    255
  ] : [128, 128, 128, 255];
};

// --- Color definitions & mapValueToColor (保持不变) ---
const MIN_COLOR_LIGHT = [255, 204, 204]; 
const MAX_COLOR_LIGHT = [204, 0, 0];    
const MIN_COLOR_DARK = [0, 0, 102];     
const MAX_COLOR_DARK = [173, 216, 230]; 

export function mapValueToColor(value, min, max, isLightTheme) { 
    if (min === max) {
        return isLightTheme ? [128, 128, 128, 255] : [128, 128, 128, 255]; 
    }
    const ratio = (value - min) / (max - min);
    const minColor = isLightTheme ? MIN_COLOR_LIGHT : MIN_COLOR_DARK;
    const maxColor = isLightTheme ? MAX_COLOR_LIGHT : MAX_COLOR_DARK;

    const r = minColor[0] + ratio * (maxColor[0] - minColor[0]);
    const g = minColor[1] + ratio * (maxColor[1] - minColor[1]);
    const b = minColor[2] + ratio * (maxColor[2] - minColor[2]);

    return [r, g, b, 255];
}

// 计算数据的边界和合适的初始视图
const calculateInitialViewState = (data) => {
  if (!data || data.length === 0) {
    return { target: [0, 0, 0], zoom: -2 };
  }

  // 计算数据的边界
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  data.forEach(cell => {
    if (cell.x < minX) minX = cell.x;
    if (cell.x > maxX) maxX = cell.x;
    if (cell.y < minY) minY = cell.y;
    if (cell.y > maxY) maxY = cell.y;
  });

  // 计算中心点
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  // 调试信息
  console.log('=== DEBUG: Initial View State Calculation ===');
  console.log(`Data points: ${data.length}`);
  console.log(`X range: ${minX.toFixed(2)} to ${maxX.toFixed(2)} (width: ${(maxX - minX).toFixed(2)})`);
  console.log(`Y range: ${minY.toFixed(2)} to ${maxY.toFixed(2)} (height: ${(maxY - minY).toFixed(2)})`);
  console.log(`Center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`);
  
  // 尝试不同的 zoom 值，找出最佳值
  const testZooms = [-3.5, -3, -2.5, -2, -1.5, -1];
  let recommendedZoom = -2; // 默认
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  if (width > 0 && height > 0) {
    // 基于数据范围推荐 zoom
    const maxDimension = Math.max(width, height);
    if (maxDimension > 2000) {
      recommendedZoom = -3.5;
    } else if (maxDimension > 1000) {
      recommendedZoom = -3;
    } else if (maxDimension > 500) {
      recommendedZoom = -2.5;
    } else if (maxDimension > 200) {
      recommendedZoom = -2;
    } else {
      recommendedZoom = -1.5;
    }
  }
  
  console.log(`Recommended zoom: ${recommendedZoom} (${Math.round(100 * Math.pow(2, recommendedZoom))}%)`);
  
  return {
    target: [centerX, centerY, 0],
    zoom: recommendedZoom
  };
};

// ---------------------------
// 核心 Viewer 组件 (每个切片)
// ---------------------------
const SpatialViewer = ({ 
  data, 
  traitKey, 
  minMax, 
  title, 
  pointRadius, 
  hoverValueRange, 
  isLightTheme, 
  showCellType,
  // 主视图的 region filter props (向后兼容)
  visibleRegions,
  toggleRegion,
  setAllRegionsVisible,
  setClearRegionsVisible,
  // 比较视图的独立 region filter props (可选)
  localVisibleRegions,
  localToggleRegion,
  localSetAllRegionsVisible,
  localSetClearRegionsVisible,
  // 区域信息
  ALL_REGIONS = [],
  REGION_COLORS = {}
}) => {
  
  const [hoverInfo, setHoverInfo] = useState(null);
  const [webglError, setWebglError] = useState(null);

  // 计算初始视图状态 - 只在数据首次加载时计算
  const initialViewState = useMemo(() => {
    return calculateInitialViewState(data);
  }, [data.length]); // 只在数据长度变化时重新计算

  const [viewState, setViewState] = useState(initialViewState);

  // 当数据长度变化时（切换切片或过滤），重置视图状态
  useEffect(() => {
    setViewState(calculateInitialViewState(data));
  }, [data.length]);

  const themeTextClass = isLightTheme ? 'text-gray-800' : 'text-white';
  const themeBgClass = isLightTheme ? 'bg-gray-100 border-gray-300' : 'bg-gray-900 border-gray-700';

  // 决定使用哪种 region filter (优先使用 local 版本用于比较模式)
  const currentVisibleRegions = localVisibleRegions !== undefined ? localVisibleRegions : visibleRegions;
  const currentToggleRegion = localToggleRegion !== undefined ? localToggleRegion : toggleRegion;
  const currentSetAllRegionsVisible = localSetAllRegionsVisible !== undefined ? localSetAllRegionsVisible : setAllRegionsVisible;
  const currentSetClearRegionsVisible = localSetClearRegionsVisible !== undefined ? localSetClearRegionsVisible : setClearRegionsVisible;

  // 添加视图状态变化处理
  const handleViewStateChange = useCallback(({ viewState }) => {
    if (viewState) {
      setViewState(viewState);
    }
  }, []);

  // 处理手动zoom变化
  const handleZoomChange = useCallback((newZoom) => {
    setViewState(prev => ({
      ...prev,
      zoom: newZoom
    }));
  }, []);

  // 修复：确保 minMax 有默认值
  const safeMinMax = useMemo(() => {
    if (!minMax || typeof minMax.min !== 'number' || typeof minMax.max !== 'number') {
      console.warn(`minMax is undefined for trait: ${traitKey}, using default values`);
      return { min: 0, max: 1 };
    }
    return minMax;
  }, [minMax, traitKey]);

  const layers = useMemo(() => [
    new ScatterplotLayer({
      id: `cell-layer-${traitKey}-${title}-${isLightTheme}-${data.length}`, 
      data: data, 
      pickable: true,
      opacity: 0.9,
      stroked: false,
      filled: true,
      radiusMinPixels: 1, 
      radiusScale: pointRadius / 10, 
      
      getPosition: d => [d.x, d.y],
      
      getFillColor: d => {
        if (showCellType) {
          // 使用细胞类型颜色
          const cellType = d.region;
          const hexColor = CELL_TYPE_COLORS[cellType] || '#808080'; // 默认灰色
          return hexToRgb(hexColor);
        }
        
        const value = d[traitKey] || safeMinMax.min;
        const color = mapValueToColor(value, safeMinMax.min, safeMinMax.max, isLightTheme);
        
        if (hoverValueRange && 
            value >= hoverValueRange[0] && 
            value <= hoverValueRange[1]) {
            return [0, 255, 0, 255]; 
        }
        
        return color;
      },
      
      getRadius: 10, 
      
      onHover: info => {
        setHoverInfo(info.object ? { ...info.object, x: info.x, y: info.y } : null);
      }
    }),
  ], [data, traitKey, title, isLightTheme, pointRadius, showCellType, safeMinMax, hoverValueRange]);

  // 修复：改进 WebGL 配置，添加错误处理
  const glOptions = useMemo(() => ({
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
    antialias: false,
    stencil: false,
    depth: false,
    failIfMajorPerformanceCaveat: false,
    // 添加更多兼容性选项
    premultipliedAlpha: false
  }), []);

  // WebGL 错误处理
  const handleWebGLInitialized = useCallback((gl) => {
    console.log('WebGL context initialized successfully');
    setWebglError(null);
  }, []);

  const handleWebGLError = useCallback((error) => {
    console.error('WebGL error:', error);
    setWebglError('WebGL initialization failed. Some features may not work properly.');
  }, []);

  return (
    <div className={`relative w-full h-full ${themeBgClass} border`}> 
      <div className={`absolute top-2 left-2 ${themeTextClass} font-semibold text-lg z-10`}>{title}</div>
      
      {webglError && (
        <div className={`absolute top-10 left-2 right-2 p-3 rounded z-20 ${
          isLightTheme ? 'bg-yellow-100 text-yellow-800' : 'bg-yellow-900 text-yellow-200'
        }`}>
          <strong>Warning:</strong> {webglError}
        </div>
      )}
      
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={{
            type: OrthographicController,
            dragPan: true,
            scrollZoom: true,
            viewState: { '2d-view': true } 
        }} 
        layers={layers}
        views={new OrthographicView({ id: '2d-view' })}
        glOptions={glOptions}
        onWebGLInitialized={handleWebGLInitialized}
        onError={handleWebGLError}
        onLoad={() => console.log(`DeckGL loaded successfully for ${title}`)}
        onResize={(width, height) => console.log(`DeckGL ${title} resized to ${width}x${height}`)}
      />
      
      {hoverInfo && (
        <div className={`absolute z-10 p-2 rounded shadow-lg text-base ${isLightTheme ? 'bg-white' : 'bg-gray-800'} ${themeTextClass}`} style={{ left: hoverInfo.x + 10, top: hoverInfo.y - 10 }}>
          <div><strong className="text-base">ID:</strong> {hoverInfo.id}</div>
          <div><strong className="text-base">Region:</strong> {hoverInfo.region}</div>
          <div><strong className="text-base">{traitKey}:</strong> {hoverInfo[traitKey]?.toFixed(2)}</div>
        </div>
      )}
      
      {/* Zoom Level Drag Bar */}
      <div className={`absolute bottom-4 left-4 p-3 ${isLightTheme ? 'bg-white bg-opacity-80' : 'bg-gray-800 bg-opacity-80'} rounded max-w-xs z-20`}>
          <h4 className={`font-bold pb-1 text-base ${themeTextClass}`}>Zoom Level: {Math.round(100 * Math.pow(2, viewState.zoom))}%</h4>
          <input 
              type="range" 
              min="-3" 
              max="2"   
              step="0.1"
              value={viewState.zoom} 
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer range-lg"
          />
      </div>

      {/* Cell Type Filter UI - 现在使用当前决定的 region filter */}
      {ALL_REGIONS.length > 0 && (
        <div className={`absolute top-2 right-4 p-3 text-sm ${isLightTheme ? 'bg-white bg-opacity-80' : 'bg-gray-800 bg-opacity-80'} rounded max-h-[80%] overflow-y-auto z-20`}>
            <h4 className={`font-bold border-b pb-1 mb-2 text-base ${themeTextClass} border-gray-700`}>Cell Type Filter</h4>
            
            <div className="flex justify-between text-right text-gray-400 pb-2">
                <button onClick={currentSetAllRegionsVisible} className="hover:underline text-sm">All</button>
                <button onClick={currentSetClearRegionsVisible} className="hover:underline text-sm">Clear</button>
            </div>

            <div className="space-y-2">
                {ALL_REGIONS.map(region => (
                    <label key={region} className={`flex items-center space-x-2 py-1 cursor-pointer text-sm ${themeTextClass} ${currentVisibleRegions && currentVisibleRegions.has(region) ? '' : 'opacity-40'}`}>
                        <input
                            type="checkbox"
                            checked={currentVisibleRegions && currentVisibleRegions.has(region)}
                            onChange={() => currentToggleRegion && currentToggleRegion(region)}
                            style={{ 
                              accentColor: CELL_TYPE_COLORS[region] || REGION_COLORS[region] 
                            }} 
                        />
                        <span style={{ 
                          backgroundColor: CELL_TYPE_COLORS[region] || REGION_COLORS[region], 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%' 
                        }}></span>
                        <span className="text-sm">{region}</span>
                    </label>
                ))}
            </div>
        </div>
      )}
      
    </div>
  );
};

export default SpatialViewer;