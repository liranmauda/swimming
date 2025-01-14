import fs from 'fs';
import minimist from 'minimist';
import * as utils from './utils.js';

const argv = minimist(process.argv.slice(2));

function usage() {
    console.log(`
    --help                  -   Show this help
    --pdf_path              -   The path for the pdf to parse
    --url                   -   the competition url page
    --file_name             -   Input file name
    --output                -   The output file name

    #### Data structure
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
const is_output_file_name = Boolean(argv.output);
const output_file_name = argv.output || "swimming_results.json";
const initial_filename = argv.file_name || output_file_name;

let group = argv.group;

async function _set_data_file(filename, data, append) {
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

async function main() {

    let {
        data,
        start_date,
        end_date,
        filename
    } = await utils.get_filtered_data(initial_filename, append);

    const base_file_name = filename;
    if (group) {
        data = utils.group_by_field(data, argv.group);
        for (const key of Object.keys(data)) {
            console.log(key)
            if (!is_output_file_name) {
                filename = base_file_name.replace(/\.json$/, "") + "-" + key.replaceAll(' ', '-') + ".json";
            }
            await _set_data_file(filename, data[key], append);
        }
    } else {
        console.log(data);
        const regex = /--.+--.+/
        const has_date = regex.test(filename);
        if (!is_output_file_name && !has_date) {
            filename = filename.replace(/\.json$/, "") + "--" + start_date + "--" + end_date + ".json";
        }
        await _set_data_file(filename, data, append);
    }
}

main();