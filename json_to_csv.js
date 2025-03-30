import fs from 'fs';
import moment from 'moment';
import minimist from 'minimist';
import {
    Parser
} from 'json2csv';
import * as utils from './utils.js';

const argv = minimist(process.argv.slice(2));

// const filename = "swimming_results-2023-2025.json";
const filename = argv.file_name || "swimming_results-2023-2025.json";
const output_file_name = argv.output || filename.replace(/\.json$/, ".csv");
let json_data = JSON.parse(fs.readFileSync(filename, 'utf-8'));

// Define the fields to include in the CSV
const fields = [
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


function reverse_fields(data) {
    return data.map(obj => {
        const new_obj = {};
        for (const [key, value] of Object.entries(obj)) {
            new_obj[key] = utils.reverse_string(value);
        }
        return new_obj;
    });
}

// Function to handle both flat arrays and nested structures
function convert_json_to_csv(data) {
    try {
        data = reverse_fields(data);
        const parser = new Parser({
            fields
        });
        fs.writeFileSync('after_reversing.json', JSON.stringify(data, null, 2));
        // Check if the input is a flat array or an object with multiple tables
        if (Array.isArray(data)) {
            return parser.parse(data);
        } else if (typeof data === 'object' && data !== null) {
            // Object with multiple tables: Process each key-value pair
            const tables = [];

            for (const [table_name, rows] of Object.entries(data)) {
                const csv = parser.parse(rows);

                // Add a table header and the CSV data
                tables.push(`### ${table_name}\n${csv}`);
            }

            // Combine all tables
            const combined_csv = tables.join('\n\n');
            console.log("Nested structure converted to CSV:\n", combined_csv);
            return combined_csv;
        } else {
            throw new Error("Invalid data format: Expected an array or an object.");
        }
    } catch (e) {
        console.error("Error converting JSON to CSV:", e);
    }
}


try {
    console.log('Converting JSON to CSV:', filename);

    const min_age = 10;
    const max_age = 13;
    console.log(`Getting data by age between ${min_age} and ${max_age}`);
    json_data = json_data.filter((item) => item.age >= min_age && item.age <= max_age);

    console.log('Removing duplicates per name, event, and age');
    json_data = json_data.filter((item, index, self) =>
        index === self.findIndex((t) => (
            t.firstName === item.firstName && t.lastName === item.lastName && t.event === item.event && t.age === item.age
        ))
    );

    console.log('Removing duplicates per event, date, age, total_registrations, total_participants, position, heat, lane, and birthYear');
    json_data = json_data.filter((item, index, self) =>
        index === self.findIndex((t) => (
            t.event_date === item.event_date &&
            t.event === item.event &&
            t.age === item.age &&
            t.event_date === item.event_date &&
            t.total_registrations === item.total_registrations &&
            t.total_participants === item.total_participants &&
            t.position === item.position &&
            t.heat === item.heat &&
            t.lane === item.lane &&
            t.birthYear === item.birthYear
        ))
    );

    console.log('sorting data by time');
    json_data = json_data.filter(item => moment(item.time, 'mm:ss.SS', true).isValid())
        .sort((a, b) => moment.duration(`00:${a.time}`).asMilliseconds() - moment.duration(`00:${b.time}`).asMilliseconds());

    fs.writeFileSync('after_sorting.json', JSON.stringify(json_data, null, 2));

    const csv = convert_json_to_csv(json_data);
    fs.writeFileSync(output_file_name, csv);
    console.log('CSV file created:', output_file_name);
} catch (err) {
    console.error('Error converting JSON to CSV:', err);
}