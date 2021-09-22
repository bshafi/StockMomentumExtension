"use strict";

const { DataFrame } = require('dataframe-js');
const Papa = require('papaparse');
//const cache = require('./cache');


async function time_series_intraday(key, symbol, interval, year, month) {
    // Note for some reason in doesn't work here
    console.assert(!['1min', '5min', '15min', '30min', '60min'].every(x => x !== interval), 'Interval was invalid: ', interval);
    console.assert(1 <= year && year <= 2 && parseInt(year) === year);
    console.assert(1 <= month && month <= 12 && parseInt(month) === month);
    let year_month_slice = `year${year}month${month}`;

    // TODO: Make sure the slice actually corresponds to the start and end dates
    let args = `function=TIME_SERIES_INTRADAY_EXTENDED&slice=${year_month_slice}&symbol=${symbol}&interval=${interval}`;
    let url = `https://www.alphavantage.co/query?${args}&apikey=${key}`

    let response = await fetch(url);

    let response_text = await response.text();
    let response_csv = Papa.parse(response_text);
    if (response_csv.errors.length !== 0) {
        throw new Error(response_text + ' ' +  JSON.stringify(Array.from(arguments)));
    } else {
        const header_length = response_csv.data[0].length;
        response_csv.data = response_csv.data.filter(x => x.length === header_length);
        response_csv.data = response_csv.data.map((x, i) => (i == 0 ? [x[0]] : [`${x[0]} EST`]).concat(x.slice(1)));
    }
    const real_headers = ['time', 'open', 'high', 'low', 'close', 'volume'];
    let headers = response_csv.data[0];
    console.assert(headers.length === real_headers.length, );
    console.assert(headers.every((x, i) => x === real_headers[i]));

    return response_csv.data.slice(1).map(row => {
        console.assert(row.length === headers.length);

        let p = {'datetime': null, 'open': null, 'high': null, 'low': null, 'close': null, 'volume': null};
        let p_keys = ['datetime', 'open', 'high', 'low', 'close', 'volume'];
        for (let i = 0; i < real_headers.length; ++i) {
            p[p_keys[i]] = row[i];
        }
        return p;
    });
}
const REQUESTS_PER_MINUTE_FREE = 5;
module.exports = { time_series_intraday: time_series_intraday, REQUESTS_PER_MINUTE_FREE: REQUESTS_PER_MINUTE_FREE };