import fs from 'fs';
import minimist from 'minimist';
import * as parse_pdf from './parse_results_pdf_util.js';
import * as parse_url from './results_url_util.js';
import * as utils from './utils.js';

const argv = minimist(process.argv.slice(2));

function usage() {
    console.log(`
    --help                  -   Show this help
    --pdf_path              -   The path for the pdf to parse
    --url                   -   the competition url page
    --file_name             -   Input file name
    --output                -   The output file name

    #### Reports
    The following flags can be use for filtering the report.
    It can be used in combination
    Example: --event <event name> --club <club name or subset>

    --event                 -   Report by event name
    --score                 -   Report by international score
    --time                  -   Report by time (faster then)
    --club                  -   Report by club (or subset, example מכבי)
    --birthYear             -   Report by birth year
    --firstName             -   Report by first name
    --lastName              -   Report by last name
    --lane                  -   Report by lane
    --heat                  -   Report by heat
    --position              -   Report by position
    `);
}

if (argv.help) {
    usage();
    process.exit(3);
}

if (argv.pdf_path && argv.file_name) {
    console.warn("pdf_path and file_name cannot be set together");
    process.exit(3);
}

if (argv.url && argv.file_name) {
    console.warn("url and file_name cannot be set together");
    process.exit(3);
}

if (argv.pdf_path && argv.url) {
    console.warn("pdf_path and url cannot be set together");
    process.exit(3);
}

const pdfPath = argv.pdf_path || "./";
const url = argv.url;
const output_file_name = argv.output || "swimming_results.json";
const filename = argv.file_name || output_file_name;

const filters = [
    "event",
    "gender",
    "score",
    "time",
    "club",
    "birthYear",
    "firstName",
    "lastName",
    "lane",
    "heat",
    "position",
]

// _get_data will get the data from a PDF or from a file already created
async function _get_data() {
    let data = [];
    if (argv.pdf_path) {
        const data_array = await parse_pdf.extractPDFText(pdfPath);
        data = data.concat(parse_pdf.parseResults(data_array));
    } else if (argv.url) {
        const links = await parse_url.scrape_main_url_for_results_links(url);
        for (const link of links) {
            console.log("Scrapping:", link)
            data = data.concat(await parse_url.fetch_and_parse_results(link));
            // break; //For debug
        }
    } else {
        const read_data = fs.readFileSync(filename, 'utf-8');
        data = JSON.parse(read_data)
    }

    return data;
}

async function _set_data_file(data) {
    try {
        fs.writeFileSync(output_file_name, JSON.stringify(data, null, 2));
        console.log('Data saved to', output_file_name);
    } catch (error) {
        console.error('Error processing PDF:', error);
    }
}


// _construct_criteria will build the criteria to filter upon
function _construct_criteria() {
    const criteria = {};
    for (const filter of filters) {
        if (argv[filter]) {
            criteria[filter] = utils.reverse_string(argv[filter]);
        }
    }
    console.log(criteria);
    return criteria;
}

// Function to filter based on dynamic keys
function _filter_by_criteria(data, criteria) {
    return data.filter(item => {
        return Object.keys(criteria).every(key => item[key].includes(criteria[key]));
    });
}


async function main() {
    let data = await _get_data();
    const criteria = _construct_criteria();
    if (Object.keys(criteria).length > 0) {
        data = _filter_by_criteria(data, criteria);
    }
    console.log(data);
    await _set_data_file(data);
}

main();