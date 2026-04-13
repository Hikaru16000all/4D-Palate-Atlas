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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 text-sm">
        <div className="rounded border border-gray-500 p-2">Interactions: <span className="font-semibold">{filteredInteractions.length}</span></div>
        <div className="rounded border border-gray-500 p-2">Pathways: <span className="font-semibold">{new Set(filteredInteractions.map(i => i.pathway)).size}</span></div>
        <div className="rounded border border-gray-500 p-2">Downstream TFs: <span className="font-semibold">{new Set(filteredInteractions.map(i => i.downstreamTF)).size}</span></div>
      </div>
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
