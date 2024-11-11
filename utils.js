import minimist from 'minimist';

const numberRegex = /\d+/g; //regex numbers
const timeRegex = /^(\d{2}):(\d{2})\.(\d{2})$/; //regex time format
const datePattern = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/; //regex date format

const argv = minimist(process.argv.slice(2)); //TODO: remove once fixed in extract_event_name

let event_name;

//TODO: Add more event names to the map
const name_map = {
    "מעורבאישי": "Individual medley",
    "חופשי": "Freestyle",
    "גב": "Backstroke",
    "חזה": "Breaststroke",
    "פרפר": "Butterfly"
}

function _check_hebrew(text) {
    const hebrewPattern = /[\u0590-\u05FF]/;
    return hebrewPattern.test(text);
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
function extract_event_name(line) {
    // If we get the event name by the flag return it.
    if (argv.event) { //TODO: change this function signature to get the event instead of using argv
        event_name = argv.event;
        return event_name;
    }

    const parts = line.split("-");
    const event_name_pos = 0;
    const hebrew_event_name = parts[event_name_pos].trim().replaceAll(' ', '-').replace(/[0-9-]+/g, '');
    const pool_length = parts[event_name_pos].split(" ");

    event_name = name_map[hebrew_event_name.replace(/[0-9-]+/g, '')] || hebrew_event_name;
    // The pool_length should always be first in the current structure
    event_name = event_name + " " + pool_length[0];
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


export {
    name_map,
    reverse_string,
    extract_event_name,
    group_by_field,
};