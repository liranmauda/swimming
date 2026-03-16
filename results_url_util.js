import fs from 'fs';
import axios from 'axios';
import moment from 'moment';
import * as utils from './utils.js';
import {
    load
} from 'cheerio';

const main_url_prefix = 'https://www.isr.org.il/'
const url_prefix = 'https://loglig.com:2053'
// The URL of the page
const url = url_prefix + '/LeagueTable/AthleticsDisciplines/10358';
const base_url = "https://www.isr.org.il/competitions.asp";

// Function to extract URLs from a specific date to the current date
function get_urls_from_date(cheerio_loaded_HTML, start_date, last_date) {
    console.log("get_urls_from_date:: Getting links from", start_date, "to", last_date);
    const rows = cheerio_loaded_HTML('.row');
    const formats = ['D.M.YYYY', 'YYYY-MM-DD'];
    const urls = [];

    rows.each((index, row) => {
        let date_text = cheerio_loaded_HTML(row).find('.c-date').text().trim();
        if (date_text.split('.')[0].includes('-')) {
            date_text = date_text.split('.')[0].split('-')[0] + '.' + date_text.split('.')[1] + '.' + date_text.split('.')[2];
        }
        const url = cheerio_loaded_HTML(row).find('.c-name a').attr('href');

        // if we are not getting last_date, we will use current date
        if (last_date === undefined) {
            console.error("last_date cannot be undefined");
            process.exit(1);
        }
        last_date = moment(last_date, formats)
        start_date = moment(start_date, formats)
        if (moment(date_text, formats).isBetween(start_date, last_date, undefined, '[]')) {
            urls.push(main_url_prefix + url);
        }

    });
    console.log("get_urls_from_date:: Found ", urls.length, "links");
    return urls;
};


async function get_competition_urls(url, year, last_date, start_date) {
    let url_array = [];
    //if we are not on the base url return the url provided.
    if (!url.includes(base_url)) {
        url_array.push(url);
        return {
            url_array,
            from_date: moment(last_date, 'D.M.YYYY').format('YYYY-MM-DD'),
            to_date: moment(last_date, 'D.M.YYYY').format('YYYY-MM-DD')
        }
    }
    // + "&cMonth=0&cType=1&cMode=0#searchForm" filter ius not working properly, It filters out some valid results.
    if (!url.includes('cYear')) url = url + "?cYear=" + year;
    const {
        data
    } = await axios.get(url);

    const cheerio_loaded_HTML = load(data);
    const date_text = cheerio_loaded_HTML('.row .c-date').first().text().trim();

    if (start_date === undefined) {
        start_date = moment(date_text, 'D.M.YYYY').format('YYYY-MM-DD');
    }
    console.log("Getting links from", year, "Start date", start_date, "to", last_date);

    url_array = get_urls_from_date(cheerio_loaded_HTML, start_date, last_date);

    return {
        url_array,
        from_date: start_date,
        to_date: moment(last_date, 'D.M.YYYY').format('YYYY-MM-DD')
    }
}


// scrap_main_url_for_main_result_url will get a url and check if it contains the 'https://loglig.com:2053' prefix
// if it is not it will scrap the page and return the url that contains it. 
// It will assume that the page has it and will not handle the errors for now.
// for example:
// https://www.isr.org.il/comp.asp?compID=1510 will return
// https://loglig.com:2053/LeagueTable/AthleticsDisciplines/10358 
async function scrap_main_url_for_main_result_url(url) {
    if (url.includes(url_prefix)) return url;
    // Fetch the webpage content
    const {
        data
    } = await axios.get(url);

    const cheerio_loaded_HTML = load(data);
    const iframeSrc = cheerio_loaded_HTML('iframe').attr('src');
    return iframeSrc;
}

// scrape_main_url_for_results_links will scrap the page and search for all the results links that contains 'https://loglig.com:2053'
async function scrape_main_url_for_results_links(link, year, last_date, start_date) {
    console.log("here", link, year, last_date, start_date);
    try {
        const results_links = [];
        const {
            url_array,
            from_date,
            to_date
        } = await get_competition_urls(link, year, last_date, start_date);
        for (let url of url_array) {
            url = await scrap_main_url_for_main_result_url(url);
            if (url === undefined) continue;
            // Fetch the webpage content
            const {
                data
            } = await axios.get(url);

            const cheerio_loaded_HTML = load(data);
            cheerio_loaded_HTML('tr').each((index, element) => {
                const event_date = cheerio_loaded_HTML(element).find('td:nth-child(5)').text().trim();
                const total_registrations = cheerio_loaded_HTML(element).find('#TotalRegistrations').text().trim();
                const total_participants = cheerio_loaded_HTML(element).find('#TotalParticipants').text().trim();
                let pdf_url;
                // Find all "תוצאות" pages from the url
                cheerio_loaded_HTML(element).find('a').each((index, element) => {
                    const linkText = cheerio_loaded_HTML(element).text().trim();
                    if (linkText.includes('תוצאות') && !linkText.includes('תוצאות מקצים')) {
                        pdf_url = cheerio_loaded_HTML(element).attr('href');
                        // results_links.push(url_prefix + pdfUrl);
                    }
                });
                if (total_participants === undefined) total_participants = "-";
                if (total_registrations === undefined) total_registrations = "-";
                let link = url;
                if (pdf_url !== undefined) {
                    link = url_prefix + pdf_url
                }
                results_links.push({
                    event_date,
                    total_registrations: total_registrations,
                    total_participants: total_participants,
                    link,
                });

            });
        }
        console.log("scrape_main_url_for_results_links:: Found ", results_links.length, "links");
        return {
            results_links,
            from_date,
            to_date
        };
    } catch (error) {
        console.error('Error during scraping main url for results links:', error);
    }
};

