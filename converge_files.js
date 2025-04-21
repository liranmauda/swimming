import fs from 'fs';
import minimist from 'minimist';


const argv = minimist(process.argv.slice(2));
const filename1 = argv.file_name1 || "swimming_results1.json";
const filename2 = argv.file_name2 || "swimming_results2.json";
const output = argv.output || "swimming_results.json";

// Read the existing data, merge with new data, and write back
const existing_data1 = JSON.parse(fs.readFileSync(filename1, 'utf-8'));
const existing_data2 = JSON.parse(fs.readFileSync(filename2, 'utf-8'));
const final_data = Array.isArray(existing_data1) ? [...existing_data1, ...existing_data2] // Merge if both are arrays
    :
    {
        ...existing_data1,
        ...existing_data2
    }; // Merge if objects

fs.writeFileSync(output, JSON.stringify(final_data, null, 2));

console.log('Data saved to', output);