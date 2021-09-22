const { CLUSTER_VISIBILITY, CLUSTERS } = require("./globals");

function set_background_color_important(element, color) {
    let original_css_text = element.style.cssText;
    let new_css_text = original_css_text.replace(/background\-color:\s.*\!important\;?/, '');
    if (typeof color !== 'undefined' && color !== null) {
        new_css_text = new_css_text + 'background-color: ' + color + ' !important'
    }
    if (document.all) {
        element.setAttribute('cssText',  new_css_text);
    } else {
        element.setAttribute('style',  new_css_text);
    }
}

const TRADER_SYNC_COLUMNS = 8;
function get_row_data(row) {
    let inner_text = row.innerText.split('\n');
    let data = [];
    for (let i = 0; i + 1 < TRADER_SYNC_COLUMNS; ++i) {
        data.push(inner_text[i]);
    }
    data[TRADER_SYNC_COLUMNS - 1] = [inner_text[TRADER_SYNC_COLUMNS - 1]];

    for (let i = TRADER_SYNC_COLUMNS; i < inner_text.length; ++i) {
        data[TRADER_SYNC_COLUMNS - 1].push(inner_text[i]);
    }
    return data;
}
function hide_clusters(clusters, cluster_visibility) {
    console.assert(clusters.length + 1 == cluster_visibility.length);

    let headers_element = document.getElementsByClassName('ag-header-container');
    if (typeof headers_element === 'undefined' || headers_element.length === 0) {
        return;
    }
    let headers = headers_element[0].innerText.split('\n');
    let row_container = document.getElementsByClassName('ag-center-cols-container')[0];
    let previous_ids = [];
    let segment_index = 0;

    for (let row of row_container.children) {
        let row_text = get_row_data(row);
        console.assert(row_text.length == headers.length, "row_text.length: ", row_text.length, "headers.length: ", headers.length);
        let row_data = {};
        for (let i = 0; i < headers.length; ++i) {
            row_data[headers[i]] = row_text[i];
        }
        //console.log('headers: ', headers);
        let id = -1;
        let offset_id = null;
        for (let i = 0; i < clusters.length && id == -1; ++i) {
            for (let j = 0; j < clusters[i].length && id == -1; ++j) {
                let segment = clusters[i][j];
                let segment_ticker = segment.dataframe[0]['ticker'];
                console.assert(typeof segment_ticker !== 'undefined' && segment_ticker !== null)
                //console.log(row_data['SYMBOL']);
                //console.log(segment.ticker);
                if (segment_ticker !== row_data['SYMBOL']) {
                    continue;
                }

                let sorted_segment = clusters[i][j].dataframe.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
                let segment_entry = sorted_segment[0].price;
                let segment_exit = sorted_segment[sorted_segment.length - 1].price;
                let segment_return = -sorted_segment.map(x => x.amount * x.price).reduce((prev, cur) => prev + cur, 0);
                let open_date = row_data['OPEN DATE'];
                let ticker = row_data['SYMBOL'];
                let entry = parseFloat(row_data['ENTRY'].replace('$',''));
                let exit = parseFloat(row_data['EXIT'].replace('$',''));
                let return_ = parseFloat(row_data['RETURN $'].replace('$',''));
                console.assert(entry);

                let error = 0;
                error += Math.pow(segment_entry - entry, 2);
                error += Math.pow(segment_exit - exit, 2);
                error += Math.pow(segment_return - return_, 2);
                error = Math.sqrt(error);

                if (error < 1) {
                    id = i;
                    offset_id = j;
                }
            }
        }
        previous_ids.push([id, offset_id]);
        console.assert(id == -1 || (0 <= id && id < clusters.length)); 
        if (id == -1 || (0 <= id && id < clusters.length)) {
            if (id == -1) {
                id = cluster_visibility.length - 1;
            }

            if (cluster_visibility[id] === false) {
                set_background_color_important(row, 'grey');
                // TODO: Set Change color
            } else {
                set_background_color_important(row, null);
            }
        }
    }
}
     
if(typeof chrome.runtime.id !== 'undefined') {
    setInterval(function () {
        chrome.storage.local.get([CLUSTERS, CLUSTER_VISIBILITY], function (values) {
            let clusters = values[CLUSTERS];
            if (typeof clusters === 'undefined' || clusters === null || clusters.length === 0) {
                return;
            }
            let cluster_visibility = values[CLUSTER_VISIBILITY];
            if (typeof cluster_visibility === 'undefined' || cluster_visibility === null) {
                cluster_visibility = new Array(clusters.length + 1).fill(false)
                let p = {};
                p[CLUSTER_VISIBILITY] = cluster_visibility;
                chrome.storage.local.set(p);
            }
            try {
                hide_clusters(clusters, cluster_visibility);
            } catch (err) {
                console.log(err);
            }
        });
    }, 1000);
}