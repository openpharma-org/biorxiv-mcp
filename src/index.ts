#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';

// Hardcoded category lists (bioRxiv API has no endpoint for these)
const BIORXIV_CATEGORIES = [
  'animal-behavior-and-cognition', 'biochemistry', 'bioengineering',
  'bioinformatics', 'biophysics', 'cancer-biology', 'cell-biology',
  'clinical-trials', 'developmental-biology', 'ecology', 'epidemiology',
  'evolutionary-biology', 'genetics', 'genomics', 'immunology',
  'microbiology', 'molecular-biology', 'neuroscience', 'paleontology',
  'pathology', 'pharmacology-and-toxicology', 'physiology',
  'plant-biology', 'scientific-communication-and-education',
  'synthetic-biology', 'systems-biology', 'zoology',
];

const MEDRXIV_CATEGORIES = [
  'addiction-medicine', 'allergy-and-immunology', 'anesthesia',
  'cardiovascular-medicine', 'dentistry-and-oral-medicine', 'dermatology',
  'diabetes-and-endocrinology', 'emergency-medicine', 'epidemiology',
  'forensic-medicine', 'gastroenterology', 'genetic-and-genomic-medicine',
  'geriatric-medicine', 'health-economics', 'health-informatics',
  'health-policy', 'health-systems-and-quality-improvement',
  'hematology', 'hiv-aids', 'infectious-diseases',
  'intensive-care-and-critical-care-medicine', 'medical-education',
  'medical-ethics', 'nephrology', 'neurology', 'nursing',
  'nutrition', 'obstetrics-and-gynecology', 'occupational-and-environmental-health',
  'oncology', 'ophthalmology', 'orthopedics', 'otolaryngology',
  'pain-medicine', 'palliative-medicine', 'pathology', 'pediatrics',
  'pharmacology-and-therapeutics', 'primary-care-research',
  'psychiatry-and-clinical-psychology', 'public-and-global-health',
  'radiology-and-imaging', 'rehabilitation-medicine-and-physical-therapy',
  'respiratory-medicine', 'rheumatology', 'sexual-and-reproductive-health',
  'sports-medicine', 'surgery', 'toxicology', 'transplantation', 'urology',
];

class BioRxivServer {
  private server: Server;
  private api: AxiosInstance;