// Parse start list HTML (GenerateSwimmingAllStartList) and return Map of key -> entryTime.
// Key: eventName|heat|lane or lastName|firstName|birthYear for matching to results.
function parse_start_list_html(html, eventNameForSection) {
    const $ = load(html);
    const entryMap = new Map();
    let currentEvent = eventNameForSection || '';
    $('table').each((ti, table) => {
        const $table = $(table);
        const headers = [];
        $table.find('thead th').each((i, el) => { headers.push(utils.reverse_string($(el).text().trim())); });
        const entryTimeIdx = headers.findIndex(h => h.includes('זמן כניסה'));
        const startTimeIdx = headers.findIndex(h => h.includes('שעת התחלה'));
        if (entryTimeIdx < 0) return;
        const laneIdx = headers.findIndex(h => h.includes('מסלול'));
        const heatIdx = headers.findIndex(h => h.includes('מקצה'));
        const lastNameIdx = headers.findIndex(h => h.includes('משפחה'));
        const firstNameIdx = headers.findIndex(h => h.includes('פרטי'));
        const birthYearIdx = headers.findIndex(h => h.includes('שנת לידה'));
        $table.find('tbody tr').each((ri, tr) => {
            const cells = $(tr).find('td');
            if (cells.length < Math.max(entryTimeIdx, laneIdx, 0) + 1) return;
            const entryTime = $(cells[entryTimeIdx]).text().trim();
            const lane = laneIdx >= 0 ? $(cells[laneIdx]).text().trim() : '';
            const heat = heatIdx >= 0 ? $(cells[heatIdx]).text().trim() : '';
            const lastName = lastNameIdx >= 0 ? utils.reverse_string($(cells[lastNameIdx]).text().trim()) : '';
            const firstName = firstNameIdx >= 0 ? utils.reverse_string($(cells[firstNameIdx]).text().trim()) : '';
            const birthYear = birthYearIdx >= 0 ? $(cells[birthYearIdx]).text().trim() : '';
            const key = (currentEvent || eventNameForSection) && lane && heat
                ? `${currentEvent || eventNameForSection}|${heat}|${lane}`
                : `${lastName}|${firstName}|${birthYear}`;
            if (key && entryTime) entryMap.set(key, entryTime);
        });
    });
    return entryMap;
}

// Fetch start list page from same origin if linked from the results page; merge entry times into results.
async function fetch_and_merge_entry_times(resultsPageHtml, resultsPageUrl, results, eventName) {
    const $ = load(resultsPageHtml);
    let startListHref = null;
    $('a[href*="GenerateSwimmingAllStartList"], a[href*="StartList"]').each((i, el) => {
        const href = $(el).attr('href');
        if (href) startListHref = href.startsWith('http') ? href : new URL(href, resultsPageUrl).href;
    });
    if (!startListHref) return results;
    try {
        const { data } = await axios.get(startListHref);
        const entryMap = parse_start_list_html(data, eventName);
        if (!entryMap.size) return results;
        results.forEach(r => {
            const key = `${r.heat}|${r.lane}`;
            const key2 = `${r.lastName}|${r.firstName}|${r.birthYear}`;
            r.entryTime = entryMap.get(`${eventName}|${r.heat}|${r.lane}`) || entryMap.get(key) || entryMap.get(key2) || r.entryTime || '';
        });
    } catch (e) {
        console.warn('Could not fetch start list for entry times:', e.message);
    }
    return results;
}

