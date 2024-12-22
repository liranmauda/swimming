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
    const rows = cheerio_loaded_HTML('.row');
    const formats = ['D.M.YYYY', 'YYYY-MM-DD'];
    const urls = [];

    rows.each((index, row) => {
        const date_text = cheerio_loaded_HTML(row).find('.c-date').text().trim();
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

    return urls;
};


async function get_competition_urls(url, year, last_date, start_date) {
    let url_array = [];
    //if we are not on the base url return the url provided.
    if (!url.includes(base_url)) {
        url_array.push(url);
        return url_array;
    }

    if (!url.includes('cYear')) url = url + "?cYear=" + year + "&cMonth=0&cType=1&cMode=0#searchForm";
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
    console.log("here", link)
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
        return {
            results_links,
            from_date,
            to_date
        };
    } catch (error) {
        console.error('Error during scraping main url for results links:', error);
    }
};

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
        //The reason we pass event_info is for future use, if we would like to skip scrapping urls based on other criteria.
        if (should_skip_based_on_criteria(event_info, criteria)) return;

        try {
            event_name = utils.extract_event_name(event_info.split("\n")[1].trim());
        } catch (e) {
            return results
        }

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
                // const [lastName, firstName] = fullName.split(' ');
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
                    firstName: name[name.length - 1],
                    lastName: name[0],
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
    const gender = utils.translate_gender(event_info);
    if (criteria.gender === gender) return true;
    return false;
}

export {
    get_competition_urls,
    scrape_main_url_for_results_links,
    fetch_and_parse_results,
}