  constructor() {
    this.server = new Server(
      { name: 'biorxiv-mcp-server', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    this.api = axios.create({
      baseURL: 'https://api.biorxiv.org',
      timeout: 30000,
      headers: {
        'User-Agent': 'BioRxiv-MCP-Server/1.0.0',
        'Accept': 'application/json',
      },
    });

    this.setupToolHandlers();

    this.server.onerror = (error: unknown) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'biorxiv_info',
          description:
            'Unified bioRxiv/medRxiv preprint database access. 260K+ preprints. Methods: ' +
            'search_preprints (keyword search with date range filtering), ' +
            'get_preprint_details (full metadata by DOI), ' +
            'get_categories (list subject categories), ' +
            'search_published_preprints (find preprints published in journals), ' +
            'search_by_funder (find preprints by funding org ROR ID), ' +
            'get_content_statistics (submission stats), ' +
            'get_usage_statistics (views/downloads stats).',
          inputSchema: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: [
                  'search_preprints',
                  'get_preprint_details',
                  'get_categories',
                  'search_published_preprints',
                  'search_by_funder',
                  'get_content_statistics',
                  'get_usage_statistics',
                ],
                description: 'The bioRxiv operation to perform.',
              },
              query: {
                type: 'string',
                description: 'Search keywords (for search_preprints — client-side filter against title/abstract)',
              },
              doi: {
                type: 'string',
                description: 'Preprint DOI e.g. "10.1101/2024.01.15.575123" (for get_preprint_details)',
              },
              server: {
                type: 'string',
                enum: ['biorxiv', 'medrxiv'],
                description: 'Which server to query (default "biorxiv")',
              },
              date_from: {
                type: 'string',
                description: 'Start date YYYY-MM-DD (optional)',
              },
              date_to: {
                type: 'string',
                description: 'End date YYYY-MM-DD (optional, defaults to today)',
              },
              category: {
                type: 'string',
                description: 'Subject category filter (optional)',
              },
              publisher: {
                type: 'string',
                description: 'Publisher DOI prefix e.g. "10.1038" for Nature (for search_published_preprints)',
              },
              funder_ror_id: {
                type: 'string',
                description: 'ROR ID e.g. "021nxhr62" for NIH (for search_by_funder)',
              },
              interval: {
                type: 'string',
                description: 'Time interval for stats: "m" (monthly) or "y" (yearly)',
              },
              cursor: {
                type: 'number',
                description: 'Pagination offset (default 0)',
              },
              limit: {
                type: 'number',
                description: 'Maximum results to return (default 30)',
              },
            },
            required: ['method'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: unknown) => {
      const req = request as { params: { name: string; arguments?: Record<string, unknown> } };
      const { name, arguments: args } = req.params;

      if (name !== 'biorxiv_info') {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      const a = (args || {}) as Record<string, unknown>;
      if (!a.method || typeof a.method !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, '"method" parameter is required');
      }

      try {
        switch (a.method) {
          case 'search_preprints':
            return await this.searchPreprints(a);
          case 'get_preprint_details':
            return await this.getPreprint(a);
          case 'get_categories':
            return this.getCategories();
          case 'search_published_preprints':
            return await this.searchPublished(a);
          case 'search_by_funder':
            return await this.searchByFunder(a);
          case 'get_content_statistics':
            return await this.getContentStats(a);
          case 'get_usage_statistics':
            return await this.getUsageStats(a);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown method: ${a.method}`);
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error in ${a.method}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private ok(data: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  // ---------------------------------------------------------------------------
  // search_preprints — client-side keyword filter over date-range browsing
  // ---------------------------------------------------------------------------
  private async searchPreprints(args: Record<string, unknown>) {
    const query = args.query as string;
    if (!query) throw new McpError(ErrorCode.InvalidParams, '"query" is required for search_preprints');

    const srv = (args.server as string) || 'biorxiv';
    const dateFrom = (args.date_from as string) || this.daysAgo(30);
    const dateTo = (args.date_to as string) || this.today();
    const category = args.category as string | undefined;
    const limit = (args.limit as number) || 30;
    const queryLower = query.toLowerCase();

    const matched: any[] = [];
    const maxPages = 3; // Cap at 300 results scanned

    for (let page = 0; page < maxPages; page++) {
      const cursor = page * 100;
      const resp = await this.api.get(
        `/details/${srv}/${dateFrom}/${dateTo}/${cursor}/json`
      );

      const collection = resp.data?.collection || [];
      if (collection.length === 0) break;

      for (const p of collection) {
        const titleMatch = (p.title || '').toLowerCase().includes(queryLower);
        const abstractMatch = (p.abstract || '').toLowerCase().includes(queryLower);
        const categoryMatch = !category || (p.category || '').toLowerCase() === category.toLowerCase();

        if ((titleMatch || abstractMatch) && categoryMatch) {
          matched.push({
            doi: p.doi,
            title: p.title,
            authors: p.authors,
            date: p.date,
            category: p.category,
            abstract: (p.abstract || '').slice(0, 500),
            version: p.version,
            author_corresponding: p.author_corresponding,
            author_corresponding_institution: p.author_corresponding_institution,
            published: p.published || null,
          });
          if (matched.length >= limit) break;
        }
      }

      if (matched.length >= limit) break;
      // If we got less than 100 results, no more pages
      if (collection.length < 100) break;
    }

    return this.ok({
      query,
      server: srv,
      date_range: { from: dateFrom, to: dateTo },
      category: category || null,
      count: matched.length,
      preprints: matched,
    });
  }

  // ---------------------------------------------------------------------------
  // get_preprint_details
  // ---------------------------------------------------------------------------
  private async getPreprint(args: Record<string, unknown>) {
    const doi = args.doi as string;
    if (!doi) throw new McpError(ErrorCode.InvalidParams, '"doi" is required for get_preprint_details');

    const srv = (args.server as string) || 'biorxiv';
    const resp = await this.api.get(`/details/${srv}/${doi}/json`);
    const collection = resp.data?.collection || [];

    if (collection.length === 0) {
      return this.ok({ doi, error: 'Preprint not found' });
    }

    // Return all versions
    const versions = collection.map((v: any) => ({
      doi: v.doi,
      title: v.title,
      authors: v.authors,
      abstract: v.abstract,
      date: v.date,
      category: v.category,
      version: v.version,
      type: v.type,
      license: v.license,
      jatsxml: v.jatsxml,
      author_corresponding: v.author_corresponding,
      author_corresponding_institution: v.author_corresponding_institution,
      published: v.published || null,
    }));

    return this.ok({
      doi,
      server: srv,
      version_count: versions.length,
      versions,
    });
  }

  // ---------------------------------------------------------------------------
  // get_categories
  // ---------------------------------------------------------------------------
  private getCategories() {
    return this.ok({
      biorxiv: { count: BIORXIV_CATEGORIES.length, categories: BIORXIV_CATEGORIES },
      medrxiv: { count: MEDRXIV_CATEGORIES.length, categories: MEDRXIV_CATEGORIES },
    });
  }

  // ---------------------------------------------------------------------------
  // search_published_preprints
  // ---------------------------------------------------------------------------
  private async searchPublished(args: Record<string, unknown>) {
    const srv = (args.server as string) || 'biorxiv';
    const dateFrom = (args.date_from as string) || this.daysAgo(30);
    const dateTo = (args.date_to as string) || this.today();
    const publisher = args.publisher as string | undefined;
    const limit = (args.limit as number) || 30;
    const cursor = (args.cursor as number) || 0;

    const resp = await this.api.get(
      `/pubs/${srv}/${dateFrom}/${dateTo}/${cursor}/json`
    );

    let collection = resp.data?.collection || [];

    // Client-side publisher filter
    if (publisher) {
      collection = collection.filter(
        (p: any) => (p.published_doi || '').startsWith(publisher)
      );
    }

    const results = collection.slice(0, limit).map((p: any) => ({
      biorxiv_doi: p.biorxiv_doi || p.doi,
      published_doi: p.published_doi,
      preprint_title: p.preprint_title || p.title,
      preprint_category: p.preprint_category || p.category,
      preprint_date: p.preprint_date || p.date,
      published_date: p.published_date,
      published_citation_count: p.published_citation_count,
    }));

    return this.ok({
      server: srv,
      date_range: { from: dateFrom, to: dateTo },
      publisher: publisher || null,
      count: results.length,
      publications: results,
    });
  }

  // ---------------------------------------------------------------------------
  // search_by_funder
  // ---------------------------------------------------------------------------
  private async searchByFunder(args: Record<string, unknown>) {
    const rorId = args.funder_ror_id as string;
    if (!rorId) throw new McpError(ErrorCode.InvalidParams, '"funder_ror_id" is required for search_by_funder');

    const srv = (args.server as string) || 'biorxiv';
    const dateFrom = (args.date_from as string) || '2025-04-10'; // Data only from 2025-04-10+
    const dateTo = (args.date_to as string) || this.today();
    const cursor = (args.cursor as number) || 0;
    const limit = (args.limit as number) || 30;

    const resp = await this.api.get(
      `/funder/${srv}/${dateFrom}/${dateTo}/${rorId}/${cursor}/json`
    );

    const collection = (resp.data?.collection || []).slice(0, limit).map((p: any) => ({
      doi: p.doi,
      title: p.title,
      authors: p.authors,
      date: p.date,
      category: p.category,
      abstract: (p.abstract || '').slice(0, 500),
      published: p.published || null,
    }));

    return this.ok({
      funder_ror_id: rorId,
      server: srv,
      date_range: { from: dateFrom, to: dateTo },
      count: collection.length,
      preprints: collection,
    });
  }

  // ---------------------------------------------------------------------------
  // get_content_statistics
  // ---------------------------------------------------------------------------
  private async getContentStats(args: Record<string, unknown>) {
    const interval = (args.interval as string) || 'm';

    const resp = await this.api.get(`/sum/${interval}/json`);
    const collection = resp.data?.collection || [];

    return this.ok({
      interval: interval === 'y' ? 'yearly' : 'monthly',
      count: collection.length,
      statistics: collection,
    });
  }

  // ---------------------------------------------------------------------------
  // get_usage_statistics
  // ---------------------------------------------------------------------------
  private async getUsageStats(args: Record<string, unknown>) {
    const interval = (args.interval as string) || 'm';
    const srv = (args.server as string) || 'biorxiv';

    const resp = await this.api.get(`/usage/${interval}/${srv}/json`);
    const collection = resp.data?.collection || [];

    return this.ok({
      interval: interval === 'y' ? 'yearly' : 'monthly',
      server: srv,
      count: collection.length,
      statistics: collection,
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('bioRxiv MCP server running on stdio');
  }
}

const server = new BioRxivServer();
server.run().catch(console.error);
