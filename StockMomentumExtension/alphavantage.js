const { DataFrame } = require('dataframe-js');

let alphavantage_key = "demo";

async function time_series_intraday(symbol, interval, start, end) {
    console.assert(!['1min', '5min', '15min', '30min', '60min'].every(x => interval !== x));
    let url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${alphavantage_key}`
    let prom = (await fetch(url).then(response => response.json()))[`Time Series (${interval})`];
    
    let data = Object.entries(prom).map(
        ([key, value]) => {
            let date = new Date(`${key} EST`);
            let values = Object.entries(value).map(([key, value]) => value);
            return [date].concat(values);
        }
    ).filter((row) => start <= row[0] && row[0] <= end);

    let headers = Object.keys(prom[Object.keys(prom)[0]]);
    console.log(headers);
    return new DataFrame(data, ['0. date'].concat(headers));
}

module.exports = { time_series_intraday: time_series_intraday, alphavantage_key: alphavantage_key };