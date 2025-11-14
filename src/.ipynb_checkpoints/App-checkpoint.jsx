import React, { useState, useMemo, useRef, useCallback } from 'react';
import SpatialViewer, { mapValueToColor } from './SpatialViewer'; 
import { 
    MOCK_DATA, 
    ALL_REGIONS, 
    ALL_SLICES, 
    ALL_TRAITS_FLAT, 
    TRAIT_CATEGORIES, 
    SECTION_DATA 
} from './mockData';
import html2canvas from 'html2canvas';

// --- UI Constants & Helpers ---
const MAX_VIEWS = 4; 
const baseButton = "py-2 px-4 text-base rounded transition duration-150 ease-in-out";
const topButton = "px-5 py-3 text-white rounded font-semibold text-base transition duration-150 ease-in-out";

const REGION_COLORS = ALL_REGIONS.reduce((acc, region, index) => {
    acc[region] = `hsl(${index * (360 / ALL_REGIONS.length)}, 70%, 50%)`;
    return acc;
}, {});

// --- ColorBar Component ---
const ColorBar = ({ minMax, mapValueToColor, isLightTheme, onHoverChange, viewIndex }) => {
    if (!minMax || typeof minMax.min !== 'number' || typeof minMax.max !== 'number') {
        return null; 
    }
    
    const height = 200;
    const steps = 50;
    const [hoverValue, setHoverValue] = useState(null); 
    const range = minMax.max - minMax.min;
    const textClass = isLightTheme ? 'text-gray-800' : 'text-white';

    const handleMouseMove = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top; 
        const normalized = 1 - (y / height); 
        const value = minMax.min + normalized * range;
        setHoverValue(value); 
        
        const highlightRange = range * 0.03;
        onHoverChange(viewIndex, [Math.max(minMax.min, value - highlightRange), Math.min(minMax.max, value + highlightRange)]);
    }, [minMax, onHoverChange, range, viewIndex]);

    const handleMouseLeave = useCallback(() => {
        setHoverValue(null);
        onHoverChange(viewIndex, null);
    }, [onHoverChange, viewIndex]);
    
    const hoverTooltipStyle = useMemo(() => {
        if (hoverValue === null || range === 0) return {};
        const normalizedPosition = (hoverValue - minMax.min) / range;
        const topPosition = 5 + height * (1 - normalizedPosition); 
        return { top: topPosition, transform: 'translateY(-50%)' };
    }, [hoverValue, range, minMax.min]);

    return (
        <div className="flex flex-col items-center">
            <span className={`${textClass} text-base mb-1`}>{minMax.max.toFixed(2)}</span>
            <div 
                style={{ height: `${height}px`, width: '20px' }} 
                className="relative cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {Array.from({ length: steps }).map((_, i) => {
                    const normalized = 1 - (i / steps);
                    const value = minMax.min + normalized * range;
                    const [r, g, b, a] = mapValueToColor(value, minMax.min, minMax.max, isLightTheme);
                    return (
                        <div 
                            key={i}
                            style={{ 
                                backgroundColor: `rgb(${r}, ${g}, ${b})`,
                                height: `${height / steps}px`
                            }}
                        />
                    );
                })}
            </div>
            <span className={`${textClass} text-base mt-1`}>{minMax.min.toFixed(2)}</span>
            
            {/* Mouse hover value display */}
            {hoverValue !== null && range > 0 && (
                <div 
                    className="absolute left-7 bg-blue-700 text-white p-2 text-sm rounded shadow-lg pointer-events-none"
                    style={hoverTooltipStyle}
                >
                    {hoverValue.toFixed(2)}
                </div>
            )}
        </div>
    );
};

