import axios from 'axios';
import * as utils from './utils.js';
import {
    load
} from 'cheerio';

const url_prefix = 'https://loglig.com:2053'
// The URL of the page
const url = url_prefix + '/LeagueTable/AthleticsDisciplines/10358';

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
async function scrape_main_url_for_results_links(url) {
    try {

        url = await scrap_main_url_for_main_result_url(url);

        // Fetch the webpage content
        const {
            data
        } = await axios.get(url);

        const cheerio_loaded_HTML = load(data);

        // Find all "תוצאות" pages from the url
        const results_links = [];
        cheerio_loaded_HTML('a').each((index, element) => {
            const linkText = cheerio_loaded_HTML(element).text().trim();
            if (linkText.includes('תוצאות') && !linkText.includes('תוצאות מקצים')) {
                const pdfUrl = cheerio_loaded_HTML(element).attr('href');
                results_links.push(url_prefix + pdfUrl);
            }
        });
        return results_links;
    } catch (error) {
        console.error('Error during scraping main url for results links:', error);
    }
};

//TODO: explain
async function fetch_and_parse_results(url, criteria) {
    try {
        const {
            data
        } = await axios.get(url);

        const cheerio_loaded_HTML = load(data);

        const results = [];
        const event_info = cheerio_loaded_HTML('.disciplines-title h4').text().trim();
        let gender = event_info.split(" - ")[3];
        gender.includes("בנים") ? gender = "male" : gender = "female";
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
    scrape_main_url_for_results_links,
    fetch_and_parse_results,
}