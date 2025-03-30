import fs from 'fs';
import minimist from 'minimist';
import {
    parse
} from 'csv-parse/sync';

const argv = minimist(process.argv.slice(2));

const filename = argv.file_name || "output.csv"
const output_file_name = argv.output || filename.replace(/\.csv$/, ".json");

// function convert_csv_to_json(file_path) {
try {
    // Read the entire file as a string
    const file_content = fs.readFileSync(filename, 'utf-8');

    // Parse the CSV into JSON
    const records = parse(file_content, {
        columns: true, // Use the first row as headers
        skip_empty_lines: true
    });

    // console.log("CSV converted to JSON:\n", JSON.stringify(records, null, 2));

    // Save JSON to a file
    fs.writeFileSync(output_file_name, JSON.stringify(records, null, 2));
    console.log('JSON file created:', output_file_name);
} catch (err) {
    console.error("Error processing file:", err);
}
// }