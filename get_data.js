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
    --last_date             -   last date in the year
    --start_date            -   start date in the year

    --group                 -   Group by any of the filter fields (for example, event)
    --append                -   Will append to an existing file with the same name.
    `);
}

if (argv.help) {
    usage();
    process.exit(3);
}

const conflict_flags = ['pdf_path', 'file_name', 'url'];
const conflict_flags_count = conflict_flags.filter(flag => argv[flag]).length;
if (conflict_flags_count > 1) {
    console.warn("Conflicting flags: pdf_path, file_name, and url cannot be set together.");
    process.exit(3);
}

const append = Boolean(argv.append)
const pdfPath = argv.pdf_path || "./";
const last_date = argv.last_date || moment();
const start_date = argv.start_date; //TODO: check if we need it
const is_output_file_name = Boolean(argv.output);
const output_file_name = argv.output || "swimming_results.json";

let group = argv.group;
let year = argv.year || "2025";
let filename = argv.file_name || output_file_name;

const filters = [
    "event",
    "event_date",
    "total_registrations",
    "total_participants",
    "age",
    "pool_length",
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
    let start_date;
    let end_date;
    if (argv.pdf_path) {
        const data_array = await parse_pdf.extractPDFText(pdfPath);
        data = data.concat(parse_pdf.parseResults(data_array));
    } else if (argv.url) {
        const {
            results_links,
            from_date,
            to_date
        } = await parse_url.scrape_main_url_for_results_links(argv.url, year, last_date, start_date);
        for (const element of results_links) {
            const {
                link,
                event_date,
                total_registrations,
                total_participants
            } = element
            console.log("event date:", event_date, "Scrapping:", link)
            year = utils.set_year(event_date.split(" ")[0]);
            const to_push = await parse_url.fetch_and_parse_results(link, year, event_date.split(" ")[0], total_registrations, total_participants, criteria)
            if (to_push) data.push(...to_push);
            start_date = from_date;
            end_date = to_date;
            // break; //For debug
        }
    } else if (argv.file_name) {
        const read_data = fs.readFileSync(filename, 'utf-8');
        data = JSON.parse(read_data)
        Object.keys(criteria).every(key =>
            filename = filename.replace(/\.json$/, "") + "-" + String(criteria[key]).replaceAll(' ', '-') + ".json");
    } else {
        console.error("Data must be consumed from a file, pdf, or url");
        usage();
        process.exit(0);
    }

    return {
        data,
        start_date,
        end_date
    };
}

async function _set_data_file(data, append) {
    if (argv.file_name && filename === output_file_name && !append) {
        console.log("Skipping writing to the same file");
        return;
    }
    let final_data = data;

    try {
        if (append && fs.existsSync(filename)) {
            // Read the existing data, merge with new data, and write back
            const existing_data = JSON.parse(fs.readFileSync(filename, 'utf-8'));
            final_data = Array.isArray(existing_data) ? [...existing_data, ...data] // Merge if both are arrays
                :
                {
                    ...existing_data,
                    ...data
                }; // Merge if objects
        }
        fs.writeFileSync(filename, JSON.stringify(final_data, null, 2));

        console.log('Data saved to', filename);
    } catch (error) {
        console.error('Error writing data to file:', error);
    }
}


// _construct_criteria will build the criteria to filter upon
function _construct_criteria() {
    const criteria = filters.reduce((criteria, filter) => {
        if (argv[filter]) {
            if (filter === 'position') {
                const position = Number(argv[filter]);
                if (!isNaN(position)) {
                    criteria.positions = Array.from({
                        length: position
                    }, (_, i) => i + 1); // Create [1, 2, ..., position]
                } else {
                    criteria[filter] = utils.reverse_string(argv[filter]);
                }
            }
        }
        return criteria;
    }, {});

    console.log(criteria);
    return criteria;
}

// Function to filter based on dynamic keys
function _filter_by_criteria(data, criteria) {
    return data.filter(item => {
        return Object.keys(criteria).every(key => {
            if (key === 'positions') {
                const positions = criteria[key];
                return positions.includes(Number(item.position));
            }
            return String(item[key]).includes(criteria[key])
        });
    });
}


async function main() {

    const criteria = _construct_criteria();

    if (fs.existsSync(filename) && !append) {
        console.log("File already exists, please use the --append flag to append to the file.")
        process.exit(0);
    }
    let {
        data,
        start_date,
        end_date
    } = await _get_data(criteria);
    if (Object.keys(criteria).length > 0) {
        data = _filter_by_criteria(data, criteria);
    }
    const base_file_name = filename;
    if (group) {
        data = utils.group_by_field(data, argv.group);
        for (const key of Object.keys(data)) {
            console.log(key)
            if (!is_output_file_name) {
                filename = base_file_name.replace(/\.json$/, "") + "-" + key.replaceAll(' ', '-') + ".json";
            }
            await _set_data_file(data[key], append);
        }
    } else {
        console.log(data);
        const regex = /--.+--.+/
        const has_date = regex.test(filename);
        if (!is_output_file_name && !has_date) {
            filename = filename.replace(/\.json$/, "") + "--" + start_date + "--" + end_date + ".json";
        }
        await _set_data_file(data, append);
    }
}

main();