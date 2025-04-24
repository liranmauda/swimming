const DATA_URL = 'data/swimming_results-2022-2025-borowser.json';
const PAGE_SIZE = 10000;
let originalData = [];
let filteredData = [];
let currentPage = 1;
let filterTimeout;
let sortAscending = true; // Toggle sort direction

// for dubug locally
// document.getElementById('fileInput').addEventListener('change', function(event) {
//   const file = event.target.files[0];
//   if (!file) return;
//   const reader = new FileReader();
//   reader.onload = function(e) {
//     let json;
//     try {
//         json = e.target.result.replace(/^\uFEFF/, ''); // remove BOM
//         originalData = JSON.parse(json);
//     } catch (err) {
//         alert('קובץ JSON לא תקין');
//         return;
//     }

//     populateEventDropdown();
//     document.getElementById('filters').style.display = 'block';
//     applyFilters(); // show first filtered page
// };
//   reader.readAsText(file);
// });

window.onload = async function () {
    try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error('Network error');

        const data = await res.json();
        originalData = data;
        populateEventDropdown();
        document.getElementById('filters').style.display = 'block';
    } catch (err) {
        alert('שגיאה בטעינת הקובץ: ' + err.message);
    }
};

// LMLM TODO: remove debounce if not needed
// function debounceFilters() {
//   clearTimeout(filterTimeout);
//   filterTimeout = setTimeout(applyFilters, 300);
// }

function populateEventDropdown() {
    const eventSelect = document.getElementById('filterEvent');
    const uniqueEvents = [...new Set(originalData.map(item => item.event))].sort();
    uniqueEvents.forEach(event => {
        const option = document.createElement('option');
        option.value = event;
        option.textContent = event;
        eventSelect.appendChild(option);
    });
}

function applyFilters() {
    const eventVal = document.getElementById('filterEvent').value;
    const genderVal = document.getElementById('filterGender').value;
    const birthYearVal = document.getElementById('filterBirthYear').value.trim();
    const clubVal = document.getElementById('filterClub').value.trim();
    const ageVal = document.getElementById('filterAge').value;
    const dateVal = document.getElementById('filterDate').value;
    const firstNameVal = document.getElementById('filterFirstName').value.trim();
    const lastNameVal = document.getElementById('filterLastName').value.trim();

    filteredData = originalData.filter(item => {
        console.log(item);
        return (!eventVal || item.event === eventVal) &&
            (!genderVal || item.gender === genderVal) &&
            (!birthYearVal || item.birthYear === birthYearVal) &&
            (!clubVal || item.club.includes(clubVal)) &&
            (!ageVal || item.age == ageVal) &&
            (!dateVal || normalizeDate(item.event_date) === dateVal) &&
            (!firstNameVal || item.firstName.includes(firstNameVal)) &&
            (!lastNameVal || item.lastName.includes(lastNameVal));
    });

    sortAscending = true // Reset sort direction
    sortByTime();
}

function renderTable() {
    const tbody = document.querySelector('#reportTable tbody');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = filteredData.slice(start, end);

    pageData.forEach((item, index) => {
        const row = document.createElement('tr');
        if (item.club && item.club.includes('אוסו')) {
            row.classList.add('highlight-osso');
        }
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.firstName}</td>
          <td>${item.lastName}</td>
          <td>${item.event}</td>
          <td>${item.event_date}</td>
          <td>${item.time}</td>
          <td>${item.club}</td>
          <td>${item.birthYear}</td>
          <td>${item.gender}</td>
          <td>${item.age}</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('reportTable').style.display = pageData.length ? 'table' : 'none';
    document.getElementById('resultCount').textContent =
        `מציג ${filteredData.length ? Math.min(filteredData.length, end) : 0} מתוך ${filteredData.length} רשומות`;

    document.getElementById('resultCount').style.display = 'block';
    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
    const container = document.getElementById('pagination');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.disabled = i === currentPage;
        btn.onclick = () => {
            currentPage = i;
            renderTable();
        };
        container.appendChild(btn);
    }
}

function sortByTime() {
    const uniqueOnly = document.getElementById('filterUnique').checked;

    const timeToSeconds = t => {
        if (!t || !/^\d+:\d+\.\d+$/.test(t)) return Infinity;
        const [min, sec = '0'] = t.split(':');
        const [s, ms = '0'] = sec.split('.');
        return parseInt(min || 0) * 60 + parseInt(s || 0) + parseInt(ms || 0) / 100;
    };

    filteredData.sort((a, b) => {
        const diff = timeToSeconds(a.time) - timeToSeconds(b.time);
        return sortAscending ? diff : -diff;
    });

    if (uniqueOnly) {
        filteredData = filteredData.filter((item, index, self) =>
            index === self.findIndex((t) => (
                t.firstName === item.firstName && t.lastName === item.lastName && t.event === item.event
            ))
        );
    }

    const sortBtn = document.getElementById('sortTimeBtn');
    sortBtn.textContent = sortAscending ? '🔼' : '🔽';

    sortAscending = !sortAscending;
    currentPage = 1;
    renderTable();
}

function normalizeDate(dateStr) {
    // Convert from "DD/MM/YYYY" to "YYYY-MM-DD"
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}