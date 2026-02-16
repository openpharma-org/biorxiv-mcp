# Unofficial bioRxiv MCP Server

Model Context Protocol (MCP) server for accessing bioRxiv and medRxiv preprint servers (Cold Spring Harbor Laboratory). Provides access to 260,000+ preprints across 27 biological and 51 medical science categories.

## Features

- **Single unified tool** (`biorxiv_info`) with 7 methods
- No API key required — uses the public bioRxiv API
- Keyword search with client-side filtering over date-range browsing
- Full preprint metadata retrieval by DOI (all versions)
- Published preprint tracking (preprint → journal mapping)
- Funder search by ROR ID (NIH, NSF, Wellcome, etc.)
- Content and usage statistics (submissions, views, downloads)
- Subject category listings for both bioRxiv and medRxiv

## Installation

```bash
cd biorxiv-mcp-server
npm install
npm run build
```

## Usage

```json
{
  "mcpServers": {
    "biorxiv-mcp-server": {
      "command": "node",
      "args": ["/path/to/biorxiv-mcp-server/build/index.js"]
    }
  }
}
```

## Tool: biorxiv_info

Single unified tool with multiple methods accessed via the `method` parameter.

### Methods

#### 1. search_preprints

Search preprints by keywords. Uses client-side filtering over the bioRxiv date-range API (no native keyword search endpoint). Scans up to 300 results across the date range.

```json
{
  "method": "search_preprints",
  "query": "CRISPR gene editing",
  "server": "biorxiv",
  "date_from": "2025-01-01",
  "date_to": "2025-12-31",
  "category": "genetics",
  "limit": 30
}
```

Returns: doi, title, authors, abstract (500 chars), date, category, version, published status.

#### 2. get_preprint_details

Get complete metadata for a specific preprint by DOI, including all versions.

```json
{
  "method": "get_preprint_details",
  "doi": "10.1101/2024.01.15.575123",
  "server": "biorxiv"
}
```

Returns: all versions with doi, title, authors, full abstract, date, category, license, published status.

#### 3. get_categories

List all available subject categories for bioRxiv (27) and medRxiv (51).

```json
{
  "method": "get_categories"
}
```

#### 4. search_published_preprints

Find preprints that have been formally published in peer-reviewed journals.

```json
{
  "method": "search_published_preprints",
  "date_from": "2025-01-01",
  "publisher": "10.1038",
  "server": "biorxiv",
  "limit": 30
}
```

Common publisher DOI prefixes: `10.1038` (Nature), `10.1126` (Science), `10.1016` (Elsevier), `10.1371` (PLOS), `10.7554` (eLife), `10.1073` (PNAS).

#### 5. search_by_funder

Find preprints by funding organization using ROR IDs. Data available from 2025-04-10 onwards.

```json
{
  "method": "search_by_funder",
  "funder_ror_id": "021nxhr62",
  "server": "biorxiv",
  "limit": 30
}
```

Common ROR IDs: `021nxhr62` (NIH), `01cwqze88` (NSF), `02mhbdp94` (European Commission), `029chgv08` (Wellcome Trust), `05a28rw58` (HHMI), `006wxqw41` (MRC).

#### 6. get_content_statistics

Get submission statistics (new papers, revisions, authors).

```json
{
  "method": "get_content_statistics",
  "interval": "m"
}
```

Interval: `"m"` (monthly) or `"y"` (yearly).

#### 7. get_usage_statistics

Get engagement statistics (views, downloads).

```json
{
  "method": "get_usage_statistics",
  "interval": "m",
  "server": "biorxiv"
}
```

## Example Queries with Claude

Once configured, you can ask Claude:

- "Search bioRxiv for recent CRISPR preprints"
- "Get details for preprint DOI 10.1101/2024.01.15.575123"
- "What bioRxiv categories are available?"
- "Find preprints published in Nature this month"
- "Show NIH-funded preprints in cancer biology"
- "What are the monthly submission statistics for bioRxiv?"
- "Search medRxiv for COVID-19 vaccine preprints"

## Important Notes

- **Preprints are NOT peer-reviewed** — results should not be cited as established fact
- **Keyword search** is client-side (bioRxiv API only supports date-range browsing), so narrow date ranges improve relevance
- **DOI format**: `10.1101/YYYY.MM.DD.NNNNNN` (bioRxiv prefix is always `10.1101`)
- **Funder data** only available from April 10, 2025 onwards

## Data Source

- **Database**: bioRxiv / medRxiv (Cold Spring Harbor Laboratory)
- **Preprints**: 260,000+ across biology and medicine
- **Categories**: 27 bioRxiv + 51 medRxiv subject areas
- **API**: https://api.biorxiv.org/
- **Rate limits**: No published limits, respectful usage encouraged

## License

MIT
