/**
 * Client-side parser for loglig/isr.org.il results HTML.
 * Works in the browser so parse-link can run on GitHub Pages (no backend).
 */
(function (global) {
  const timeRegex = /^(\d{2}):(\d{2})\.(\d{2})$/;
  const numberRegex = /\d+/g;

  function hasHebrew(text) {
    return /[\u0590-\u05FF]/.test(String(text));
  }

  function reverseString(line) {
    line = String(line);
    if (timeRegex.test(line)) return line;
    if (!hasHebrew(line)) return line;
    const parts = line.split(numberRegex);
    const numbers = line.match(numberRegex);
    const reversedParts = parts.map(function (part) {
      return part.split('').reverse().join('');
    });
    let result = '';
    for (let i = reversedParts.length - 1; i >= 0; i--) {
      if (numbers && numbers[i]) result += numbers[i];
      result += reversedParts[i];
    }
    return result;
  }

  function translateGender(text) {
    if (!text) return '';
    const t = String(text);
    if (t.includes('בנים') || t.includes('גברים')) return 'male';
    return 'female';
  }

  function extractEventName(eventInfo) {
    if (!eventInfo || !eventInfo.trim()) return '';
    const parts = eventInfo.split('\n');
    const line = (parts[1] || parts[0] || '').trim();
    const dashParts = line.split('-');
    const last = (dashParts[0] || '').trim();
    const match = last.match(/(\d+)\s*מ/);
    const pool = match ? match[1] + 'm' : '';
    const hebrew = last.replace(/[0-9A-Za-z\s-]+/g, '').trim();
    const map = {
      'מעורבאישי': 'Individual medley',
      'חופשי': 'Freestyle',
      'גב': 'Backstroke',
      'חזה': 'Breaststroke',
      'פרפר': 'Butterfly',
      'חופשישליחים': 'Freestyle relay',
      'מעורבשליחים': 'Medley relay'
    };
    const name = map[hebrew] || hebrew || last;
    return pool ? name + ' ' + pool : name;
  }

  function parseResultsTable(doc, eventName, eventDate, gender) {
    const rows = [];
    const table = doc.querySelector('table.res-table');
    if (!table) return rows;

    const col = {};
    const theadRow = table.querySelector('thead tr');
    if (theadRow) {
      theadRow.querySelectorAll('th').forEach(function (th, i) {
        const text = reverseString((th.textContent || '').trim());
        if (text.includes('מיקום') || text.includes('position')) col.position = i;
        else if (text.includes('משפחה')) col.lastName = i;
        else if (text.includes('פרטי')) col.firstName = i;
        else if (text.includes('שנת לידה')) col.birthYear = i;
        else if (text.includes('מועדון')) col.club = i;
        else if (text.includes('מקצה') || text.includes('heat')) col.heat = i;
        else if (text.includes('מסלול') || text.includes('lane')) col.lane = i;
        else if ((text.includes('תוצאה') || text.includes('זמן')) && !text.includes('כניסה')) col.time = i;
        else if (text.includes('ניקוד') || text.includes('score')) col.score = i;
        else if (text.includes('שעת התחלה')) col.startTime = i;
        else if (text.includes('זמן כניסה')) col.entryTime = i;
      });
    }

    function getCell(cells, key, defaultIdx) {
      const idx = col[key] !== undefined ? col[key] : defaultIdx;
      const cell = cells[idx];
      return cell ? (cell.textContent || '').trim() : '';
    }

    table.querySelectorAll('tbody tr').forEach(function (tr) {
      const cells = tr.querySelectorAll('td');
      if (cells.length < 8) return;
      const c = function (i) { return (cells[i] && cells[i].textContent) ? cells[i].textContent.trim() : ''; };
      let fullName;
      if (col.firstName !== undefined && col.lastName !== undefined) {
        fullName = reverseString(getCell(cells, 'lastName', 1) + ' ' + getCell(cells, 'firstName', 1)).trim();
      } else {
        fullName = reverseString(c(1));
      }
      const birthYear = getCell(cells, 'birthYear', 2) || c(2);
      const club = reverseString(getCell(cells, 'club', 3) || c(3));
      const heat = getCell(cells, 'heat', 4) || c(4);
      const lane = getCell(cells, 'lane', 5) || c(5);
      const startTime = getCell(cells, 'startTime', 8) || (cells.length > 8 ? c(8) : '');
      const entryTime = getCell(cells, 'entryTime', 9) || (cells.length > 9 ? c(9) : '');
      const nameParts = fullName.split(' ').filter(function (x) { return x.trim(); });
      const firstName = nameParts[nameParts.length - 1] || '';
      const lastName = nameParts[0] || '';
      const year = new Date().getFullYear();
      const age = birthYear ? (year - parseInt(birthYear, 10)) : '';
      rows.push({
        swimmerName: fullName || (firstName + ' ' + lastName),
        club: club,
        event: eventName,
        category: gender || (age ? 'גיל ' + age : ''),
        heat: heat,
        lane: lane,
        startTime: startTime,
        date: eventDate,
        entryTime: entryTime
      });
    });
    return rows;
  }

  /**
   * Parse a single loglig results page HTML. Returns { rows: [...] } for the table.
   */
  function parseResultsPageHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const titleEl = doc.querySelector('.disciplines-title h4');
    const eventInfo = titleEl ? titleEl.textContent.trim() : '';
    if (!eventInfo) return { rows: [] };

    let eventDate = '';
    try {
      const firstLine = eventInfo.split('\n')[0] || '';
      const dashPart = firstLine.split('-')[1];
      if (dashPart) eventDate = dashPart.trim();
    } catch (_) {}

    const gender = translateGender(eventInfo);
    const eventName = extractEventName(eventInfo);
    const tableRows = parseResultsTable(doc, eventName, eventDate, gender);
    return { rows: tableRows };
  }

  /**
   * Fetch URL via CORS proxy and parse. Returns Promise<{ rows: [...] }>.
   */
  function fetchAndParseWithProxy(targetUrl, corsProxyUrl) {
    const proxy = (corsProxyUrl || 'https://api.allorigins.win/raw?url=').replace(/\/?$/, '');
    const url = proxy + (proxy.includes('?') ? '&' : '?') + 'url=' + encodeURIComponent(targetUrl);
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Proxy fetch failed: ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var data;
        try {
          data = JSON.parse(text);
          if (data.contents) text = data.contents;
        } catch (_) {}
        return parseResultsPageHtml(text);
      });
  }

  /**
   * Resolve isr.org.il page to get iframe (loglig) URL from HTML.
   */
  function getIframeSrcFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const iframe = doc.querySelector('iframe[src]');
    return iframe ? iframe.getAttribute('src') : null;
  }

  /**
   * From loglig main page HTML, get all result links (תוצאות).
   */
  function getResultLinksFromLogligHtml(html, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = [];
    doc.querySelectorAll('tr').forEach(function (tr) {
      tr.querySelectorAll('a').forEach(function (a) {
        const text = (a.textContent || '').trim();
        const href = a.getAttribute('href');
        if (href && text.includes('תוצאות') && !text.includes('תוצאות מקצים')) {
          try {
            var full = href.startsWith('http') ? href : new URL(href, baseUrl).href;
            links.push(full);
          } catch (_) {}
        }
      });
    });
    return links;
  }

  /**
   * Parse one URL. If it's isr.org.il, resolve iframe and result links, then parse each.
   * If it's loglig directly, parse that page. Returns Promise<{ rows: [...] }>.
   */
  function parseUrlWithProxy(targetUrl, corsProxyUrl) {
    const proxy = (corsProxyUrl || 'https://api.allorigins.win/raw?url=').replace(/\/?$/, '');
    function fetchViaProxy(url) {
      const u = proxy + (proxy.includes('?') ? '&' : '?') + 'url=' + encodeURIComponent(url);
      return fetch(u).then(function (r) {
        if (!r.ok) throw new Error('Fetch failed');
        return r.text();
      }).then(function (text) {
        try {
          var d = JSON.parse(text);
          if (d.contents) return d.contents;
        } catch (_) {}
        return text;
      });
    }

    if (targetUrl.indexOf('isr.org.il') !== -1) {
      return fetchViaProxy(targetUrl).then(function (html) {
        var logligUrl = getIframeSrcFromHtml(html);
        if (!logligUrl) return { rows: [] };
        return fetchViaProxy(logligUrl).then(function (logligHtml) {
          var resultLinks = getResultLinksFromLogligHtml(logligHtml, logligUrl);
          if (resultLinks.length === 0) return { rows: [] };
          var all = [];
          return resultLinks.reduce(function (promise, link) {
            return promise.then(function () {
              return fetchViaProxy(link).then(function (pageHtml) {
                var out = parseResultsPageHtml(pageHtml);
                all = all.concat(out.rows || []);
                return all;
              });
            });
          }, Promise.resolve()).then(function () {
            return { rows: all };
          });
        });
      });
    }

    return fetchAndParseWithProxy(targetUrl, corsProxyUrl);
  }

  global.ParseResultsClient = {
    parseResultsPageHtml: parseResultsPageHtml,
    fetchAndParseWithProxy: fetchAndParseWithProxy,
    parseUrlWithProxy: parseUrlWithProxy
  };
})(typeof window !== 'undefined' ? window : this);
