# Table S3 data integration

The Signal to TF view reads the author-supplied Table S3 without rerunning the scientific analyses.

| Spatial stage | Detail rows | Signal summaries |
| --- | ---: | ---: |
| E12.5 | 55,560 | 1,941 |
| E13.5 | 65,660 | 2,341 |
| E15.5 | 94,240 | 3,294 |

E15.5 denotes the mapped spatial sample; the multiome reference uses E14.0/E14.5 material. Each detail row represents an interaction-TF association rather than a unique communication edge. Computational correlations and source direction labels do not establish causality.

CSV files retain all original fields, stored decimal strings, missing values and within-stage record order. Interface rounding does not alter exported values. Filtered exports include every matching row and restore original within-stage order. The stage CSV row identifier includes the header as row 1; it is not the original Excel worksheet row.

The source workbook SHA-256 and per-stage ordered-value digests, counts and file sizes are recorded in `scripts/table_s3_provenance.json` and `public/data/commot/index.json`.

To reproduce the export, install Python and lxml, then run from the repository:

```sh
python scripts/export_table_s3.py "/path/to/Table S3.xlsx"
node scripts/test_table_s3.mjs
```

The exporter verifies every exported record against the workbook values and ordering. The source workbook must be supplied separately. Existing atlas binary data are unchanged. These browser CSV files do not replace a versioned research-data archive.

Use Guide & demos for reader-facing explanations and interactive tutorials. Run `npm ci` followed by `npm run build` to build the website. The existing GitHub Actions workflow deploys pushes to main to GitHub Pages.
