import axios from 'axios';
import * as utils from './utils.js';
import {
    load
} from 'cheerio';

const url_prefix = 'https://loglig.com:2053'
// The URL of the page
const url = url_prefix + '/LeagueTable/AthleticsDisciplines/10358';

// TODO explain...
async function scrape_main_url_for_results_links(url) {
    try {
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
async function fetch_and_parse_results(url) {
    try {

        const {
            data
        } = await axios.get(url);

        const cheerio_loaded_HTML = load(data);

        const results = [];
        const event_info = cheerio_loaded_HTML('.disciplines-title h4').text().trim();
        let gender = event_info.split(" - ")[3];
        gender.includes("בנים") ? gender = "male" : gender = "female";
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

export {
    scrape_main_url_for_results_links,
    fetch_and_parse_results,
}