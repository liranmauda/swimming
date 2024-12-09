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

// Function to extract the first row date
function _get_first_row_date(cheerio_loaded_HTML) {
    const date_text = cheerio_loaded_HTML('.row .c-date').first().text().trim();
    return moment(date_text, 'D.M.YYYY').format('YYYY-MM-DD'); // Convert to standardized format
};

// Function to extract URLs from a specific date to the current date
function get_urls_from_date(cheerio_loaded_HTML, start_date, last_date) {
    const rows = cheerio_loaded_HTML('.row');
    const urls = [];

    rows.each((index, row) => {
        const date_text = cheerio_loaded_HTML(row).find('.c-date').text().trim();
        const url = cheerio_loaded_HTML(row).find('.c-name a').attr('href');

        // if we are not getting last_date, we will use current date
        if (last_date === undefined) {
            last_date = moment();
        }

        // console.log("LMLM", start_date, "LMLM", last_date)
        if (moment(date_text, 'D.M.YYYY').isBetween(start_date, last_date, undefined, '[]')) {
            urls.push(main_url_prefix + url);
        }
    });

    console.log("LMLM", urls)
    return urls;
};


async function get_competition_urls(url, year, date, last_date) {
    const url_array = [];
    //if we are not on the base url return the url provided.
    if (!url.includes(base_url)) {
        url_array.push(url);
        return url_array;
    }

    if (!url.includes('cYear')) url = url + "?cYear=" + year + "&cMonth=0&cType=1&cMode=0#searchForm";
    console.log("LMLM", url);

    const {
        data
    } = await axios.get(url);

    const cheerio_loaded_HTML = load(data);
    const date_text = cheerio_loaded_HTML('.row .c-date').first().text().trim();

    if (date === undefined) {
        date = moment(date_text, 'D.M.YYYY').format('YYYY-MM-DD');
    }
    console.log("Getting links from", year, "Start date", date);

    return get_urls_from_date(cheerio_loaded_HTML, date, last_date);

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
async function scrape_main_url_for_results_links(link, year, date) {
    try {
        const results_links = [];
        const url_array = await get_competition_urls(link, year, date);
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
                if (pdf_url !== undefined) {
                    results_links.push({
                        event_date,
                        total_registrations: total_registrations,
                        total_participants: total_participants,
                        link: url_prefix + pdf_url,
                    });
                }
            });
        }
        return results_links;
    } catch (error) {
        console.error('Error during scraping main url for results links:', error);
    }
};

//TODO: explain
async function fetch_and_parse_results(url, event_date, total_registrations, total_participants, criteria) {
    try {
        const {
            data
        } = await axios.get(url);

        const cheerio_loaded_HTML = load(data);

        const results = [];
        let gender;
        const event_info = cheerio_loaded_HTML('.disciplines-title h4').text().trim();
        event_info.includes("בנים") ? gender = "male" : gender = "female";
        if (event_info === undefined) return;
        //The reason we pass event_info is for future use, if we would like to skip scrapping urls based on other criteria.
        if (should_skip_based_on_criteria(event_info, criteria)) return;

        const event_name = utils.extract_event_name(event_info.split("\n")[1].trim());

        cheerio_loaded_HTML('table.res-table tbody tr').each((index, element) => {
            const cells = cheerio_loaded_HTML(element).find('td');

            // Skip rows with fewer than expected columns (e.g., header rows or notes)
            if (cells.length === 8) {
                // Get the relevant data from each column (adjust indices as necessary)
                const position = cheerio_loaded_HTML(cells[0]).text().trim();
                const fullName = utils.reverse_string(cheerio_loaded_HTML(cells[1]).text().trim());
                const birthYear = cheerio_loaded_HTML(cells[2]).text().trim();
                const club = utils.reverse_string(cheerio_loaded_HTML(cells[3]).text().trim());
                const heat = cheerio_loaded_HTML(cells[4]).text().trim();
                const lane = cheerio_loaded_HTML(cells[5]).text().trim();
                const time = cheerio_loaded_HTML(cells[6]).text().trim();
                const score = cheerio_loaded_HTML(cells[7]).text().trim();

                // Split the full name into first and last name (assuming a 2-part name)
                const [lastName, firstName] = fullName.split(' ');

                results.push({
                    event: event_name,
                    event_date,
                    total_registrations,
                    total_participants,
                    gender,
                    score,
                    time,
                    club,
                    birthYear,
                    firstName,
                    lastName,
                    lane,
                    heat,
                    position
                });
            }
        });

        return results;

    } catch (error) {
        console.error('Error fetching or parsing results:', error);
    }
}


//return true if we should skip this url, currently only support gender
function should_skip_based_on_criteria(event_info, criteria) {
    let gender = event_info.split(" - ")[3];
    gender.includes("בנים") ? gender = "male" : gender = "female";
    if (criteria.gender === gender) return true;
    return false;
}

export {
    get_competition_urls,
    scrape_main_url_for_results_links,
    fetch_and_parse_results,
}