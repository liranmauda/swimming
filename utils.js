import fs from 'fs';
import moment from 'moment';
import minimist from 'minimist';
import * as parse_url from './results_url_util.js';
import * as parse_pdf from './parse_results_pdf_util.js';

const numberRegex = /\d+/g; //regex numbers
const timeRegex = /^(\d{2}):(\d{2})\.(\d{2})$/; //regex time format
const datePattern = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/; //regex date format

const argv = minimist(process.argv.slice(2)); //TODO: remove once fixed in extract_event_name

const pdfPath = argv.pdf_path || "./";
const last_date = argv.last_date || moment();

let year = argv.year || "2025";

let event_name;

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

//TODO: Add more event names to the map
const event_name_map = {
    "מעורבאישי": "Individual medley",
    "חופשי": "Freestyle",
    "גב": "Backstroke",
    "חזה": "Breaststroke",
    "פרפר": "Butterfly",
    "חופשישליחים": "Freestyle relay",
    "מעורבשליחים": "Medley relay",

}

// const name_map ={

// }

function _check_hebrew(text) {
    const hebrewPattern = /[\u0590-\u05FF]/;
    return hebrewPattern.test(text);
}

function translate_gender(gender) {
    if (gender.includes("בנים") || gender.includes("גברים")) {
        return "male";
    }

    return "female";
}

function set_year(date) {
    let [day, month, year] = date.split("/")
    if (year === undefined) return year;
    if (Number(month) >= 9) return Number(year) + 1
    return Number(year);
}

// reverse_string will reverse the string but keep the number straight
function reverse_string(line) {

    line = String(line);
    // If this is a time return without reversing
    if (line.match(timeRegex)) return line;

    // If it does not contain hebrew, then return without reversing.
    if (!_check_hebrew(line)) return line;

    const parts = line.split(numberRegex);
    const numbers = line.match(numberRegex);
    const reversed_parts = parts.map(part => part.split('').reverse().join(''));

    // Combine reversed parts and numbers, keeping numbers in place
    let result = '';
    for (let i = reversed_parts.length - 1; i >= 0; i--) {
        if (numbers && numbers[i]) {
            result += numbers[i];
        }
        result += reversed_parts[i];
    }

    return result;
}

// extract_event_name extract the event name from the PDF 
function extract_event_name(line, new_line) {
    // If we get the event name by the flag return it.
    if (argv.event) { //TODO: change this function signature to get the event instead of using argv
        event_name = argv.event;
        return event_name;
    }
    let parts = line.split("-");
    let event_name_pos = 0;
    let hebrew_event_name;
    let pool_length;

    if (!new_line) {
        parts = parts[0].trim().split(" ");
        event_name_pos = parts.length - 1;
        hebrew_event_name = parts[event_name_pos].replace(/[A-Za-z]/g, '');
        if (_check_hebrew(parts[event_name_pos - 1])) {
            hebrew_event_name = parts[event_name_pos - 1] + hebrew_event_name;
            pool_length = parts[event_name_pos - 2];
        } else {
            pool_length = parts[event_name_pos - 1];
        }
        event_name = event_name_map[hebrew_event_name] || hebrew_event_name;
        event_name = event_name + " " + pool_length;
    } else {
        hebrew_event_name = parts[event_name_pos].trim().replaceAll(' ', '-').replace(/[0-9-]+/g, '').replace(/[A-Za-z]/g, '');
        pool_length = parts[event_name_pos].split(" ");
        event_name = event_name_map[hebrew_event_name.replace(/[0-9-]+/g, '')] || hebrew_event_name;
        // The pool_length should always be first in the current structure
        event_name = event_name + " " + pool_length[0];
    }

    return event_name;
}

function group_by_field(data, field) {
    const grouped = data.reduce((result, item) => {
        // Check if the field type already has an array in the result object
        const field_type = item[field];
        if (!result[field_type]) {
            result[field_type] = [];
        }
        // Add the item to the array for this event type
        result[field_type].push(item);

        return result;
    }, {});

    return grouped;
}

// _get_data will get the data from a PDF or from a file already created
async function _get_data(filename, criteria) {
    let data = [];
    let start_date = argv.start_date; //Probably need to be elsewhere
    let end_date;
    console.log("Getting data from start date: ", start_date, " to end date: ", end_date);
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
            } = element;
            const log = `event date: ${event_date}, Scrapping: ${link}`;
            console.log(log);
            fs.existsSync("links.log") ?
                fs.appendFileSync("links.log", log + "\n") : fs.writeFileSync("links.log", log + "\n");
            year = (event_date) ? set_year(event_date.split(" ")[0]) : year;
            const date = (event_date) ? event_date.split(" ")[0] : "";
            const to_push = await parse_url.fetch_and_parse_results(link, year, date, total_registrations, total_participants, criteria)
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
        end_date,
        filename
    };
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
                }
            } else {
                criteria[filter] = reverse_string(argv[filter]);
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

// get_filtered_data will filter based on dynamic keys
async function get_filtered_data(init_filename, append) {
    const criteria = _construct_criteria();

    if (fs.existsSync(init_filename) && !append) {
        console.log("File already exists, please use the --append flag to append to the file.")
        process.exit(0);
    }
    let {
        data,
        start_date,
        end_date,
        filename
    } = await _get_data(init_filename, criteria);
    if (Object.keys(criteria).length > 0) {
        data = _filter_by_criteria(data, criteria);
    }

    // Remove duplicates
    data = data.filter((item, index, self) =>
        index === self.findIndex((t) => (
            t.firstName === item.firstName &&
            t.lastName === item.lastName &&
            t.event === item.event &&
            t.event_date === item.event_date &&
            t.age === item.age &&
            t.total_registrations === item.total_registrations &&
            t.total_participants === item.total_participants &&
            t.position === item.position &&
            t.heat === item.heat &&
            t.lane === item.lane &&
            t.birthYear === item.birthYear
        ))
    );

    data = data.filter(item => item.event.trim() !== "undefined");

    return {
        data,
        start_date,
        end_date,
        filename
    };
}
export {
    event_name_map,
    translate_gender,
    set_year,
    reverse_string,
    extract_event_name,
    group_by_field,
    get_filtered_data
};