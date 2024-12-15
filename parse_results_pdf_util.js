import fs from 'fs';
import * as utils from './utils.js';
import {
    getDocument
} from "pdfjs-dist/legacy/build/pdf.mjs";

const standardFontDataUrl = './node_modules/pdfjs-dist/standard_fonts/';

let event_name //TODO: fix...
let gender //TODO: fix...

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
        strings_array = content.items.map(item => {
            const reversed_string = utils.reverse_string(item.str);
            if (reversed_string.includes("תואצות")) {
                gender = utils.translate_gender(reversed_string);
                console.log("LMLM gender", gender);
                event_name = utils.extract_event_name(item.str);
            }
            return reversed_string;
        });
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
                gender: gender,
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
    extractPDFText,
    parseResults
};