import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import SpatialViewer, { mapValueToColor } from './SpatialViewer'; 
import {
  initializeData,
  loadFeatureDataForSlice,
  loadMultipleFeaturesDataForSlice,
  getBaseData,
  ALL_SLICES,
  ALL_REGIONS,
  SECTION_DATA,
  TRAIT_CATEGORIES,
  ALL_TRAITS_FLAT
} from './realDataConstants';
import html2canvas from 'html2canvas';
import SignalTFPage from './pages/SignalTFPage';

// --- UI Constants & Helpers ---
const MAX_VIEWS = 4; 
const baseButton = "py-2 px-4 text-base rounded transition duration-150 ease-in-out";
const topButton = "px-5 py-3 text-white rounded font-semibold text-base transition duration-150 ease-in-out";

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
const CompareModal = ({ 
    isOpen, 
    onClose, 
    onStartCompare, 
    ALL_SLICES, 
    ALL_TRAITS_FLAT, 
    SECTION_DATA, 
    TRAIT_CATEGORIES 
}) => {
    const [dimension, setDimension] = useState('trait'); 
    const [traitSearch, setTraitSearch] = useState('');
    const [tempSelection, setTempSelection] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // 使用防抖搜索，避免频繁过滤
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    
    useEffect(() => {
        if (traitSearch) {
            setIsSearching(true);
            const handler = setTimeout(() => {
                setDebouncedSearch(traitSearch);
                setIsSearching(false);
            }, 150); // 150ms 防抖
            
            return () => {
                clearTimeout(handler);
                setIsSearching(false);
            };
        } else {
            setDebouncedSearch('');
            setIsSearching(false);
        }
    }, [traitSearch]);
    
    // 使用 useMemo 优化过滤计算，使用防抖后的搜索词
    const filteredTraits = useMemo(() => {
        if (!debouncedSearch) {
            // 如果没有搜索词，确保每个类别都显示一些项目
            const traitsByCategory = {};
            TRAIT_CATEGORIES.forEach(cat => {
                traitsByCategory[cat.key] = ALL_TRAITS_FLAT
                    .filter(t => t.category === cat.key)
                    .slice(0, 25); // 每个类别显示前25个项目
            });
            return traitsByCategory;
        }
        
        const searchLower = debouncedSearch.toLowerCase();
        const results = ALL_TRAITS_FLAT.filter(t => 
            t.label.toLowerCase().includes(searchLower) || 
            t.key.toLowerCase().includes(searchLower)
        );
        
        // 限制搜索结果数量，避免渲染过多项目
        return {
            // 对于搜索结果，按类别分组
            gene: results.filter(t => t.category === 'gene').slice(0, 50),
            tf_activity: results.filter(t => t.category === 'tf_activity').slice(0, 50)
        };
    }, [ALL_TRAITS_FLAT, debouncedSearch, TRAIT_CATEGORIES]);

    // 使用 useCallback 优化函数
    const handleToggle = useCallback((key) => {
        setTempSelection(prev => {
            if (prev.includes(key)) {
                return prev.length > 1 ? prev.filter(k => k !== key) : prev;
            }
            if (prev.length < MAX_VIEWS) {
                return [...prev, key];
            }
            return prev;
        });
    }, []);

    const handleStartCompare = useCallback(async () => {
        setLoading(true);
        try {
            const firstSlice = ALL_SLICES[0];
            const firstTrait = ALL_TRAITS_FLAT[0]?.key || 'gene';
            
            const newViews = tempSelection.map(key => {
                const isTrait = dimension === 'trait';
                const sliceKey = isTrait ? firstSlice : key;
                const traitKey = isTrait ? key : firstTrait;

                return { key, type: dimension, slice: sliceKey, trait: traitKey };
            });
            
            await onStartCompare(newViews);
            onClose();
        } catch (error) {
            console.error('Error starting comparison:', error);
        } finally {
            setLoading(false);
        }
    }, [tempSelection, dimension, ALL_SLICES, ALL_TRAITS_FLAT, onStartCompare, onClose]);

    // 搜索输入处理
    const handleSearchChange = useCallback((e) => {
        setTraitSearch(e.target.value);
    }, []);

    // 当模态框打开时的重置逻辑
    useEffect(() => {
        if (isOpen) {
            setTempSelection([]);
            setTraitSearch('');
            setLoading(false);
        }
    }, [isOpen]);
    
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
                                onChange={handleSearchChange}
                                className="w-full p-2 text-base focus:outline-none text-gray-800"
                            />
                            <button className="bg-gray-100 px-3 hover:bg-gray-200 text-gray-600 flex items-center">
                                {isSearching ? '⏳' : '🔍'}
                            </button>
                        </div>
                    )}

                    {dimension === 'trait' ? (
                        TRAIT_CATEGORIES.map(cat => {
                            const categoryTraits = filteredTraits[cat.key] || [];
                            if (categoryTraits.length === 0 && !debouncedSearch) return null;
                            
                            return (
                                <div key={cat.key} className="mb-3">
                                    <h3 className="font-bold text-gray-600 border-b mb-2 text-base">
                                        {cat.label}
                                    </h3>
                                    <div className="max-h-32 overflow-y-auto">
                                        {categoryTraits.map(trait => (
                                            <label key={trait.key} className="flex items-center space-x-2 cursor-pointer py-1 text-base">
                                                <input
                                                    type="checkbox"
                                                    checked={tempSelection.includes(trait.key)}
                                                    onChange={() => handleToggle(trait.key)}
                                                    disabled={!tempSelection.includes(trait.key) && tempSelection.length >= MAX_VIEWS}
                                                />
                                                <span className="truncate">{trait.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
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
                    <button 
                        onClick={handleStartCompare} 
                        className={`${baseButton} bg-blue-600 text-white hover:bg-blue-700 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`} 
                        disabled={tempSelection.length === 0 || loading}
                    >
                        {loading ? 'Loading...' : 'Start Compare'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// 使用 React.memo 包装 CompareModal
const MemoizedCompareModal = React.memo(CompareModal);

// --- Compare Viewer Modal Component ---
const CompareViewerModal = ({ 
    isOpen, 
    onClose, 
    compareViews, 
    pointRadius, 
    isLightTheme, 
    showCellType, 
    onCellTypeToggle, 
    ALL_REGIONS, 
    ALL_TRAITS_FLAT
}) => {
    const [hoverValueRanges, setHoverValueRanges] = useState({});
    const [localRegionFilters, setLocalRegionFilters] = useState({});
    const [compareData, setCompareData] = useState(new Map()); // { `${slice}-${trait}`: data }
    const [loading, setLoading] = useState(false);
    const viewerContainerRef = useRef(null);

    // 生成区域颜色
    const REGION_COLORS = useMemo(() => {
        return ALL_REGIONS.reduce((acc, region, index) => {
            acc[region] = `hsl(${index * (360 / ALL_REGIONS.length)}, 70%, 50%)`;
            return acc;
        }, {});
    }, [ALL_REGIONS]);

    // 初始化每个视图的独立region filter
    useEffect(() => {
        const initialFilters = {};
        compareViews.forEach((view, index) => {
            initialFilters[index] = new Set(ALL_REGIONS);
        });
        setLocalRegionFilters(initialFilters);
    }, [compareViews, ALL_REGIONS]);

    // 加载比较视图的数据
    useEffect(() => {
        const loadCompareData = async () => {
            if (!isOpen || compareViews.length === 0) return;
            
            setLoading(true);
            try {
                console.log('Loading data for comparison views...');
                
                // 收集所有需要加载的特征
                const sliceKeys = [...new Set(compareViews.map(view => view.slice))];
                
                // 为每个切片和特征组合加载数据
                const newCompareData = new Map();
                
                for (const slice of sliceKeys) {
                    // 加载该切片需要的所有特征
                    const sliceTraitKeys = compareViews
                        .filter(view => view.slice === slice)
                        .map(view => view.trait);
                    
                    if (sliceTraitKeys.length > 0) {
                        // 判断特征类型
                        const isTF = sliceTraitKeys[0].includes('_activity');
                        const category = isTF ? 'tfs' : 'genes';
                        
                        const enhancedData = await loadMultipleFeaturesDataForSlice(sliceTraitKeys, slice, category);
                        
                        // 为每个视图存储数据
                        compareViews.forEach(view => {
                            if (view.slice === slice) {
                                const cacheKey = `${view.slice}-${view.trait}`;
                                // 过滤到当前切片
                                newCompareData.set(cacheKey, enhancedData);
                            }
                        });
                    }
                }
                
                setCompareData(newCompareData);
                console.log('Comparison data loaded successfully');
            } catch (error) {
                console.error('Error loading comparison data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadCompareData();
    }, [isOpen, compareViews]);

    // 为每个视图独立过滤数据
    const getFilteredDataForView = useCallback((viewIndex) => {
        const view = compareViews[viewIndex];
        if (!view) return [];
        
        const cacheKey = `${view.slice}-${view.trait}`;
        const viewData = compareData.get(cacheKey) || [];
        const visibleRegions = localRegionFilters[viewIndex];
        
        return viewData.filter(d => 
            visibleRegions ? visibleRegions.has(d.region) : true
        );
    }, [compareViews, compareData, localRegionFilters]);

    // 为每个视图独立计算minMax
    const minMaxMapForViews = useMemo(() => {
        const map = {};
        compareViews.forEach((view, viewIndex) => {
            const dataForView = getFilteredDataForView(viewIndex);
            const traitKey = view.trait;
            
            let minVal = Infinity;
            let maxVal = -Infinity;
            let hasValidData = false;
            
            dataForView.forEach(d => {
                const value = d[traitKey];
                if (typeof value === 'number' && !isNaN(value)) {
                    hasValidData = true;
                    if (value < minVal) minVal = value;
                    if (value > maxVal) maxVal = value;
                }
            });
            
            // 如果没有有效数据，使用默认值
            if (!hasValidData || !isFinite(minVal) || !isFinite(maxVal)) {
                map[viewIndex] = { min: 0, max: 1 };
            } else if (minVal === maxVal) {
                // 如果所有值都相同，设置一个小的范围
                map[viewIndex] = { min: minVal - 0.1, max: maxVal + 0.1 };
            } else {
                map[viewIndex] = { min: minVal, max: maxVal };
            }
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
    }, [ALL_REGIONS]);

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
                    <h2 className="text-2xl font-bold text-gray-800">
                        Comparison View ({compareViews.length} Images) 
                        {loading && ' - Loading...'}
                    </h2>
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
                                {loading && dataSlice.length === 0 && (
                                    <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-20">
                                        <div className="text-lg">Loading data...</div>
                                    </div>
                                )}
                                
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
                                    // 传递区域颜色信息
                                    ALL_REGIONS={ALL_REGIONS}
                                    REGION_COLORS={REGION_COLORS}
                                />
                                
                                {/* Colorbar */}
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
  const [activePage, setActivePage] = useState('atlas');
  const [compareViews, setCompareViews] = useState([]);
  const [traitSearch, setTraitSearch] = useState(''); 
  const [isLightTheme, setIsLightTheme] = useState(false); 
  const [showCellType, setShowCellType] = useState(false); 
  const [visibleRegions, setVisibleRegions] = useState(new Set());
  
  // 数据加载状态
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [enhancedData, setEnhancedData] = useState(new Map()); // 缓存已增强的数据 { `${slice}-${trait}`: data }
  const [viewsData, setViewsData] = useState(new Map()); // { view.key: data }

  const [views, setViews] = useState([{ 
      key: 'default', 
      type: 'slice', 
      slice: ALL_SLICES[0] || 'E125', 
      trait: ALL_TRAITS_FLAT[0]?.key || 'gene' 
  }]);

  const [hoverValueRanges, setHoverValueRanges] = useState({});
  const viewerContainerRef = useRef(null); 

  // 使用 useMemo 优化传递给 CompareModal 的 props
  const memoizedTraits = useMemo(() => ALL_TRAITS_FLAT, [ALL_TRAITS_FLAT]);
  const memoizedSlices = useMemo(() => ALL_SLICES, [ALL_SLICES]);
  const memoizedSections = useMemo(() => SECTION_DATA, [SECTION_DATA]);
  const memoizedCategories = useMemo(() => TRAIT_CATEGORIES, [TRAIT_CATEGORIES]);

  // 使用 useMemo 优化搜索过滤，避免每次渲染都重新计算
  const filteredLeftTraits = useMemo(() => {
    if (!traitSearch) {
      // 如果没有搜索词，只显示前50个项目，减少渲染负担
      return ALL_TRAITS_FLAT.slice(0, 50);
    }
    
    const searchLower = traitSearch.toLowerCase();
    return ALL_TRAITS_FLAT.filter(t => 
      t.label.toLowerCase().includes(searchLower) || 
      t.key.toLowerCase().includes(searchLower)
    ).slice(0, 100); // 即使有搜索词，也限制结果数量
  }, [ALL_TRAITS_FLAT, traitSearch]);

  // 数据加载效果 - 使用新的初始化函数
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        console.log('Starting data initialization...');
        
        await initializeData();
        
        // 设置默认视图
        if (ALL_SLICES.length > 0 && ALL_TRAITS_FLAT.length > 0) {
          setViews([{ 
            key: 'default', 
            type: 'slice', 
            slice: ALL_SLICES[0], 
            trait: ALL_TRAITS_FLAT[0].key 
          }]);
        }
        
        // 初始化可见区域
        setVisibleRegions(new Set(ALL_REGIONS));
        
        console.log('Data initialization complete');
      } catch (error) {
        console.error('Failed to load data:', error);
        setLoadError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // 按需加载特征数据
  const loadDataForView = useCallback(async (view) => {
    const cacheKey = `${view.slice}-${view.trait}`;
    
    // 如果已经加载过，直接返回
    if (enhancedData.has(cacheKey)) {
      return enhancedData.get(cacheKey);
    }
    
    // 否则加载数据
    console.log(`Loading data for ${cacheKey}`);
    
    try {
      // 判断是基因还是TF
      const category = view.trait.includes('_activity') ? 'tfs' : 'genes';
      
      // 加载特征数据
      const sliceData = await loadFeatureDataForSlice(view.trait, view.slice, category);
      
      // 更新缓存
      setEnhancedData(prev => new Map(prev).set(cacheKey, sliceData));
      
      return sliceData;
    } catch (error) {
      console.error(`Error loading data for ${cacheKey}:`, error);
      return [];
    }
  }, [enhancedData]);

  // 为当前视图加载数据
  useEffect(() => {
    const loadViewsData = async () => {
      if (getBaseData().length === 0 || views.length === 0) return;
      
      const newViewsData = new Map();
      
      for (const view of views) {
        // 只有当视图实际需要显示时才加载数据
        const data = await loadDataForView(view);
        newViewsData.set(view.key, data);
      }
      
      setViewsData(newViewsData);
    };
    
    loadViewsData();
  }, [views, loadDataForView]); // 只在 views 变化时加载

  // 处理视图切换
  const handleViewChange = useCallback((newViews) => {
    setViews(newViews);
  }, []);

  // 修改特征选择处理函数
  const handleTraitSelect = useCallback((traitKey) => {
    // 只改变视图配置，不立即加载数据
    handleViewChange([{ 
      key: traitKey, 
      type: 'trait', 
      slice: views[0].slice, 
      trait: traitKey 
    }]);
  }, [handleViewChange, views]);

  // 处理切片选择
  const handleSliceSelect = useCallback((sliceKey) => {
    handleViewChange([{ 
      key: sliceKey, 
      type: 'slice', 
      slice: sliceKey, 
      trait: views[0].trait 
    }]);
  }, [handleViewChange, views]);

  // --- Theme Classes ---
  const mainBgClass = isLightTheme ? 'bg-gray-50' : 'bg-gray-800';
  const controlPanelClass = isLightTheme ? 'bg-white border-r border-gray-200' : 'bg-gray-900 border-r border-gray-700';
  const textClass = isLightTheme ? 'text-gray-800' : 'text-white';
  const topBarClass = isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-700';

  // 生成区域颜色
  const REGION_COLORS = useMemo(() => {
    return ALL_REGIONS.reduce((acc, region, index) => {
      acc[region] = `hsl(${index * (360 / ALL_REGIONS.length)}, 70%, 50%)`;
      return acc;
    }, {});
  }, [ALL_REGIONS]);

  // --- Data Filtering & Range Calculation ---
  
  // 为每个视图过滤数据（应用区域过滤器）
  const getFilteredDataForView = useCallback((viewKey) => {
    const viewData = viewsData.get(viewKey) || [];
    return viewData.filter(d => visibleRegions.has(d.region));
  }, [viewsData, visibleRegions]);

  // 为每个视图计算minMax
  const getMinMaxForView = useCallback((view) => {
    const dataSlice = getFilteredDataForView(view.key);
    const traitKey = view.trait;
    
    let minVal = Infinity;
    let maxVal = -Infinity;
    let hasValidData = false;
    
    dataSlice.forEach(d => {
      const value = d[traitKey];
      if (typeof value === 'number' && !isNaN(value)) {
        hasValidData = true;
        if (value < minVal) minVal = value;
        if (value > maxVal) maxVal = value;
      }
    });
    
    // 如果没有有效数据，使用默认值
    if (!hasValidData || !isFinite(minVal) || !isFinite(maxVal)) {
      return { min: 0, max: 1 };
    } else if (minVal === maxVal) {
      // 如果所有值都相同，设置一个小的范围
      return { min: minVal - 0.1, max: maxVal + 0.1 };
    } else {
      return { min: minVal, max: maxVal };
    }
  }, [getFilteredDataForView]);

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
  }, [ALL_REGIONS]); 
  
  const setClearRegionsVisible = useCallback(() => {
      setVisibleRegions(new Set());
  }, []); 

  // 处理 hover 值范围变化
  const handleHoverValueRangeChange = useCallback((viewIndex, range) => {
    setHoverValueRanges(prev => ({
      ...prev,
      [viewIndex]: range
    }));
  }, []);

  const handleStartCompare = useCallback(async (newViews) => {
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

  // 加载状态
  if (isLoading) {
    return (
      <div className={`flex h-screen ${mainBgClass} items-center justify-center`}>
        <div className="text-xl text-gray-600">Loading data...</div>
      </div>
    );
  }

  // 错误状态
  if (loadError) {
    return (
      <div className={`flex h-screen ${mainBgClass} items-center justify-center`}>
        <div className="text-xl text-red-600">Error loading data: {loadError}</div>
      </div>
    );
  }

  // 无数据状态
  if (getBaseData().length === 0) {
    return (
      <div className={`flex h-screen ${mainBgClass} items-center justify-center`}>
        <div className="text-xl text-gray-600">No data available</div>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className={`flex h-screen ${mainBgClass} font-sans`}>
      
      {/* --- Top Bar --- */}
      <div className={`absolute top-0 left-0 right-0 h-14 ${topBarClass} border-b flex items-center justify-start px-4 z-40`}>
        <div className="flex space-x-4">
            {activePage === 'atlas' && (
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
            )}

            {/* Theme Toggle */}
            <button 
                onClick={() => setIsLightTheme(!isLightTheme)}
                className={`${topButton} bg-gray-500 hover:bg-gray-600`}
                title={isLightTheme ? "Switch to Dark Theme" : "Switch to Light Theme"}
            >
                {isLightTheme ? '☀️ Light' : '🌙 Dark'}
            </button>
            <div className="flex rounded-lg overflow-hidden border border-gray-500">
                <button
                    onClick={() => setActivePage('atlas')}
                    className={`${topButton} rounded-none ${activePage === 'atlas' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-700'}`}
                >
                    Atlas
                </button>
                <button
                    onClick={() => setActivePage('signal_tf')}
                    className={`${topButton} rounded-none ${activePage === 'signal_tf' ? 'bg-indigo-600' : 'bg-gray-600 hover:bg-gray-700'}`}
                >
                    Signal→TF
                </button>
            </div>
            {activePage === 'atlas' && (
              <button 
                  onClick={() => setIsCompareModalOpen(true)}
                  className={`${topButton} bg-blue-600 hover:bg-blue-700`}
              >
                  Compare
              </button>
            )}
            {activePage === 'atlas' && (
              <button
                  onClick={handleDownloadImage}
                  className={`${topButton} bg-gray-600 hover:bg-gray-700`}
              >
                  Download Results
              </button>
            )}
        </div>
      </div>
      
      {/* --- Main Content Area --- */}
      {activePage === 'atlas' ? (
      <div className="flex flex-grow mt-14">
      
        {/* --- Left Control Panel (Trait & Section Selection) --- */}
        <div className={`w-72 flex flex-col ${controlPanelClass}`}>
          
          {/* Trait Section - 固定高度可滚动 */}
          <div className="flex-shrink-0 p-6 border-b border-gray-700">
            <h2 className={`text-lg font-semibold mb-3 ${textClass}`}>Trait</h2>
            <div className="flex border border-gray-400 rounded overflow-hidden mb-4">
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

          {/* Trait Selection (Categorized) - 可滚动区域 */}
          <div className="flex-1 overflow-y-auto p-6 border-b border-gray-700">
            <div className="space-y-4">
              {TRAIT_CATEGORIES.map(cat => (
                <div key={cat.key}>
                  <h3 className={`text-base font-bold border-b mb-2 ${textClass} border-gray-700`}>{cat.label}</h3>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredLeftTraits.filter(t => t.category === cat.key).map(trait => (
                      <button
                        key={trait.key}
                        onClick={() => handleTraitSelect(trait.key)}
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
                </div>
              ))}
            </div>
          </div>

          {/* Section Selection - 固定高度可滚动 */}
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className={`text-lg font-semibold mb-3 ${textClass}`}>Section</h2>
            <div className="space-y-4">
              {SECTION_DATA.map(tissueGroup => (
                <div key={tissueGroup.tissue}>
                  <h3 className={`text-base font-bold mb-2 ${textClass}`}>{tissueGroup.tissue}</h3>
                  <div className="max-h-32 overflow-y-auto">
                    {tissueGroup.sections.map(section => (
                      <button
                        key={section.key}
                        onClick={() => handleSliceSelect(section.key)}
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
                </div>
              ))}
            </div>
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
              const dataSlice = getFilteredDataForView(view.key);
              const traitKey = view.trait;
              const minMax = getMinMaxForView(view);
              const traitLabel = ALL_TRAITS_FLAT.find(t => t.key === traitKey)?.label || traitKey;
              const viewHoverRange = hoverValueRanges[index] || null;
              
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
                  {dataSlice.length === 0 && (
                    <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-20">
                      <div className="text-lg">Loading data...</div>
                    </div>
                  )}
                  
                  <SpatialViewer 
                    data={dataSlice} 
                    traitKey={traitKey}
                    minMax={minMax}
                    title={`Section: ${view.slice} | Trait: ${traitLabel}`}
                    pointRadius={pointRadius}
                    hoverValueRange={viewHoverRange}
                    isLightTheme={isLightTheme}
                    showCellType={showCellType}
                    // 主视图使用这些 props
                    visibleRegions={visibleRegions}
                    toggleRegion={toggleRegion}
                    setAllRegionsVisible={setAllRegionsVisible}
                    setClearRegionsVisible={setClearRegionsVisible}
                    // 传递区域信息
                    ALL_REGIONS={ALL_REGIONS}
                    REGION_COLORS={REGION_COLORS}
                  />
                  
                  {/* === 添加 ColorBar 到主视图 === */}
                  {!showCellType && minMax && (
                    <div className="absolute top-0 left-0 h-full flex flex-col justify-center p-4 z-10">
                      <div className="absolute top-1/2 -translate-y-1/2 left-4">
                        <ColorBar 
                          minMax={minMax} 
                          mapValueToColor={mapValueToColor}
                          isLightTheme={isLightTheme}
                          onHoverChange={handleHoverValueRangeChange}
                          viewIndex={index}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
      </div>
      ) : (
        <div className="flex flex-grow mt-14 p-5">
          <SignalTFPage isLightTheme={isLightTheme} />
        </div>
      )}
      
      {/* Compare Selection Modal */}
      {activePage === 'atlas' && (
        <MemoizedCompareModal 
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          onStartCompare={handleStartCompare}
          ALL_SLICES={memoizedSlices}
          ALL_TRAITS_FLAT={memoizedTraits}
          SECTION_DATA={memoizedSections}
          TRAIT_CATEGORIES={memoizedCategories}
        />
      )}
      
      {/* Compare Viewer Modal */}
      {activePage === 'atlas' && (
        <CompareViewerModal 
          isOpen={isCompareViewerOpen}
          onClose={handleCloseCompareViewer}
          compareViews={compareViews}
          pointRadius={pointRadius}
          isLightTheme={isLightTheme}
          showCellType={showCellType}
          onCellTypeToggle={() => setShowCellType(!showCellType)}
          ALL_REGIONS={ALL_REGIONS}
          ALL_TRAITS_FLAT={ALL_TRAITS_FLAT}
        />
      )}
      
    </div>
  );
}

export default App;