// --- Compare Selection Modal Component ---
const CompareModal = ({ isOpen, onClose, onStartCompare }) => {
    const [dimension, setDimension] = useState('trait'); 
    const [traitSearch, setTraitSearch] = useState('');
    const [tempSelection, setTempSelection] = useState([]); // 初始化为空数组
    
    // 当模态框打开时，重置选择状态
    React.useEffect(() => {
        if (isOpen) {
            setTempSelection([]);
            setTraitSearch('');
        }
    }, [isOpen]);
    
    const handleToggle = (key) => {
        setTempSelection(prev => {
            if (prev.includes(key)) {
                return prev.length > 1 ? prev.filter(k => k !== key) : prev;
            }
            if (prev.length < MAX_VIEWS) {
                return [...prev, key];
            }
            return prev;
        });
    };
    
    const handleStartCompare = () => {
        const firstSlice = ALL_SLICES[0];
        const firstTrait = ALL_TRAITS_FLAT[0].key;
        
        const newViews = tempSelection.map(key => {
            const isTrait = dimension === 'trait';
            const sliceKey = isTrait ? firstSlice : key;
            const traitKey = isTrait ? key : firstTrait;

            return { key, type: dimension, slice: sliceKey, trait: traitKey };
        });
        
        onStartCompare(newViews);
        onClose();
    };
    
    const filteredTraits = ALL_TRAITS_FLAT.filter(t => 
        t.label.toLowerCase().includes(traitSearch.toLowerCase()) || 
        t.key.toLowerCase().includes(traitSearch.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white p-6 rounded-lg shadow-2xl w-[40rem] border border-gray-300" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-2xl font-bold text-gray-800">Compare Settings</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl leading-none">
                        &times;
                    </button>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 p-3 text-base rounded mb-4">
                    The maximum support for comparison is up to four images.
                </div>
                
                <div className="flex items-center space-x-6 mb-4">
                    <div className="font-bold text-base">Dimension:</div>
                    <label className="flex items-center space-x-2 cursor-pointer text-base">
                        <input type="radio" name="dimension" value="trait" checked={dimension === 'trait'} onChange={() => setDimension('trait')} />
                        <span>Trait</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer text-base">
                        <input type="radio" name="dimension" value="section" checked={dimension === 'section'} onChange={() => setDimension('section')} />
                        <span>Section</span>
                    </label>
                </div>

                <div className="max-h-80 overflow-y-auto mb-4 p-3 border rounded border-gray-300">
                    <p className="text-base text-gray-500 mb-3 font-semibold">Selected: {tempSelection.length}/{MAX_VIEWS}</p>
                    
                    {dimension === 'trait' && (
                        <div className="mb-4 flex border border-gray-300 rounded overflow-hidden">
                            <input
                                type="text"
                                placeholder="Search Traits..."
                                value={traitSearch}
                                onChange={(e) => setTraitSearch(e.target.value)}
                                className="w-full p-2 text-base focus:outline-none text-gray-800"
                            />
                            <button className="bg-gray-100 px-3 hover:bg-gray-200 text-gray-600">🔍</button>
                        </div>
                    )}

                    {dimension === 'trait' ? (
                        TRAIT_CATEGORIES.map(cat => (
                            <div key={cat.key} className="mb-3">
                                <h3 className="font-bold text-gray-600 border-b mb-2 text-base">{cat.label}</h3>
                                {filteredTraits.filter(t => t.category === cat.key).map(trait => (
                                    <label key={trait.key} className="flex items-center space-x-2 cursor-pointer py-1 text-base">
                                        <input
                                            type="checkbox"
                                            checked={tempSelection.includes(trait.key)}
                                            onChange={() => handleToggle(trait.key)}
                                            disabled={!tempSelection.includes(trait.key) && tempSelection.length >= MAX_VIEWS}
                                        />
                                        <span>{trait.label}</span>
                                    </label>
                                ))}
                            </div>
                        ))
                    ) : (
                        // Section Selection
                        SECTION_DATA.flatMap(t => t.sections).map(section => (
                            <label key={section.key} className="flex items-center space-x-2 cursor-pointer py-1 text-base">
                                <input
                                    type="checkbox"
                                    checked={tempSelection.includes(section.key)}
                                    onChange={() => handleToggle(section.key)}
                                    disabled={!tempSelection.includes(section.key) && tempSelection.length >= MAX_VIEWS}
                                />
                                <span>{section.label}</span>
                            </label>
                        ))
                    )}
                </div>
                
                <div className="flex justify-end space-x-3 pt-3 border-t">
                    <button onClick={onClose} className={`${baseButton} text-gray-700 border border-gray-300 hover:bg-gray-100`}>Cancel</button>
                    <button onClick={handleStartCompare} className={`${baseButton} bg-blue-600 text-white hover:bg-blue-700`} disabled={tempSelection.length === 0}>Start Compare</button>
                </div>
            </div>
        </div>
    );
};

// --- Compare Viewer Modal Component ---
const CompareViewerModal = ({ isOpen, onClose, compareViews, pointRadius, isLightTheme, showCellType, onCellTypeToggle }) => {
    const [hoverValueRanges, setHoverValueRanges] = useState({});
    const [localRegionFilters, setLocalRegionFilters] = useState({});
    const viewerContainerRef = useRef(null);

    // 初始化每个视图的独立region filter - 修复问题1：为每个视图创建独立的过滤器状态
    useMemo(() => {
        const initialFilters = {};
        compareViews.forEach((view, index) => {
            // 为每个视图创建独立的过滤器状态，无论比较的是trait还是section
            initialFilters[index] = new Set(ALL_REGIONS);
        });
        setLocalRegionFilters(initialFilters);
    }, [compareViews]);

    // 修复问题1：为每个视图独立过滤数据
    const getFilteredDataForView = useCallback((viewIndex) => {
        const view = compareViews[viewIndex];
        if (!view) return [];
        
        const visibleRegions = localRegionFilters[viewIndex];
        return MOCK_DATA.filter(d => 
            d.slice === view.slice && 
            (visibleRegions ? visibleRegions.has(d.region) : true)
        );
    }, [compareViews, localRegionFilters]);

    // 为每个视图独立计算minMax
    const minMaxMapForViews = useMemo(() => {
        const map = {};
        compareViews.forEach((view, viewIndex) => {
            const dataForView = getFilteredDataForView(viewIndex);
            const traitKey = view.trait;
            
            let minVal = Infinity;
            let maxVal = -Infinity;
            dataForView.forEach(d => {
                const value = d[traitKey];
                if (value < minVal) minVal = value;
                if (value > maxVal) maxVal = value;
            });
            
            map[viewIndex] = { 
                min: isFinite(minVal) ? minVal : 0, 
                max: isFinite(maxVal) ? maxVal : 1 
            };
        });
        return map;
    }, [compareViews, getFilteredDataForView]);

    const handleHoverValueRangeChange = useCallback((viewIndex, range) => {
        setHoverValueRanges(prev => ({
            ...prev,
            [viewIndex]: range
        }));
    }, []);

    const handleLocalToggleRegion = useCallback((viewIndex, region) => {
        setLocalRegionFilters(prev => {
            const newFilters = { ...prev };
            const newSet = new Set(newFilters[viewIndex]);
            newSet.has(region) ? newSet.delete(region) : newSet.add(region);
            newFilters[viewIndex] = newSet;
            return newFilters;
        });
    }, []);

    const handleLocalSetAllRegionsVisible = useCallback((viewIndex) => {
        setLocalRegionFilters(prev => ({
            ...prev,
            [viewIndex]: new Set(ALL_REGIONS)
        }));
    }, []);

    const handleLocalSetClearRegionsVisible = useCallback((viewIndex) => {
        setLocalRegionFilters(prev => ({
            ...prev,
            [viewIndex]: new Set()
        }));
    }, []);

    const textClass = isLightTheme ? 'text-gray-800' : 'text-white';

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-90 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col border border-gray-300">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-300 bg-gray-50 rounded-t-lg">
                    <h2 className="text-2xl font-bold text-gray-800">Comparison View ({compareViews.length} Images)</h2>
                    <div className="flex space-x-3 items-center">
                        <button 
                            onClick={onCellTypeToggle}
                            className={`py-2 px-4 text-base rounded transition duration-150 ease-in-out ${showCellType ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-800'}`}
                        >
                            {showCellType ? 'Show Trait' : 'Show Cell Type'}
                        </button>
                        <button 
                            onClick={onClose}
                            className="py-2 px-4 bg-red-600 text-white text-base rounded hover:bg-red-700 transition duration-150 ease-in-out"
                        >
                            Close Compare
                        </button>
                    </div>
                </div>
                
                {/* Visualization Container */}
                <div 
                    ref={viewerContainerRef} 
                    className="flex-grow p-4 bg-gray-100 rounded-b-lg overflow-auto"
                    style={{ 
                        display: 'grid',
                        gridTemplateColumns: compareViews.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                        gridTemplateRows: compareViews.length <= 2 ? '1fr' : 'repeat(2, 1fr)',
                        gap: '10px',
                        backgroundColor: isLightTheme ? '#F0F0F0' : '#0A0A0A'
                    }}
                >
                    {compareViews.map((view, index) => {
                        const dataSlice = getFilteredDataForView(index);
                        const traitKey = view.trait;
                        const minMax = minMaxMapForViews[index];
                        const traitLabel = ALL_TRAITS_FLAT.find(t => t.key === traitKey)?.label || traitKey;
                        const viewHoverRange = hoverValueRanges[index] || null;
                        const localVisibleRegions = localRegionFilters[index] || new Set(ALL_REGIONS);

                        return (
                            <div 
                                key={`${view.slice}-${view.trait}-${index}`} 
                                className="w-full h-full relative bg-white rounded-lg border border-gray-300 overflow-hidden"
                            >
                                <SpatialViewer 
                                    data={dataSlice} 
                                    traitKey={traitKey}
                                    minMax={minMax}
                                    title={`Section: ${view.slice} | Trait: ${traitLabel}`}
                                    pointRadius={pointRadius}
                                    hoverValueRange={viewHoverRange}
                                    isLightTheme={isLightTheme}
                                    showCellType={showCellType}
                                    // 传递独立的region filter props
                                    localVisibleRegions={localVisibleRegions}
                                    localToggleRegion={(region) => handleLocalToggleRegion(index, region)}
                                    localSetAllRegionsVisible={() => handleLocalSetAllRegionsVisible(index)}
                                    localSetClearRegionsVisible={() => handleLocalSetClearRegionsVisible(index)}
                                />
                                
                                {/* Colorbar - 修复问题2：放在左侧 */}
                                <div className="absolute top-0 left-0 h-full flex flex-col justify-center p-4 z-10">
                                    {!showCellType && minMax && (
                                        <div className="absolute top-1/2 -translate-y-1/2 left-4">
                                            <ColorBar 
                                                minMax={minMax} 
                                                mapValueToColor={mapValueToColor}
                                                isLightTheme={isLightTheme}
                                                onHoverChange={handleHoverValueRangeChange} 
                                                viewIndex={index}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

function App() {
  const [pointRadius, setPointRadius] = useState(25); 
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isCompareViewerOpen, setIsCompareViewerOpen] = useState(false);
  const [compareViews, setCompareViews] = useState([]);
  const [traitSearch, setTraitSearch] = useState(''); 
  const [isLightTheme, setIsLightTheme] = useState(false); 
  const [showCellType, setShowCellType] = useState(false); 
  const [visibleRegions, setVisibleRegions] = useState(new Set(ALL_REGIONS));
  
  const [views, setViews] = useState([{ 
      key: ALL_SLICES[0], 
      type: 'slice', 
      slice: ALL_SLICES[0], 
      trait: ALL_TRAITS_FLAT[0].key 
  }]);

  const viewerContainerRef = useRef(null); 

  // --- Theme Classes ---
  const mainBgClass = isLightTheme ? 'bg-gray-50' : 'bg-gray-800';
  const controlPanelClass = isLightTheme ? 'bg-white border-r border-gray-200' : 'bg-gray-900 border-r border-gray-700';
  const textClass = isLightTheme ? 'text-gray-800' : 'text-white';
  const topBarClass = isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-700';

  // --- Data & Range Calculation ---
  
  const filteredData = useMemo(() => {
    return MOCK_DATA.filter(d => visibleRegions.has(d.region));
  }, [visibleRegions]);

  const minMaxMap = useMemo(() => {
    const map = {};
    ALL_TRAITS_FLAT.forEach(trait => {
      let minVal = Infinity;
      let maxVal = -Infinity;
      filteredData.forEach(d => {
        const value = d[trait.key];
        if (value < minVal) minVal = value;
        if (value > maxVal) maxVal = value;
      });
      map[trait.key] = { min: isFinite(minVal) ? minVal : 0, max: isFinite(maxVal) ? maxVal : 1 };
    });
    return map;
  }, [filteredData]);
  
  const filteredLeftTraits = ALL_TRAITS_FLAT.filter(t => 
    t.label.toLowerCase().includes(traitSearch.toLowerCase()) || 
    t.key.toLowerCase().includes(traitSearch.toLowerCase())
  );

  // --- Core Functions (Callbacks) ---
  
  const toggleRegion = useCallback((region) => {
    setVisibleRegions(prev => {
        const newSet = new Set(prev);
        newSet.has(region) ? newSet.delete(region) : newSet.add(region);
        return newSet;
    });
  }, []); 

  const setAllRegionsVisible = useCallback(() => {
      setVisibleRegions(new Set(ALL_REGIONS));
  }, []); 
  
  const setClearRegionsVisible = useCallback(() => {
      setVisibleRegions(new Set());
  }, []); 

  const handleStartCompare = useCallback((newViews) => {
    setCompareViews(newViews);
    setIsCompareViewerOpen(true);
  }, []);

  const handleCloseCompareViewer = useCallback(() => {
    setIsCompareViewerOpen(false);
    setCompareViews([]);
  }, []);

  // 截图功能
  const handleDownloadImage = async () => {
    if (viewerContainerRef.current) {
        alert("Generating Image, please wait...");
        await new Promise(resolve => setTimeout(resolve, 10)); 
        
        const canvas = await html2canvas(viewerContainerRef.current, { useCORS: true, allowTaint: true });
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `Spatial_Viewer_Export.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert("Image downloaded!");
    }
  };

  const currentTraitKey = views.length === 1 ? views[0].trait : null;
  const currentSliceKey = views[0].slice;
  const isSingleView = views.length === 1;

  // --- Render ---
  return (
    <div className={`flex h-screen ${mainBgClass} font-sans`}>
      
      {/* --- Top Bar --- */}
      <div className={`absolute top-0 left-0 right-0 h-14 ${topBarClass} border-b flex items-center justify-end px-4 z-40`}>
        <div className="flex space-x-4">
            {/* Point Size Slider */}
            <div className={`flex items-center space-x-3 text-base ${textClass}`}>
                <span>Cell Size:</span>
                <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={pointRadius} 
                    onChange={(e) => setPointRadius(Number(e.target.value))}
                    className="w-28 h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer range-lg"
                />
            </div>

            {/* Theme Toggle */}
            <button 
                onClick={() => setIsLightTheme(!isLightTheme)}
                className={`${topButton} bg-gray-500 hover:bg-gray-600`}
                title={isLightTheme ? "Switch to Dark Theme" : "Switch to Light Theme"}
            >
                {isLightTheme ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button 
                onClick={() => setIsCompareModalOpen(true)}
                className={`${topButton} bg-blue-600 hover:bg-blue-700`}
            >
                Compare
            </button>
            <button
                onClick={handleDownloadImage}
                className={`${topButton} bg-gray-600 hover:bg-gray-700`}
            >
                Download gsMap Results
            </button>
        </div>
      </div>
      
      {/* --- Main Content Area --- */}
      <div className="flex flex-grow mt-14">
      
        {/* --- Left Control Panel (Trait & Section Selection) --- */}
        <div className={`w-72 p-6 ${controlPanelClass} flex flex-col space-y-6 overflow-y-auto`}>
          
          {/* Trait Search */}
          <div className="pb-4 border-b border-gray-700">
              <h2 className={`text-lg font-semibold mb-3 ${textClass}`}>Trait</h2>
              <div className="flex border border-gray-400 rounded overflow-hidden">
                  <input
                      type="text"
                      placeholder="Search Traits..."
                      value={traitSearch}
                      onChange={(e) => setTraitSearch(e.target.value)}
                      className="w-full p-2 text-base focus:outline-none text-gray-800"
                  />
                  <button className="bg-gray-100 px-3 hover:bg-gray-200 text-gray-600">🔍</button>
              </div>
          </div>

          {/* Trait Selection (Categorized) */}
          <div className="pb-4 border-b border-gray-700 space-y-4">
            {TRAIT_CATEGORIES.map(cat => (
                <div key={cat.key}>
                    <h3 className={`text-base font-bold border-b mb-2 ${textClass} border-gray-700`}>{cat.label}</h3>
                    {filteredLeftTraits.filter(t => t.category === cat.key).map(trait => (
                        <button
                            key={trait.key}
                            onClick={() => setViews([{ key: trait.key, type: 'trait', slice: views[0].slice, trait: trait.key }])}
                            className={`w-full text-left py-2 px-3 mb-1 rounded text-base ${
                                isSingleView && views[0].trait === trait.key 
                                    ? 'bg-blue-600 text-white font-medium' 
                                    : `${textClass} hover:bg-gray-700`
                            }`}
                        >
                          {trait.label}
                        </button>
                    ))}
                </div>
            ))}
          </div>

          {/* Section Selection (Categorized) */}
          <div className="pb-4 space-y-4">
             <h2 className={`text-lg font-semibold mb-3 ${textClass}`}>Section</h2>
             {SECTION_DATA.map(tissueGroup => (
                <div key={tissueGroup.tissue}>
                    <h3 className={`text-base font-bold mb-2 ${textClass}`}>{tissueGroup.tissue}</h3>
                    {tissueGroup.sections.map(section => (
                        <button
                            key={section.key}
                            onClick={() => setViews([{ key: section.key, type: 'slice', slice: section.key, trait: views[0].trait }])}
                            className={`w-full text-left py-2 px-3 mb-1 rounded text-base ${
                                isSingleView && views[0].slice === section.key
                                    ? 'bg-blue-600 text-white font-medium' 
                                    : `${textClass} hover:bg-gray-700`
                            }`}
                        >
                          {section.label}
                        </button>
                    ))}
                </div>
             ))}
          </div>
        </div>

        {/* --- Center Main Visualization Area --- */}
        <div className={`flex-grow p-5 relative flex flex-col ${mainBgClass}`}>
          
          {/* View Info and Controls */}
          <div className={`flex justify-between items-center mb-3 h-12 ${isLightTheme ? 'bg-gray-100' : 'bg-gray-900'} rounded-t p-3`}>
            <h2 className={`text-xl font-semibold ${textClass}`}>
                {isSingleView 
                    ? `Trait: ${ALL_TRAITS_FLAT.find(t => t.key === currentTraitKey)?.label || currentTraitKey} | Section: ${currentSliceKey}`
                    : `Comparison View (${views.length} Images)`
                }
            </h2>
            <div className="flex space-x-3 items-center">
                {/* Show Cell Type Toggle */}
                <button 
                    onClick={() => setShowCellType(!showCellType)}
                    className={`${baseButton} ${showCellType ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-800'}`}
                    title="Toggle between Trait expression and Cell Type visualization"
                >
                    {showCellType ? 'Show Trait' : 'Show Cell Type'}
                </button>
            </div>
          </div>
          
          {/* Visualization Container (Grid Layout) */}
          <div 
            ref={viewerContainerRef} 
            className="flex-grow rounded-b-lg overflow-hidden relative" 
            style={{ 
              display: 'grid',
              gridTemplateColumns: views.length === 1 ? '1fr' : 'repeat(2, 1fr)',
              gridTemplateRows: views.length <= 2 ? '1fr' : 'repeat(2, 1fr)',
              backgroundColor: isLightTheme ? '#F0F0F0' : '#0A0A0A'
            }}
          >
            {views.map((view, index) => {
              const dataSlice = filteredData.filter(d => d.slice === view.slice); 
              const traitKey = view.trait;
              const minMax = minMaxMap[traitKey];
              const traitLabel = ALL_TRAITS_FLAT.find(t => t.key === traitKey)?.label || traitKey;
              
              const cols = views.length === 1 ? 1 : 2;
              const isLastColumn = (index + 1) % cols === 0;
              const isLastRow = index >= views.length - cols;

              return (
                <div 
                  key={`${view.slice}-${view.trait}-${index}-${isLightTheme}`} 
                  className="w-full h-full relative"
                  style={{
                    borderRight: !isLastColumn ? '1px solid #333' : 'none',
                    borderBottom: !isLastRow && views.length > 2 ? '1px solid #333' : 'none',
                  }}
                >
                  <SpatialViewer 
                    data={dataSlice} 
                    traitKey={traitKey}
                    minMax={minMax}
                    title={`Section: ${view.slice} | Trait: ${traitLabel}`}
                    pointRadius={pointRadius}
                    hoverValueRange={null} 
                    isLightTheme={isLightTheme}
                    showCellType={showCellType}
                    // 主视图使用这些 props
                    visibleRegions={visibleRegions}
                    toggleRegion={toggleRegion}
                    setAllRegionsVisible={setAllRegionsVisible}
                    setClearRegionsVisible={setClearRegionsVisible}
                  />
                </div>
              );
            })}
          </div>
        </div>
        
      </div>
      
      {/* Compare Selection Modal */}
      <CompareModal 
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        onStartCompare={handleStartCompare}
      />
      
      {/* Compare Viewer Modal */}
      <CompareViewerModal 
        isOpen={isCompareViewerOpen}
        onClose={handleCloseCompareViewer}
        compareViews={compareViews}
        pointRadius={pointRadius}
        isLightTheme={isLightTheme}
        showCellType={showCellType}
        onCellTypeToggle={() => setShowCellType(!showCellType)}
      />
      
    </div>
  );
}

export default App;
