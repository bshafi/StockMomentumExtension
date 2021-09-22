const { ALPHAVANTAGE_KEY, FILE_DATA, CLUSTERS, SEGMENTS, LAST_SEGMENT_NAME } = require('./globals');
const { FileData, file_data_to_file } = require('./file_data');
const { ameritrade_dataframe } = require('./ameritrade');
const { sleep_ms, sleep_minutes } = require('./sleep');
const { time_series_intraday: time_series_intraday, REQUESTS_PER_MINUTE_FREE } = require('./alphavantage');


chrome.storage.onChanged.addListener(function (changes, namespace) {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        if (typeof newValue === 'undefined' || newValue === null) {
            continue;
        }
        console.log('Changed:', key);
        if (key === FILE_DATA) {
            chrome.storage.local.get([LAST_SEGMENT_NAME], function (values) {
                let last_segment_name = values[LAST_SEGMENT_NAME];
                if (typeof last_segment_name === 'undefined' || last_segment_name === null || last_segment_name !== newValue.name) {
                    generate_segments(file_data_to_file(newValue), 'QACZCVB0MO6NI1T9').then(segments => {
                        console.log('output data:', segments);
                        let p = {};
                        p[SEGMENTS] = segments;
                        p[LAST_SEGMENT_NAME] = newValue.name;
                        chrome.storage.local.set(p);
                    }).catch(reason => console.log('Failed to generate segments ', reason));
                } else {
                    console.log('Segments have beed')
                }
            });
        } else if (key === SEGMENTS) {
        }
    }
});

function* split_ameritrade_dataframe(dataframe) {
    let start = 0;
    let cur_ticker = dataframe[0]['ticker'];
    for (let stop = 0; stop < dataframe.length; ++stop) {
        let ticker = dataframe[stop]['ticker'];
        if (cur_ticker !== ticker) {
            yield dataframe.slice(start, stop);
            start = stop;
            cur_ticker = ticker;
        }
    }
    yield dataframe.slice(start);
}


function calc_year_month_offset(start, end = new Date()) {
    const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;
    const ALPHAVANTAGE_LAG = 3 * 24 * 60 * 60 * 1000;
    let months = Math.abs((end - start - ALPHAVANTAGE_LAG) / MS_PER_MONTH);
    let year_offset = parseInt(Math.floor(months / 12)) + 1;
    let months_offset = parseInt(Math.floor(months % 12)) + 1;
    console.assert(year_offset <= 2);
    console.assert(months_offset <= 12);
    
    return { year: year_offset, month: months_offset };
}

function min_max_date(context) {
    let min_date = null;
    let max_date = null;
    for (let row of context) {
        let row_date = new Date(row['datetime']);
        if (min_date === null || row_date < min_date) {
            min_date = row_date;
        }
        if (max_date === null || row_date > max_date) {
            max_date = row_date;
        }
    }
    return { 'min_date': min_date, 'max_date': max_date };
}

