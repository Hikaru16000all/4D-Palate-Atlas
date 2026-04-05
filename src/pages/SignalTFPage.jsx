import React, { useEffect, useMemo, useState } from 'react';
import { loadCOMMOTInteractions } from '../commotInteractions';

const SignalTFPage = ({ isLightTheme }) => {
  const [search, setSearch] = useState('');
  const [pathwayFilter, setPathwayFilter] = useState('all');
  const [sliceFilter, setSliceFilter] = useState('all');
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const pathways = useMemo(
    () => Array.from(new Set(interactions.map(item => item.pathway))).sort(),
    [interactions]
  );
  const slices = useMemo(
    () => Array.from(new Set(interactions.map(item => item.slice))).sort(),
    [interactions]
  );

  useEffect(() => {
    const loadInteractions = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const loaded = await loadCOMMOTInteractions();
        setInteractions(Array.isArray(loaded) ? loaded : []);
      } catch (error) {
        console.error('SignalTFPage loading error:', error);
        setLoadError('Failed to load interaction data.');
        setInteractions([]);
      } finally {
        setLoading(false);
      }
    };

    loadInteractions();
  }, []);

  const filteredInteractions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const safeLower = (value) => String(value || '').toLowerCase();
    return interactions
      .filter(item => pathwayFilter === 'all' || item.pathway === pathwayFilter)
      .filter(item => sliceFilter === 'all' || item.slice === sliceFilter)
      .filter(item => {
        if (!keyword) return true;
        return [
          item.pathway,
          item.downstreamTF,
          item.senderRegion,
          item.receiverRegion,
          item.direction
        ].some(value => safeLower(value).includes(keyword));
      })
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, [interactions, search, pathwayFilter, sliceFilter]);

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pathway / TF / region..."
          className={`border rounded px-3 py-2 ${inputClass}`}
        />
        <select
          value={pathwayFilter}
          onChange={(e) => setPathwayFilter(e.target.value)}
          className={`border rounded px-3 py-2 ${inputClass}`}
        >
          <option value="all">All pathways</option>
          {pathways.map(pathway => (
            <option key={pathway} value={pathway}>{pathway}</option>
          ))}
        </select>
        <select
          value={sliceFilter}
          onChange={(e) => setSliceFilter(e.target.value)}
          className={`border rounded px-3 py-2 ${inputClass}`}
        >
          <option value="all">All sections</option>
          {slices.map(slice => (
            <option key={slice} value={slice}>{slice}</option>
          ))}
        </select>
      </div>

      <p className="text-sm mb-3 opacity-80">
        Ranked interactions: {filteredInteractions.length}. A complete interaction resource is available in the
        supplementary table and interactive atlas export.
      </p>
      {loadError && (
        <div className="mb-3 text-sm text-red-500">{loadError}</div>
      )}

      <div className="overflow-auto border border-gray-600 rounded-lg">
        <table className="w-full text-sm">
          <thead className={isLightTheme ? 'bg-gray-100' : 'bg-gray-700'}>
            <tr>
              <th className="text-left px-3 py-2">Section</th>
              <th className="text-left px-3 py-2">Pathway</th>
              <th className="text-left px-3 py-2">Sender → Receiver</th>
              <th className="text-left px-3 py-2">Downstream TF</th>
              <th className="text-left px-3 py-2">Correlation</th>
              <th className="text-left px-3 py-2">Direction</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="px-3 py-6 text-center opacity-80">Loading COMMOT interactions...</td>
              </tr>
            )}
            {filteredInteractions.map((item, idx) => (
              <tr key={`${item.slice}-${item.pathway}-${item.downstreamTF}-${idx}`} className="border-t border-gray-600">
                <td className="px-3 py-2">{item.slice}</td>
                <td className="px-3 py-2">{item.pathway}</td>
                <td className="px-3 py-2">{item.senderRegion} → {item.receiverRegion}</td>
                <td className="px-3 py-2 font-semibold">{item.downstreamTF}</td>
                <td className="px-3 py-2">{item.correlation.toFixed(2)}</td>
                <td className="px-3 py-2">{item.direction}</td>
              </tr>
            ))}
            {!loading && filteredInteractions.length === 0 && (
              <tr>
                <td colSpan="6" className="px-3 py-6 text-center opacity-80">No interactions match current filters.</td>
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
