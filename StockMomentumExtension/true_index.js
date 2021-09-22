const { ALPHAVANTAGE_KEY, CLUSTERS, FILE_DATA, SEGMENTS, CLUSTER_VISIBILITY, LAST_SEGMENT_NAME } = require('./globals');
const { FileData, file_data_to_file } = require('./file_data');
const { cluster_segments, normalize_2d_array } = require('./clustering');

chrome.storage.local.remove

// Initilize defaults
chrome.storage.local.get([ALPHAVANTAGE_KEY, CLUSTERS, FILE_DATA, LAST_SEGMENT_NAME], function (values) {
    let alphavantage_key = values[ALPHAVANTAGE_KEY];
    if (typeof alphavantage_key !== 'undefined' && alphavantage_key !== null) {
        document.getElementById('alphavantage_key').value = alphavantage_key;
    }
    let clusters = values[CLUSTERS];
    if (typeof clusters !== 'undefined' && clusters !== null) {
        create_cluster_id_option(clusters);
    }
    let file_data = values[FILE_DATA];
    if (typeof file_data !== 'undefined' && file_data !== null) {
        document.getElementById('last_file_name').innerText = file_data.name;
    }
});

document.getElementById('alphavantage_key').onchange = function (event) {
    let new_key = event.target.value;
    let prop = {};
    prop[ALPHAVANTAGE_KEY] = new_key;
    chrome.storage.local.set(prop);
}

document.getElementById('file_upload').onchange = function (event) {
    let file = document.getElementById('file_upload').files[0];
    if (typeof file === 'undefined' || file === null) {
        return;
    }
    file.arrayBuffer().then(array_buffer => {
        let file_data = new FileData(file.name, array_buffer);
        chrome.storage.local.set({'file_data': file_data });
        chrome.storage.local.get(['file_data'], function ({ file_data }) {
            if (typeof file_data === 'undefined') {
                return;
            }
            document.getElementById('last_file_name').innerHTML = file_data.name;
        });
    });
};



document.getElementById('gen_button').onclick = function() {
    chrome.storage.local.get([FILE_DATA, CLUSTERS, SEGMENTS], function (values) {
        let file_data = values[FILE_DATA];
        if (typeof file_data === 'undefined' || file_data === null) {
            console.log('No file uploaded');
            return;
        }

        let segments = values[SEGMENTS];
        if (typeof segments === 'undefined' || segments === null){
            console.log('Segments haven\'t been generated yet');
            let p = {};
            p[FILE_DATA] = file_data;
            chrome.storage.local.set(p);
            return;
        }

        // Javascript was doing some mutating segments here \/
        let array_segment = segments.map(function (seg) {
            let context = seg.context.map(row => 
                [
                    parseFloat(row['open']), 
                    parseFloat(row['high']), 
                    parseFloat(row['low']), 
                    parseFloat(row['close'])
                ]
            );
            let context2 = normalize_2d_array(context);
            let dataframe = seg.dataframe.map(row => 
                [
                    parseFloat(row['amount']),
                    parseFloat(row['price'])
                ]
            );
            let dataframe2 = normalize_2d_array(dataframe);
            return { 'context': context2, 'dataframe': dataframe2 };
        });
        let cluster_indices = cluster_segments(array_segment);
        let clusters = cluster_indices.map(cluster => cluster.map(i => segments[i])); 
        console.log(clusters);
        {
            let p = {};
            p[CLUSTERS] = clusters;
            chrome.storage.local.set(p);
        }
        create_cluster_id_option(clusters);
    });
}

document.getElementById('clear_data').onclick = function() {
    let clear_names = [SEGMENTS];
    for (let name of clear_names) {
        let p = {};
        p[name] = null;
        chrome.storage.local.set(p);
    }
    console.log('cleared:', clear_names);
}

function create_cluster_checkbox(cluster_id, cluster_length, visibility) {
    let name = `(${cluster_length}) Cluster ${cluster_id}`;
    if (cluster_id == -1 || cluster_length == -1) {
        name = 'unclustered';
    }
    let choice = document.createElement('input');
    choice.type = 'checkbox';
    choice.id = name;
    choice.innerText = name;
    choice.checked = visibility;

    choice.onchange = function (event) {
        chrome.storage.local.get([CLUSTER_VISIBILITY], function (values) {
            let cluster_visibility = values[CLUSTER_VISIBILITY];
            if (cluster_id == -1) {
                cluster_id = cluster_visibility.length - 1;
            }
            cluster_visibility[cluster_id] = event.target.checked;
            chrome.storage.local.set({'cluster_visibility': cluster_visibility });

            chrome.storage.local.get([CLUSTER_VISIBILITY], function (values) {
                console.log('new cluster_visibility', values[CLUSTER_VISIBILITY]);
            });
        });
    }
    let choice_label = document.createElement('label');
    choice_label['for'] = choice.id;
    choice_label.innerHTML = choice.id;
    let wrapped_choice = document.createElement('div');
    wrapped_choice.appendChild(choice);
    wrapped_choice.appendChild(choice_label);

    return wrapped_choice;
}

function create_cluster_id_option(clusters) {
    chrome.storage.local.get([CLUSTER_VISIBILITY], function (values) {
        let cluster_visibility = values[CLUSTER_VISIBILITY];
        if (typeof cluster_visibility === 'undefined' || cluster_visibility === null) {
            cluster_visibility = new Array(clusters.length + 1).fill(false);
        }


        let list = document.createElement('div');
        for (let i = 0; i < clusters.length; ++i) {
            list.appendChild(create_cluster_checkbox(i, clusters[i].length, cluster_visibility[i]));
        }
        let misc_checkbox = create_cluster_checkbox(-1, -1, cluster_visibility[cluster_visibility.length - 1]);
        list.appendChild(misc_checkbox);

        let gen_result = document.getElementById('gen_result');
        for (let child of gen_result.children) {
            gen_result.removeChild(child);
        }
        gen_result.appendChild(list);
    });
}