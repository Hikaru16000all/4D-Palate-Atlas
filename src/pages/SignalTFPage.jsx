import React, { useEffect, useMemo, useState } from 'react';
import { loadCOMMOTIndex, loadCOMMOTInteractionsBySlice } from '../commotInteractions';

const FILTER_FIELDS = [
  { key: 'slice', label: 'Slice' },
  { key: 'ligand', label: 'Ligand' },
  { key: 'receptor', label: 'Receptor' },
  { key: 'signalType', label: 'Signal Type' },
  { key: 'parentSignalId', label: 'Parent Signal ID' },
  { key: 'pathway', label: 'Pathway' },
  { key: 'senderRegion', label: 'Sender Region' },
  { key: 'receiverRegion', label: 'Receiver Region' },
  { key: 'downstreamTF', label: 'Downstream TF' },
  { key: 'direction', label: 'Direction' }
];

const SignalTFPage = ({ isLightTheme }) => {
  const [search, setSearch] = useState('');
  const [fieldFilters, setFieldFilters] = useState(() =>
    FILTER_FIELDS.reduce((acc, field) => {
      acc[field.key] = '';
      return acc;
    }, {})
  );
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [availableSlices, setAvailableSlices] = useState([]);

  const optionsByField = useMemo(
    () =>
      FILTER_FIELDS.reduce((acc, field) => {
        const values = field.key === 'slice'
          ? availableSlices
          : Array.from(new Set(interactions.map(item => item[field.key]).filter(Boolean))).sort();
        acc[field.key] = values;
        return acc;
      }, {}),
    [interactions, availableSlices]
  );

  useEffect(() => {
    const loadIndex = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const index = await loadCOMMOTIndex();
        const slices = (index?.slices || []).map(entry => entry.slice).filter(Boolean);
        setAvailableSlices(slices);
        if (slices.length > 0) {
          setFieldFilters(prev => ({ ...prev, slice: prev.slice || slices[0] }));
        }
      } catch (error) {
        console.error('SignalTFPage index loading error:', error);
        setLoadError('Failed to load interaction index.');
        setInteractions([]);
      } finally {
        setLoading(false);
      }
    };

    loadIndex();
  }, []);

  useEffect(() => {
    const selectedSlice = fieldFilters.slice;
    if (!selectedSlice) {
      setInteractions([]);
      return;
    }

    const loadSliceData = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const loaded = await loadCOMMOTInteractionsBySlice(selectedSlice);
        setInteractions(Array.isArray(loaded) ? loaded : []);
      } catch (error) {
        console.error('SignalTFPage slice loading error:', error);
        setLoadError(`Failed to load interactions for slice ${selectedSlice}.`);
        setInteractions([]);
      } finally {
        setLoading(false);
      }
    };

    loadSliceData();
  }, [fieldFilters.slice]);

  const filteredInteractions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const safeLower = (value) => String(value || '').toLowerCase();
    return interactions
      .filter(item =>
        FILTER_FIELDS.every(field =>
          !fieldFilters[field.key] ||
          safeLower(item[field.key]).includes(safeLower(fieldFilters[field.key]))
        )
      )
      .filter(item => {
        if (!keyword) return true;
        return [
          item.slice,
          item.ligand,
          item.receptor,
          item.signalType,
          item.parentSignalId,
          item.pathway,
          item.downstreamTF,
          item.senderRegion,
          item.receiverRegion,
          item.direction
        ].some(value => safeLower(value).includes(keyword));
      })
      .sort((a, b) => {
        const c1 = Math.abs(Number(b.correlation || 0));
        const c2 = Math.abs(Number(a.correlation || 0));
        return c1 - c2;
      });
  }, [interactions, search, fieldFilters]);

  const panelClass = isLightTheme ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-100';
  const inputClass = isLightTheme
    ? 'bg-white border-gray-300 text-gray-900'
    : 'bg-gray-700 border-gray-600 text-gray-100';

  return (
    <div className={`${panelClass} h-full w-full rounded-lg shadow-2xl p-6 flex flex-col`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold">Extracellular Signal → TF GRN Explorer</h2>
          <p className="text-sm mt-2 opacity-80">
            TF-centric GRNs are shaped by extracellular spatial niche signals. We integrated COMMOT-inferred
            ligand-receptor communication with correlation analysis to prioritize active pathways and their most
            affected downstream TFs across palate development.
          </p>
        </div>
      </div>

      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Global keyword search..."
          className={`border rounded px-3 py-2 ${inputClass}`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
        {FILTER_FIELDS.map(field => (
          <div key={field.key} className="flex flex-col gap-1">
            <label className="text-xs opacity-80">{field.label}</label>
            <input
              list={`signal-filter-${field.key}`}
              value={fieldFilters[field.key]}
              onChange={(e) => {
                const value = e.target.value;
                setFieldFilters(prev => ({ ...prev, [field.key]: value }));
              }}
              placeholder={`Type ${field.label}...`}
              className={`border rounded px-3 py-2 text-sm ${inputClass}`}
            />
            <datalist id={`signal-filter-${field.key}`}>
              {(optionsByField[field.key] || []).map(optionValue => (
                <option key={optionValue} value={optionValue} />
              ))}
            </datalist>
          </div>
        ))}
      </div>
      <div className="mb-4">
        <button
          onClick={() =>
            setFieldFilters(
              FILTER_FIELDS.reduce((acc, field) => {
                acc[field.key] = '';
                return acc;
              }, {})
            )
          }
          className="px-3 py-2 text-sm rounded bg-gray-600 text-white hover:bg-gray-700"
        >
          Clear all field filters
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 text-sm">
        <div className="rounded border border-gray-500 p-2">Interactions: <span className="font-semibold">{filteredInteractions.length}</span></div>
        <div className="rounded border border-gray-500 p-2">Pathways: <span className="font-semibold">{new Set(filteredInteractions.map(i => i.pathway)).size}</span></div>
        <div className="rounded border border-gray-500 p-2">Downstream TFs: <span className="font-semibold">{new Set(filteredInteractions.map(i => i.downstreamTF)).size}</span></div>
      </div>
      <p className="text-xs opacity-70 mb-3">
        Large-data mode: interactions are loaded on-demand by selected slice to avoid loading the full CSV into memory.
      </p>
      {loadError && (
        <div className="mb-3 text-sm text-red-500">{loadError}</div>
      )}

      <div className="overflow-auto border border-gray-600 rounded-lg">
        <table className="w-full text-sm">
          <thead className={isLightTheme ? 'bg-gray-100' : 'bg-gray-700'}>
            <tr>
              <th className="text-left px-3 py-2">Section</th>
              <th className="text-left px-3 py-2">Ligand</th>
              <th className="text-left px-3 py-2">Receptor</th>
              <th className="text-left px-3 py-2">Signal Type</th>
              <th className="text-left px-3 py-2">Parent Signal</th>
              <th className="text-left px-3 py-2">Pathway</th>
              <th className="text-left px-3 py-2">Sender Region</th>
              <th className="text-left px-3 py-2">Receiver Region</th>
              <th className="text-left px-3 py-2">Downstream TF</th>
              <th className="text-left px-3 py-2">Direction</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="10" className="px-3 py-6 text-center opacity-80">Loading COMMOT interactions...</td>
              </tr>
            )}
            {filteredInteractions.map((item, idx) => (
              <tr key={`${item.slice}-${item.pathway}-${item.downstreamTF}-${idx}`} className="border-t border-gray-600">
                <td className="px-3 py-2">{item.slice}</td>
                <td className="px-3 py-2">{item.ligand}</td>
                <td className="px-3 py-2">{item.receptor}</td>
                <td className="px-3 py-2">{item.signalType}</td>
                <td className="px-3 py-2">{item.parentSignalId}</td>
                <td className="px-3 py-2">{item.pathway}</td>
                <td className="px-3 py-2">{item.senderRegion}</td>
                <td className="px-3 py-2">{item.receiverRegion}</td>
                <td className="px-3 py-2 font-semibold">{item.downstreamTF}</td>
                <td className="px-3 py-2">{item.direction}</td>
              </tr>
            ))}
            {!loading && filteredInteractions.length === 0 && (
              <tr>
                <td colSpan="10" className="px-3 py-6 text-center opacity-80">No interactions match current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm opacity-80">
        Action guide: switch to <span className="font-semibold">Signal→TF</span> page from the top tabs, then filter by
        section/pathway or search TF/region keywords to start a new interaction exploration action.
      </div>
    </div>
  );
};

export default SignalTFPage;
