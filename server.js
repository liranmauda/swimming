import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as parse_url from './results_url_util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8765;
const currentYear = String(new Date().getFullYear());

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

app.use(express.static(join(__dirname)));

app.get('/api/parse', async (req, res) => {
  const url = (req.query.url || '').trim();
  if (!url) {
    return res.status(400).send('Missing url query parameter');
  }
  try {
    let results = [];
    if (url.includes('isr.org.il')) {
      const logligUrl = await parse_url.scrap_main_url_for_main_result_url(url);
      if (!logligUrl) {
        return res.json({ rows: [] });
      }
      const moment = (await import('moment')).default;
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
    res.json({ rows });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).send(err.message || 'Parse failed');
  }
});

app.listen(PORT, () => {
  console.log('Server at http://localhost:' + PORT);
});