//TODO: explain
async function fetch_and_parse_results(url, year, event_date, total_registrations, total_participants, criteria) {
    try {
        const {
            data
        } = await axios.get(url);
        const cheerio_loaded_HTML = load(data);
        const results = [];
        const event_info = cheerio_loaded_HTML('.disciplines-title h4').text().trim();

        const gender = utils.translate_gender(event_info);
        let event_name;
        if (event_info === undefined) return;
        if (event_date === "" && event_info !== "") {
            event_date = event_info.split("\n")[0].split("-")[1].trim();
        }

        //The reason we pass event_info is for future use, if we would like to skip scrapping urls based on other criteria.
        if (should_skip_based_on_criteria(event_info, criteria)) return;
        try {
            if (event_info.split("\n")[1] !== undefined) {
                event_name = utils.extract_event_name(event_info.split("\n")[1].trim(), true);
            } else {
                event_name = utils.extract_event_name(event_info, false);
            }
        } catch (e) {
            console.error("Error parsing event name:", e);
            return results
        }

        // Build column index map from thead if present (supports optional שעת התחלה, זמן כניסה)
        const col = {};
        const theadRow = cheerio_loaded_HTML('table.res-table thead tr').first();
        if (theadRow.length) {
            theadRow.find('th').each((i, el) => {
                const text = utils.reverse_string(cheerio_loaded_HTML(el).text().trim());
                if (text.includes('מיקום') || text.includes('position')) col.position = i;
                else if (text.includes('שם') && text.includes('משפחה')) col.lastName = i;
                else if (text.includes('שם') && text.includes('פרטי')) col.firstName = i;
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
        const getCell = (cells, key, defaultIdx) => {
            const idx = col[key] !== undefined ? col[key] : defaultIdx;
            return idx >= 0 && cells[idx] ? cheerio_loaded_HTML(cells[idx]).text().trim() : '';
        };

        cheerio_loaded_HTML('table.res-table tbody tr').each((index, element) => {
            const cells = cheerio_loaded_HTML(element).find('td');
            // Skip rows with fewer than expected columns (e.g., header rows or notes)
            if (cells.length >= 8) {
                const position = getCell(cells, 'position', 0);
                let fullName;
                if (col.firstName !== undefined && col.lastName !== undefined) {
                    fullName = utils.reverse_string(getCell(cells, 'lastName', 1) + ' ' + getCell(cells, 'firstName', 1)).trim();
                } else {
                    fullName = utils.reverse_string(cheerio_loaded_HTML(cells[1]).text().trim());
                }
                const birthYear = getCell(cells, 'birthYear', 2) || cheerio_loaded_HTML(cells[2]).text().trim();
                const club = utils.reverse_string(getCell(cells, 'club', 3) || cheerio_loaded_HTML(cells[3]).text().trim());
                const heat = getCell(cells, 'heat', 4) || cheerio_loaded_HTML(cells[4]).text().trim();
                const lane = getCell(cells, 'lane', 5) || cheerio_loaded_HTML(cells[5]).text().trim();
                const time = getCell(cells, 'time', 6) || cheerio_loaded_HTML(cells[6]).text().trim();
                const score = getCell(cells, 'score', 7) || cheerio_loaded_HTML(cells[7]).text().trim();
                // שעת התחלה (heat start time), זמן כניסה (entry time) - from optional columns or fixed 9th/10th
                const startTime = getCell(cells, 'startTime', 8) || (cells.length > 8 ? cheerio_loaded_HTML(cells[8]).text().trim() : '');
                const entryTime = getCell(cells, 'entryTime', 9) || (cells.length > 9 ? cheerio_loaded_HTML(cells[9]).text().trim() : '');

                const name = fullName.split(' ').filter(item => item.trim() !== '');

                results.push({
                    event: event_name,
                    event_date,
                    total_registrations,
                    total_participants,
                    age: Number(year) - Number(birthYear),
                    gender,
                    score,
                    time,
                    club,
                    birthYear,
                    firstName: name[name.length - 1] || '',
                    lastName: name[0] || '',
                    lane,
                    heat,
                    position,
                    startTime: startTime || '',   // שעת התחלה
                    entryTime: entryTime || ''    // זמן כניסה
                });
            }
        });

        // Optionally fetch start list from same page to fill זמן כניסה (entry time)
        if (results.length) {
            await fetch_and_merge_entry_times(data, url, results, event_name);
        }

        return results;

    } catch (error) {
        console.error('Error fetching or parsing results from:', url, error);
        fs.existsSync("error_urls.log") ?
            fs.appendFileSync("error_urls.log", url + "\n") : fs.writeFileSync("error_urls.log", url + "\n");
    }
}


//return true if we should skip this url, currently only support gender
function should_skip_based_on_criteria(event_info, criteria) {
    const gender = utils.translate_gender(event_info);
    if (criteria.gender === gender) return true;
    return false;
}

export {
    get_competition_urls,
    scrap_main_url_for_main_result_url,
    scrape_main_url_for_results_links,
    fetch_and_parse_results,
    parse_start_list_html,
}