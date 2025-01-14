import fs from 'fs';
import moment from 'moment';
import minimist from 'minimist';
import * as utils from './utils.js';

const argv = minimist(process.argv.slice(2));

const append = Boolean(argv.append)
const pdfPath = argv.pdf_path || "./";
const last_date = argv.last_date || moment();
const is_output_file_name = Boolean(argv.output);
const output_file_name = argv.output || "swimming_results.json";
const initial_filename = argv.file_name || output_file_name;

//LMLM
// const filename = argv.file_name
// const read_data = fs.readFileSync(filename, 'utf-8');

function usage() {
    console.log(`
    --help                  -   Show this help
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

    --fullName              -   Report by full name

    --group                 -   Group by any of the filter fields (for example, event)
    --append                -   Will append to an existing file with the same name.
    `);
}

if (argv.help) {
    usage();
    process.exit(3);
}

if (!argv.fullName || argv.fullName.split(' ').length < 2) {
    console.error("First name and last name are required as a full name");
    usage();
    process.exit(3);
}

argv.gender = "female";

const name = argv.fullName.split(' ');

let {
    data,
    start_date,
    end_date,
    filename
} = await utils.get_filtered_data(initial_filename, append);

data = data.filter(item => moment(item.time, 'mm:ss.SS', true).isValid())
    .sort((a, b) => moment.duration(`00:${a.time}`).asMilliseconds() - moment.duration(`00:${b.time}`).asMilliseconds());
// console.log("data", data);
data = utils.group_by_field(data, argv.group);
for (const key of Object.keys(data)) {
    const position = data[key].indexOf(data[key].find(a =>
        a.firstName === utils.reverse_string(name[0]) && a.lastName === utils.reverse_string(name[name.length - 1])));
    // for (let i = 0; i <= position; i++) {
    //     // for (let i = 0; i <= 5; i++) {
    //     console.log(data[key][i]);
    // }
    // console.log(data[key][position]);
    console.log("event", key, "position", position + 1);
}

// function get_top_three_per_event(data) {
//     const events = {};

//     data.forEach(entry => {
//         if (!events[entry.event]) {
//             events[entry.event] = [];
//         }
//         events[entry.event].push(entry);
//     });

//     const top_three_per_event = [];

//     for (const event in events) {
//         const participantsByDate = {};

//         events[event].forEach(participant => {
//             if (!participantsByDate[participant.event_date]) {
//                 participantsByDate[participant.event_date] = [];
//             }
//             participantsByDate[participant.event_date].push(participant);
//         });

//         for (const date in participantsByDate) {
//             const sortedParticipants = participantsByDate[date].sort((a, b) => a.position - b.position);
//             top_three_per_event.push({
//                 event: event,
//                 event_date: date,
//                 top_three: sortedParticipants.slice(0, 3).map(participant => ({
//                     position: participant.position,
//                     time: participant.time
//                 }))
//             });
//         }
//     }

//     return top_three_per_event;
// }

// // data = JSON.parse(read_data);
// const topThreeResults = get_top_three_per_event(data);
// console.log(JSON.stringify(topThreeResults));