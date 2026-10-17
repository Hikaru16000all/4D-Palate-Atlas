import { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { loadCOMMOTIndex, loadCOMMOTInteractionsBySlice, loadCOMMOTSummaryBySlice, sourceNumber, exportTableCSV, SOURCE_COLUMNS } from '../commotInteractions';
import './SignalTFPage.css';

const PAGE_SIZE = 50;
const number = (value, scientific = false) => {
  const n = sourceNumber(value);
  if (n === null) return '—';
  if (n === 0) return '0';
  return scientific && (Math.abs(n) < .001 || Math.abs(n) >= 10000) ? n.toExponential(2) : n.toLocaleString('en-US', { maximumFractionDigits: scientific ? 4 : 3 });
};
const clean = () => ({ pathway: '', signal_type: '', senderRegion: '', receiverRegion: '', downstreamTF: '', sign: 'all', minR: '0', maxFDR: '1', maxP: '1' });
const valueLabel = (row, field) => row?.[field] === '' || row?.[field] == null ? '—' : row[field];
const DownloadIcon = () => <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2v10m-4-4 4 4 4-4M3 13v4h14v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;

export default function SignalTFPage({ isLightTheme, demoPreset = false }) {
  const [index, setIndex] = useState(null);
  const [stage, setStage] = useState(() => (demoPreset || window.location.hash.includes('demo=hh-foxf1')) ? 'E155' : 'E125');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filters, setFilters] = useState(() => (demoPreset || window.location.hash.includes('demo=hh-foxf1')) ? {...clean(),pathway:'HH',downstreamTF:'Foxf1'} : clean());
  const [sort, setSort] = useState('correlation');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [showAllFields, setShowAllFields] = useState(false);

  useEffect(() => {
    let active = true;
    loadCOMMOTIndex().then(data => { if (active) setIndex(data); }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    if (!index) return undefined;
    let active = true;
    setLoading(true); setError(''); setRows([]); setSummary([]); setSelectedId(null);
    Promise.all([loadCOMMOTInteractionsBySlice(stage), loadCOMMOTSummaryBySlice(stage)]).then(([detail, sums]) => {
      if (active) { setRows(detail); setSummary(sums); setLoading(false); }
    }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [stage, index, retry]);
  useEffect(() => { setPage(0); }, [deferredQuery, filters, stage, sort]);
  const entry = index?.slices.find(item => item.slice === stage);
  const options = useMemo(() => Object.fromEntries(['pathway','signal_type','senderRegion','receiverRegion','downstreamTF'].map(key => [key, [...new Set(rows.map(row => row[key]).filter(Boolean))].sort()])), [rows]);
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const found = rows.filter(row => {
      for (const key of ['pathway','signal_type','senderRegion','receiverRegion','downstreamTF']) if (filters[key] && row[key] !== filters[key]) return false;
      if (q && !['ligand','receptor','ligand_receptor_pair','pathway','pathwayLabel','senderRegion','receiverRegion','downstreamTF'].some(key => String(row[key]).toLowerCase().includes(q))) return false;
      const r = sourceNumber(row.correlation), fdr = sourceNumber(row.tfFDR), p = sourceNumber(row.interactionPValue);
      if (Number(filters.minR) > 0 && (r == null || Math.abs(r) < Number(filters.minR))) return false;
      if (Number(filters.maxFDR) < 1 && (fdr == null || fdr > Number(filters.maxFDR))) return false;
      if (Number(filters.maxP) < 1 && (p == null || p > Number(filters.maxP))) return false;
      if (filters.sign === 'positive' && !(r > 0)) return false;
      if (filters.sign === 'negative' && !(r < 0)) return false;
      return true;
    });
    return found.sort((a,b) => {
      if (sort === 'source') return a._sourceRow - b._sourceRow;
      const av = sourceNumber(a[sort]), bv = sourceNumber(b[sort]);
      if (av == null) return bv == null ? a._sourceRow - b._sourceRow : 1;
      if (bv == null) return -1;
      const result = sort === 'correlation' ? Math.abs(bv) - Math.abs(av) : sort === 'tfFDR' ? av - bv : bv - av;
      return result || a._sourceRow - b._sourceRow;
    });
  }, [rows, deferredQuery, filters, sort]);
  const stats = useMemo(() => ({ pathways: new Set(filtered.map(row => row.pathway)).size, tfs: new Set(filtered.map(row => row.downstreamTF)).size }), [filtered]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const shown = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selected = filtered.find(row => row._id === selectedId) || shown[0];
  const selectedSummary = selected && summary.find(row => ['Stage','batch','signal_type','pathway','pathwayLabel','ligand','receptor','ligand_receptor_pair','receiverRegion'].every(key => row[key] === selected[key]) && row.cluster_result_key === selected.clusterResultKey);
  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const reset = () => { setFilters(clean()); setQuery(''); setSelectedId(null); };
  const download = () => {
    const blob = new Blob(['\uFEFF' + exportTableCSV(filtered)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `TableS3_${entry.label}_filtered.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const selectField = (key, label) => <label className="signal-field" key={key}><span>{label}</span><select value={filters[key]} onChange={e => setFilter(key,e.target.value)}><option value="">All {label === 'TF' ? 'TFs' : label.toLowerCase()+'s'}</option>{(options[key] || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label>;

  return <main className="signal-page" data-theme={isLightTheme ? 'light' : 'dark'}>
    <section className="signal-toolbar" aria-label="Developmental stage">
      <div className="signal-stages">{(index?.slices || [{ slice:'E125',label:'E12.5' },{ slice:'E135',label:'E13.5' },{ slice:'E155',label:'E15.5' }]).map(item => <button key={item.slice} aria-pressed={stage===item.slice} onClick={() => { setStage(item.slice); reset(); }}><span>{item.label}</span></button>)}</div>
      <span className="signal-stage-note" title="Spatial sample stage; E15.5 uses E14.0/E14.5 multiome references">Spatial stages</span>
    </section>
    <div className="signal-workspace">
      <aside className="signal-filters"><div className="signal-section-label"><h2>Filters</h2><button onClick={reset}>Reset</button></div>
        <label className="signal-field"><span>Search</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Gene, TF or region" type="search"/></label>
        {selectField('pathway','Pathway')}{selectField('downstreamTF','TF')}<details className="signal-extra"><summary>More filters</summary>{selectField('signal_type','Signal type')}{selectField('senderRegion','Sender')}{selectField('receiverRegion','Receiver')}</details>
        <details className="signal-extra"><summary>Thresholds</summary>
        <label className="signal-field"><span>Correlation sign</span><select value={filters.sign} onChange={e=>setFilter('sign',e.target.value)}><option value="all">Both signs</option><option value="positive">Positive association</option><option value="negative">Negative association</option></select></label>
        <div className="signal-thresholds"><label className="signal-field"><span>Minimum |r|</span><input type="number" min="0" max="1" step="0.05" value={filters.minR} onChange={e=>setFilter('minR',e.target.value)}/></label><label className="signal-field"><span>Maximum TF FDR</span><input type="number" min="0" max="1" step="0.01" value={filters.maxFDR} onChange={e=>setFilter('maxFDR',e.target.value)}/></label></div>
        <label className="signal-field"><span>Maximum interaction P</span><input type="number" min="0" max="1" step="0.01" value={filters.maxP} onChange={e=>setFilter('maxP',e.target.value)}/></label>

        </details>
        {entry && <details className="signal-downloads"><summary>Source files</summary><a href={`${import.meta.env.BASE_URL}data/commot/${entry.detailFile}`} download><DownloadIcon/> All {entry.label} records</a><a href={`${import.meta.env.BASE_URL}data/commot/${entry.summaryFile}`} download><DownloadIcon/> Signal summaries</a></details>}
      </aside>
      <section className="signal-content" id="signal-results" aria-label="Interaction results">
        {error && <div className="signal-error" role="alert"><strong>Data could not be loaded.</strong><p>{error}</p><button onClick={()=>setRetry(x=>x+1)}>Retry loading</button></div>}
        {!error && selected && !loading && <section className="signal-inspector" aria-label="Selected association"><div className="signal-section-label"><h2>Selected</h2><span title={`Stage CSV row ${selected._sourceRow}`}>{entry.label}</span></div><div className="signal-chain"><div><small>Sender · {selected.senderRegion}</small><strong>{selected.ligand || selected.pathway}</strong></div><span className="signal-chain-link" aria-hidden="true">→</span><div><small>Receiver · {selected.receiverRegion}</small><strong>{selected.receptor || selected.pathwayLabel}</strong></div><span className="signal-chain-link signal-dashed" aria-hidden="true">···</span><div><small>Associated TF</small><strong className="signal-gene">{selected.downstreamTF}</strong></div></div><div className="signal-evidence"><span>r <b title={selected.correlation}>{number(selected.correlation)}</b></span><span>TF FDR <b title={selected.tfFDR}>{number(selected.tfFDR,true)}</b></span><span>Interaction P <b title={selected.interactionPValue}>{number(selected.interactionPValue,true)}</b></span><button onClick={()=>setShowAllFields(x=>!x)} aria-expanded={showAllFields}>{showAllFields ? 'Hide details' : 'Details'} {showAllFields?'−':'+'}</button></div>{showAllFields && <dl className="signal-details">{SOURCE_COLUMNS.map(key=><div key={key}><dt>{key}</dt><dd>{valueLabel(selected,key)}</dd></div>)}{selectedSummary && <><div><dt>Summary: significant edges</dt><dd>{selectedSummary.n_significant_edges}</dd></div><div><dt>Summary: exported TFs</dt><dd>{selectedSummary.n_tf_exported}</dd></div></>}</dl>}</section>}
        <section className="signal-table-panel"><div className="signal-table-heading"><div><h2>Results <span className="signal-result-total">{loading ? '—' : filtered.length.toLocaleString()}</span></h2></div><button className="signal-export" disabled={loading || !filtered.length} onClick={download}><DownloadIcon/> Export CSV</button></div>
          <div className="signal-results-control"><span aria-live="polite">{loading ? 'Loading Table S3…' : `${stats.pathways} pathways · ${stats.tfs} TFs`}</span><label>Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option value="correlation">Absolute correlation ↓</option><option value="tfFDR">TF FDR ↑</option><option value="interactionStrength">Interaction strength ↓</option><option value="source">Source order</option></select></label></div>
          <div className="signal-table-scroll"><table><thead><tr>{['Pathway / signal','Ligand → receptor','Sender → receiver','TF','Correlation','TF FDR','Interaction P'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan="7" className="signal-empty"><div className="signal-spinner"/>Loading the selected spatial stage…</td></tr> : shown.map(row => <tr key={row._id} className={selected?._id===row._id?'is-selected':''}><td><span className="signal-pathway">{row.pathway}</span><small title={row.signal_type}>{row.signal_type === 'lr_pair'?'LR':row.signal_type}</small></td><td><span>{row.ligand || '—'} <i>→</i></span><span>{row.receptor || '—'}</span></td><td><span>{row.senderRegion} <i>→</i></span><span>{row.receiverRegion}</span></td><td><button className="signal-row-select" onClick={()=>{setSelectedId(row._id);setShowAllFields(false);}} aria-label={`Inspect ${row.downstreamTF}, stage CSV row ${row._sourceRow}`} aria-pressed={selected?._id===row._id}>{row.downstreamTF}</button></td><td title={row.correlation}><span className={`signal-r ${Number(row.correlation)<0?'negative':'positive'}`}>{number(row.correlation)}</span></td><td title={row.tfFDR}>{number(row.tfFDR,true)}</td><td title={row.interactionPValue}>{number(row.interactionPValue,true)}</td></tr>)}{!loading && !shown.length && <tr><td colSpan="7" className="signal-empty">{error?'Resolve the loading error to view source records.':'No associations match these filters.'}<button onClick={reset}>Reset filters</button></td></tr>}</tbody></table></div>
          <footer className="signal-pagination"><span>{filtered.length ? `${currentPage*PAGE_SIZE+1}–${Math.min((currentPage+1)*PAGE_SIZE,filtered.length)} of ${filtered.length.toLocaleString()}`:'0 records'}</span><div><button disabled={currentPage===0 || loading} onClick={()=>setPage(0)} aria-label="First page">«</button><button disabled={currentPage===0 || loading} onClick={()=>setPage(x=>x-1)}>Previous</button><span>Page {currentPage+1} of {pages.toLocaleString()}</span><button disabled={currentPage>=pages-1 || loading} onClick={()=>setPage(x=>x+1)}>Next</button></div></footer>
        </section>
      </section>
    </div>
  </main>;
}

SignalTFPage.propTypes = { demoPreset: (p,n)=> p[n] == null || typeof p[n] === 'boolean' ? null : new Error('demoPreset must be boolean'), isLightTheme: (props, name, component) => typeof props[name] === "boolean" ? null : new Error(`${component}: ${name} must be boolean`) };
