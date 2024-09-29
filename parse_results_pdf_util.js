import fs from 'fs';
import minimist from 'minimist';
import {
    getDocument
} from "pdfjs-dist/legacy/build/pdf.mjs";

const standardFontDataUrl = './node_modules/pdfjs-dist/standard_fonts/';
const numberRegex = /\d+/g; //regex numbers
const timeRegex = /^(\d{2}):(\d{2})\.(\d{2})$/; //regex time format
const datePattern = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/; //regex date format

const argv = minimist(process.argv.slice(2)); //TODO: remove once fixed in _extract_event_name

let event_name;

//TODO: Add more event names to the map
const name_map = {
    "ישיאברועמ": "Individual medley"
}

// _extract_event_name extract the event name from the PDF 
function _extract_event_name(line) {
    // If we get the event name by the flag return it.
    if (argv.event) { //TODO: change this function signature to get the event instead of using argv
        event_name = argv.event;
        return event_name;
    }

    // If the line includes "תואצות" we assume the head line contains the event name
    if (line.includes("תואצות")) {
        const parts = line.split("-");
        const hebrew_event_name = parts[parts.length - 1].trim().replaceAll(' ', '-')
        const length = parts[parts.length - 1].split(" ");
        event_name = name_map[hebrew_event_name.replace(/[0-9-]+/g, '')];
        //the length in the PDF is always the last
        event_name = event_name + " " + length[length.length - 1];
        return event_name;
    }

    return null;
}

function _check_hebrew(text) {
    const hebrewPattern = /[\u0590-\u05FF]/;
    return hebrewPattern.test(text);
}

// reverse_string will reverse the string but keep the number straight
function reverse_string(line) {

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

    _extract_event_name(result)

    return result;
}

async function extractPDFText(pdfPath) {
    // Read PDF as a binary
    const data = new Uint8Array(fs.readFileSync(pdfPath));

    // Load the PDF with the standardFontDataUrl provided
    const loadingTask = getDocument({
        data: data,
        standardFontDataUrl: standardFontDataUrl
    });
    const pdf = await loadingTask.promise;

    let extractedText = '';
    let strings_array;

    // Loop through all the pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();

        // Extract text items into array of strings
        strings_array = content.items.map(item => reverse_string(item.str));
    }
    strings_array = strings_array.filter(element => element !== ' ' && element !== '');
    return strings_array;
}

function parseResults(data_array) {
    // In the current structure of the PDF, "רישי רמג" is marking the start of the data in the tables.
    for (let i = 0; i < data_array.length; i++) {
        if (data_array[i] === "רישי רמג") {
            data_array = data_array.slice(i);
            break;
        }
    }

    const data = [];
    for (let i = 0; i < data_array.length; i += 9) {
        if (i + 9 < data_array.length) {
            data.push({
                event: event_name,
                score: data_array[i + 1],
                time: data_array[i + 2],
                club: data_array[i + 3],
                birthYear: data_array[i + 4],
                firstName: data_array[i + 5],
                lastName: data_array[i + 6],
                lane: data_array[i + 7],
                heat: data_array[i + 8],
                position: data_array[i + 9]
            });
        }
    }

    return data;
}

export {
    name_map,
    reverse_string,
    extractPDFText,
    parseResults
};