async function generate_segments(file, key) {
    console.log('Starting segment generation');

    let am = await ameritrade_dataframe(file);
    let segments = Array.from(split_ameritrade_dataframe(am)).slice(0, 10);

    let data = [];
    let requests_made = 0;
    let error = [];
    console.log(segments.length / REQUESTS_PER_MINUTE_FREE, 'minutes remaining');
    for (let segment of segments) {
        if (segment.length === 0) {
            continue;
        }
        await sleep_minutes(1 / REQUESTS_PER_MINUTE_FREE);
        let symbol = segment[0]['ticker'];
        let start_date = new Date(segment[0]['datetime']);
        start_date.setTime(start_date.getTime() - 1000 * 60 * 60);
        let end_date = new Date(segment[segment.length - 1]['datetime']);
        let { year, month } = calc_year_month_offset(start_date);
        let context = null;
        let filtered_context = null;
        try {
            context = (await time_series_intraday(key, symbol, '5min', year, month));
            filtered_context = context.filter(({ datetime }) => start_date <= new Date(datetime) && new Date(datetime) <= end_date);
            ++requests_made;
        } catch (err) {
            error.push(err);
        }
        if (context === null) {
            continue;
        }

        // try again
        if (filtered_context.length === 0) {
            await sleep_minutes(1 / REQUESTS_PER_MINUTE_FREE);
            ++month;
            if (month > 12) {
                month = 1;
                ++year;
            }
            try {
                context = (await time_series_intraday(key, symbol, '5min', year, month));
            } catch (err) {
                error.push(err);
            }
            filtered_context = context.filter(({ datetime }) => start_date <= new Date(datetime) && new Date(datetime) <= end_date);
            ++requests_made;
            if (filtered_context.length === 0) {
                error.push(`Tried twice to get proper date symbol:${symbol}, start_date:${start_date}, ${context}, year${year}month${month}`);
                console.log(error.lastItem);
            } else {
                data.push({ 'context': filtered_context, 'dataframe': segment });
            }
        } else {
            data.push({ 'context': filtered_context, 'dataframe': segment });
        }
    }
    console.log(error);  
    return data;
}

function normalize_2d_array(arr) {
    let row_length = arr[0].length;
    console.assert(typeof row_length !== 'undefined');
    let sums = new Array(row_length).fill(0);
    let square_sums = new Array(row_length).fill(0);

    for (let i = 0; i < arr.length; ++i) {
        console.assert(arr[i].length === row_length);
        for (let j = 0; j < row_length; ++j) {
            console.assert(typeof arr[i][j] !== 'undefined');

            sums[j] += arr[i][j];
            square_sums[j] += (arr[i][j] * arr[i][j]);
        }
    }
    let means = sums.map(x => x / arr.length);
    let std_devs = new Array(row_length).fill(0);
    for (let i = 0; i < row_length; ++i) {
        std_devs[i] = Math.sqrt((square_sums[i] / arr.length) -  (means[i] * means[i]));
    }

    return arr.map(row => row.map((x, i) => {
        if (Math.abs(std_devs[i]) < 0.001) {
            return 0;
        }
        let ret = (x - means[i]) / std_devs[i];


        if (!isFinite(ret)) {
            let invalid_column = arr.reduce((prev, val) => prev.concat(val[i]),[]);
            console.log(i, ret, 'invalid column:', JSON.stringify(invalid_column), 'mean:', means[i], 'stdev', std_devs[i]);
        }

        return ret;
    }));
}


function cluster_segments(data, number_of_clusters = 10) {
    if (typeof data === 'undefined' || data === null) {
        console.log('data was undefined or null');
    }
    if (data.length === 0) {
        console.log('data has no length');
        return;
    }
    function euclidean_dist(x, y) {
        console.assert(x.length === y.length);
        let dist = 0.0;
        for (let i = 0; i < x.length; ++i) {
            dist += (x[i] - y[i]) * (x[i] - y[i]);
        }
        return dist;
    }


    function dist(a, b) {
        let context_dist = new DynamicTimeWarping(a.context, b.context, euclidean_dist).getDistance();
        let dataframe_dist = new DynamicTimeWarping(a.dataframe, b.dataframe, euclidean_dist).getDistance();
        
        return (context_dist + dataframe_dist) / 2;
    }
    

    return flatten_cluster(number_of_clusters, agnes(data, { distanceFunction: dist }));
}

function get_all_indices_from_cluster(cluster) {
    let indices = [];
    if (cluster.index !== -1) {
        indices.push(cluster.index);
    }
    return indices.concat(
        cluster.children.map(child => get_all_indices_from_cluster(child)).reduce((prev, cur) => prev.concat(cur), [])
    );
}

function flatten_cluster(groups, cluster) {
    let grouped_cluster = cluster.group(groups);
    return grouped_cluster.children.map((child) => get_all_indices_from_cluster(child));
}