import fs from 'fs';
import minimist from 'minimist';
import * as utils from './utils.js';


const argv = minimist(process.argv.slice(2));
const filename1 = argv.file_name || "swimming_results.json";
const output_file = argv.output_file || "swimming_results_fixed.json";
let data = JSON.parse(fs.readFileSync(filename1, 'utf-8'));

function reverse_fields(data) {
    return data.map(obj => {
        const new_obj = {};
        for (const [key, value] of Object.entries(obj)) {
            if (key === "event") {
                new_obj[key] = value;
            } else {
                new_obj[key] = utils.reverse_string(value);
            }
        }
        return new_obj;
    });
}

// remove fields that are probably wrong
// data = data.filter((item) => item.age >= 10);

// Remove duplicates
// data = data.filter((item, index, self) =>
//     index === self.findIndex((t) => (
//         t.firstName === item.firstName &&
//         t.lastName === item.lastName &&
//         t.event === item.event &&
//         t.event_date === item.event_date &&
//         t.age === item.age &&
//         t.total_registrations === item.total_registrations &&
//         t.total_participants === item.total_participants &&
//         t.position === item.position &&
//         t.heat === item.heat &&
//         t.lane === item.lane &&
//         t.birthYear === item.birthYear
//     ))
// );

// data = data.filter(item => item.event.trim() !== "undefined");

// const remove = ["50m", "100m", "200m", "400m", "800m", "1500m", "LEN"];
// data = data.filter(item => !remove.includes(item.event.trim()));
// data = data.filter(item => item.event.trim() !== "DNF");

data = reverse_fields(data);
fs.writeFileSync(output_file, JSON.stringify(data, null, 2));
console.log('Data saved to', output_file);