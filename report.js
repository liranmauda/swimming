import fs from 'fs';
import moment from 'moment';
import minimist from 'minimist';
import * as utils from './utils.js';
import {
    time
} from 'console';

const argv = minimist(process.argv.slice(2));

const append = Boolean(argv.append)
const pdfPath = argv.pdf_path || "./";
const is_output_file_name = Boolean(argv.output);
const output_file_name = argv.output || "swimming_results.json";
const initial_filename = argv.file_name || output_file_name;

let last_date = argv.last_date || moment();

//LMLM
// const filename = argv.file_name
// const read_data = fs.readFileSync(filename, 'utf-8');

function usage() {
    console.log(`
    --help                  -   Show this help
    --file_name             -   Input file name
    --output                -   The output file name
    --printTimes            -   Print the times of the participants

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

const formats = ['D.M.YYYY', 'YYYY-MM-DD'];

argv.gender = "female";

const name = argv.fullName.split(' ');
console.log("name", name);

let {
    data,
    start_date,
    end_date,
    filename
} = await utils.get_filtered_data(initial_filename, append);

// sorting the data by time
data = data.filter(item => moment(item.time, 'mm:ss.SS', true).isValid())
    .sort((a, b) => moment.duration(`00:${a.time}`).asMilliseconds() - moment.duration(`00:${b.time}`).asMilliseconds());

if (argv.last_date) {
    data = data.filter(item => {
        if (item.event_date !== undefined) {
            const last_date_year = Number(item.birthYear) + Number(argv.age);
            last_date = moment(last_date, formats).year(last_date_year);
        } else {
            last_date = moment(argv.last_date, formats)
        }
        return moment(item.event_date, formats).isBefore(moment(last_date, formats))
    });
}

//remove duplicate names per event, keep the first one
data = data.filter((item, index, self) =>
    index === self.findIndex((t) => (
        t.firstName === item.firstName && t.lastName === item.lastName && t.event === item.event
    ))
);

//avoid under 10 years old (which is probably wrong data)
data = data.filter((item) => item.age >= 10);

data = data.filter((item, index, self) =>
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

data = utils.group_by_field(data, argv.group);

for (const key of Object.keys(data)) {
    // position is the index of the name in the data array
    const position = data[key].indexOf(data[key].find(a =>
        a.firstName === utils.reverse_string(name[0]) && a.lastName === utils.reverse_string(name[name.length - 1])));
    // total_registrations is the number of participants in the event
    const total_participants = data[key].length;

    if (argv.printTimes !== undefined) {
        for (let i = 0; i <= position; i++) {
            // for (let i = 0; i <= 5; i++) {
            console.log(data[key][i]);
        }
    }
    if (position + 1 === 0) continue;
    const percentage = ((position + 1) / total_participants * 100).toFixed(2);
    console.log("event", key, "position", position + 1, "out of", total_participants, "(", percentage, "%) best Time date", data[key][position].event_date);
    //print out the time in the position and the time in the position 0 (winner) and second and third places
    if (position + 1 === 1) {
        console.log("Best time in the event", data[key][0].time, "currently first place");
        console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
        continue;
    } else if (position + 1 === 2) {
        console.log("time", data[key][position].time, "winner", data[key][0].time);
        const time_in_pos = moment.duration(`00:${data[key][position].time}`).asMilliseconds();
        const time_in_winner = moment.duration(`00:${data[key][0].time}`).asMilliseconds();
        console.log("time gap to winner", moment.utc(time_in_pos - time_in_winner).format('mm:ss.SS'));
        console.log("winner date", data[key][0].event_date);
        console.log("Second best time in the event", data[key][1].time, "currently second place");
        console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
        continue;
    } else if (position + 1 === 3) {
        console.log("time", data[key][position].time, "winner", data[key][0].time, "second", data[key][1].time);
        const time_in_pos = moment.duration(`00:${data[key][position].time}`).asMilliseconds();
        const time_in_winner = moment.duration(`00:${data[key][0].time}`).asMilliseconds();
        const time_in_second = moment.duration(`00:${data[key][1].time}`).asMilliseconds();
        console.log("time gap to winner", moment.utc(time_in_pos - time_in_winner).format('mm:ss.SS'), "time gap to second", moment.utc(time_in_pos - time_in_second).format('mm:ss.SS'));
        console.log("winner date", data[key][0].event_date, "second date", data[key][1].event_date);
        console.log("Third best time in the event", data[key][2].time, "currently third place");
        console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
        continue;
    } else {
        console.log("time", data[key][position].time, "winner", data[key][0].time, "second", data[key][1].time, "third", data[key][2].time);
        //print out the time gap from the position to the first place (Winner) and from the position to the third place (medal range)
        const time_in_pos = moment.duration(`00:${data[key][position].time}`).asMilliseconds();
        const time_in_winner = moment.duration(`00:${data[key][0].time}`).asMilliseconds();
        const time_in_medal = moment.duration(`00:${data[key][2].time}`).asMilliseconds();
        console.log("winner date", data[key][0].event_date, "second date", data[key][1].event_date, "third date", data[key][2].event_date);
        console.log("time gap to winner", moment.utc(time_in_pos - time_in_winner).format('mm:ss.SS'), "time gap to medal", moment.utc(time_in_pos - time_in_medal).format('mm:ss.SS'));
        console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
    }
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