async function time_series_intraday(symbol, token, interval, start, end) {
    console.assert(!['1min', '5min', '15min', '30min', '60min'].every(x => interval !== x));
    console.assert(typeof token !== "undefined");
    let url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${token}`
    let prom = await fetch(url).then(response => response.json());
    return prom;
}

module.exports = { time_series_intraday: time_series_intraday };