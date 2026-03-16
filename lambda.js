/**
 * AWS Lambda handler for /api/parse.
 * Invoke with API Gateway HTTP API (v2) or REST API (v1).
 * Query parameter: url (required) – loglig or isr.org.il results URL.
 */
import * as parse_url from './results_url_util.js';
import moment from 'moment';

const currentYear = String(new Date().getFullYear());

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function toTableRow(r) {
  return {
    swimmerName: [r.firstName, r.lastName].filter(Boolean).join(' '),
    club: r.club || '',
    event: r.event || '',
    category: r.gender || (r.age != null ? 'גיל ' + r.age : ''),
    heat: r.heat || '',
    lane: r.lane || '',
    startTime: r.startTime || '',
    date: r.event_date || '',
    entryTime: r.entryTime || '',
  };
}

/**
 * Get query param `url` from API Gateway event.
 * Supports HTTP API (v2) and REST API (v1).
 */
function getUrlFromEvent(event) {
  const q = event.queryStringParameters || {};
  if (q.url) return q.url.trim();
  // HTTP API v2 may send rawQueryString only
  const raw = event.rawQueryString || '';
  const params = new URLSearchParams(raw);
  return (params.get('url') || '').trim();
}

/**
 * Build API Gateway response.
 */
function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

/**
 * Lambda handler.
 * @param {object} event - API Gateway event (HTTP API v2 or REST API v1)
 * @param {object} context - Lambda context
 */
export async function handler(event, context) {
  // OPTIONS for CORS preflight
  const method = event.requestContext?.http?.method ?? event.httpMethod;
  if (method === 'OPTIONS') {
    return response(204, '', {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    });
  }

  if (method !== 'GET') {
    return response(405, { error: 'Method not allowed' });
  }

  const url = getUrlFromEvent(event);
  if (!url) {
    return response(400, { error: 'Missing url query parameter' });
  }

  try {
    let results = [];
    if (url.includes('isr.org.il')) {
      const logligUrl = await parse_url.scrap_main_url_for_main_result_url(url);
      if (!logligUrl) {
        return response(200, { rows: [] });
      }
      const lastDate = moment();
      const startDate = moment().subtract(1, 'year');
      const { results_links } = await parse_url.scrape_main_url_for_results_links(
        logligUrl,
        currentYear,
        lastDate,
        startDate
      );
      for (const el of results_links || []) {
        const link = el.link || el;
        const year = currentYear;
        const event_date = (el.event_date || '').split(' ')[0] || '';
        const total_registrations = el.total_registrations || '';
        const total_participants = el.total_participants || '';
        const part = await parse_url.fetch_and_parse_results(
          link,
          year,
          event_date,
          total_registrations,
          total_participants,
          {}
        );
        if (part && part.length) results = results.concat(part);
      }
    } else {
      const part = await parse_url.fetch_and_parse_results(
        url,
        currentYear,
        '',
        '',
        '',
        {}
      );
      if (part && part.length) results = part;
    }
    const rows = results.map(toTableRow);
    return response(200, { rows });
  } catch (err) {
    console.error('Parse error:', err);
    return response(500, { error: err.message || 'Parse failed' });
  }
}
