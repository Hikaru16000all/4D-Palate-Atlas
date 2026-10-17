from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import csv,json,hashlib,collections
import argparse
parser = argparse.ArgumentParser(description='Export and verify stage-specific Table S3 CSV files.')
parser.add_argument('workbook', type=Path, help='Path to the author-supplied Table S3.xlsx')
args = parser.parse_args()
ROOT = Path(__file__).resolve().parent.parent
SRC = args.workbook.resolve()
OUT = ROOT / 'public/data/commot'
OUT.mkdir(parents=True, exist_ok=True)
S='http://schemas.openxmlformats.org/spreadsheetml/2006/main';N={'s':S};stages={'Embryo12.5':('E125','E12.5'),'Embryo13.5':('E135','E13.5'),'Embryo15.5':('E155','E15.5')}
z=ZipFile(SRC);ss=[''.join(x.itertext())for x in E.fromstring(z.read('xl/sharedStrings.xml'))]
def cv(c):
 v=c.find('s:v',N);t=v.text if v is not None else ''
 return ss[int(t)]if c.get('t')=='s'else ''.join(c.find('s:is',N).itertext())if c.get('t')=='inlineStr'else t
def ci(addr):
 n=0
 for x in addr:
  if x.isalpha():n=n*26+ord(x)-64
  else:break
 return n-1
manifest={'version':'2.0','source':'Author-supplied Table S3.xlsx','sourceSHA256':hashlib.sha256(SRC.read_bytes()).hexdigest(),'description':'Exact stored values and original within-stage record order; display-only Stage aliases. No scientific analysis rerun.','stageMeaning':'Matched spatial sample stage; E15.5 uses E14.0/E14.5 multiome references.','directionMeaning':'Source direction annotations are computational labels, not evidence of causal activation/repression.','slices':[]}
entries={st:{'slice':sid,'label':lab,'sourceStage':st}for st,(sid,lab)in stages.items()}
for sn,kind,cols in [(1,'summary',12),(2,'detail',21)]:
 handles={};writers={};counts=collections.Counter();hashes={st:hashlib.sha256()for st in stages};paths={st:set()for st in stages};tfs={st:set()for st in stages}
 for st,(sid,lab)in stages.items():
  p=OUT/f'table_s3_{sid}_{kind}.csv';handles[st]=p.open('w',encoding='utf8',newline='');writers[st]=csv.writer(handles[st],lineterminator='\n')
 header=None
 for _,row in E.iterparse(z.open(f'xl/worksheets/sheet{sn}.xml'),events=('end',),tag='{'+S+'}row'):
  values=['']*cols
  for c in row:values[ci(c.get('r'))]=cv(c)
  if header is None:
   header=values
   for writer in writers.values():writer.writerow(header)
  else:
   st=values[0];assert st in stages
   writers[st].writerow(values);hashes[st].update(json.dumps(values,ensure_ascii=False,separators=(',',':')).encode()+b'\n');counts[st]+=1;paths[st].add(values[3])
   if kind=='detail':tfs[st].add(values[13])
  row.clear()
  while row.getprevious()is not None:del row.getparent()[0]
 for st,f in handles.items():
  f.close();sid=stages[st][0];p=OUT/f'table_s3_{sid}_{kind}.csv';h=hashlib.sha256();n=0
  with p.open(encoding='utf8',newline='')as q:
   reader=csv.reader(q);assert next(reader)==header
   for vals in reader:h.update(json.dumps(vals,ensure_ascii=False,separators=(',',':')).encode()+b'\n');n+=1
  assert n==counts[st]and h.hexdigest()==hashes[st].hexdigest()
  entries[st][kind+'File']=p.name;entries[st][kind+'Rows']=n;entries[st][kind+'OrderedValuesSHA256']=h.hexdigest();entries[st][kind+'Bytes']=p.stat().st_size
  if kind=='detail':entries[st].update({'pathways':len(paths[st]),'tfs':len(tfs[st])})
 print(kind,dict(counts),flush=True)
manifest['slices']=list(entries.values());assert sum(e['detailRows']for e in entries.values())==215460;assert sum(e['summaryRows']for e in entries.values())==7576
(OUT/'index.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(ROOT/'scripts/table_s3_provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8');print('ALL_RECORD_VALUES_AND_ORDER_VERIFIED')
