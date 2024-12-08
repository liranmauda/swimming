import fs from 'fs';
import moment from 'moment';
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

    --year                  -   Competition calender year (end of season)
    --date                  -   last date in the year

    --group                 -   Group by any of the filter fields (for example, event)
    --append                -   Will append to an existing file with the same name.
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
const output_file_name = argv.output || "swimming_results.json";
const append = Boolean(argv.append)
const year = argv.year || "2025";
const date = argv.date;

let group = argv.group;
let filename = argv.file_name || output_file_name;

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
async function _get_data(criteria) {
    let data = [];
    if (argv.pdf_path) {
        const data_array = await parse_pdf.extractPDFText(pdfPath);
        data = data.concat(parse_pdf.parseResults(data_array));
    } else if (argv.url) {
        const links = await parse_url.scrape_main_url_for_results_links(argv.url, year, date);
        for (const link of links) {
            console.log("Scrapping:", link)
            const to_concat = await parse_url.fetch_and_parse_results(link, criteria)
            data = to_concat !== undefined ? data.concat(to_concat) : data;
            // break; //For debug
        }
    } else if (argv.file_name) {
        const read_data = fs.readFileSync(filename, 'utf-8');
        data = JSON.parse(read_data)
        Object.keys(criteria).every(key =>
            filename = filename.replace(/\.json$/, "") + "-" + criteria[key].replaceAll(' ', '-') + ".json");
    } else {
        console.error("Data must be consumed from a file, pdf, or url");
        usage();
        process.exit(0);
    }

    return data;
}

async function _set_data_file(data, append) {
    if (argv.file_name && filename === output_file_name) {
        console.log("Skipping writing to the same file");
    }
    try {
        if (fs.existsSync(filename) && append) {
            //naive way, it will create arrays one after the other without appending to the same array in the file.
            fs.appendFileSync(filename, JSON.stringify(data, null, 2));
            //This will fix the naive way above. not wise performance wise but doing the work. 
            utils.fix_files_structure(filename);
        } else {
            fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        }
        console.log('Data saved to', filename);
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

    const criteria = _construct_criteria();

    let data = await _get_data(criteria);
    if (Object.keys(criteria).length > 0) {
        data = _filter_by_criteria(data, criteria);
    }
    const base_file_name = filename;
    if (group) {
        data = utils.group_by_field(data, argv.group);
        for (const key of Object.keys(data)) {
            console.log(key)
            filename = base_file_name.replace(/\.json$/, "") + "-" + key.replaceAll(' ', '-') + ".json";
            await _set_data_file(data[key], append);
        }
    } else {
        console.log(data);
        await _set_data_file(data, append);
    }
}

main();