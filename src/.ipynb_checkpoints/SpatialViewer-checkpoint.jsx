// src/SpatialViewer.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { DeckGL } from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { OrthographicView, OrthographicController } from '@deck.gl/core';
import { ALL_REGIONS } from './mockData'; 

// --- Color definitions & mapValueToColor (保持不变) ---
const MIN_COLOR_LIGHT = [255, 204, 204]; 
const MAX_COLOR_LIGHT = [204, 0, 0];    
const MIN_COLOR_DARK = [0, 0, 102];     
const MAX_COLOR_DARK = [173, 216, 230]; 

const REGION_COLORS = ALL_REGIONS.reduce((acc, region, index) => {
    acc[region] = `hsl(${index * (360 / ALL_REGIONS.length)}, 70%, 50%)`;
    return acc;
}, {});

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
  localSetClearRegionsVisible
}) => {
  
  const [hoverInfo, setHoverInfo] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(0); 

  const themeTextClass = isLightTheme ? 'text-gray-800' : 'text-white';
  const themeBgClass = isLightTheme ? 'bg-gray-100 border-gray-300' : 'bg-gray-900 border-gray-700';

  // 决定使用哪种 region filter (优先使用 local 版本用于比较模式)
  const currentVisibleRegions = localVisibleRegions !== undefined ? localVisibleRegions : visibleRegions;
  const currentToggleRegion = localToggleRegion !== undefined ? localToggleRegion : toggleRegion;
  const currentSetAllRegionsVisible = localSetAllRegionsVisible !== undefined ? localSetAllRegionsVisible : setAllRegionsVisible;
  const currentSetClearRegionsVisible = localSetClearRegionsVisible !== undefined ? localSetClearRegionsVisible : setClearRegionsVisible;

  // 确保 ViewState 只包含 OrthographicView 需要的属性
  const INITIAL_VIEW_STATE = useMemo(() => ({ 
      target: [300, 450, 0],
      zoom: zoomLevel
  }), [zoomLevel]);

  // 添加视图状态变化处理
  const handleViewStateChange = useCallback(({ viewState }) => {
    if (viewState && viewState.zoom !== undefined) {
      setZoomLevel(viewState.zoom);
    }
  }, []);

  const layers = [
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
            const hash = d.id.split('_')[1] * 10;
            const r = (hash + 100) % 255; 
            const g = (hash + 150) % 255;
            const b = (hash + 200) % 255;
            return [r, g, b, 255];
        }
        
        const value = d[traitKey] || minMax.min;
        const color = mapValueToColor(value, minMax.min, minMax.max, isLightTheme);
        
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
  ];

  return (
    <div className={`relative w-full h-full ${themeBgClass} border`}> 
      <div className={`absolute top-2 left-2 ${themeTextClass} font-semibold text-lg z-10`}>{title}</div>
      
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={{
            type: OrthographicController,
            dragPan: true,
            scrollZoom: true,
            viewState: { '2d-view': true } 
        }} 
        layers={layers}
        views={new OrthographicView({ id: '2d-view' })}
        onViewStateChange={handleViewStateChange}
        glOptions={{ preserveDrawingBuffer: true }}
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
          <h4 className={`font-bold pb-1 text-base ${themeTextClass}`}>Zoom Level: {Math.round(100 * Math.pow(2, zoomLevel))}%</h4>
          <input 
              type="range" 
              min="-3" 
              max="2"   
              step="0.1"
              value={zoomLevel} 
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer range-lg"
          />
      </div>

      {/* Cell Type Filter UI - 现在使用当前决定的 region filter */}
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
                          style={{ accentColor: REGION_COLORS[region] }} 
                      />
                      <span style={{ backgroundColor: REGION_COLORS[region], width: '10px', height: '10px', borderRadius: '50%' }}></span>
                      <span className="text-sm">{region}</span>
                  </label>
              ))}
          </div>
      </div>
      
    </div>
  );
};

export default SpatialViewer;
