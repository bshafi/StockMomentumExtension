const { agnes } = require('ml-hclust');
const DynamicTimeWarping = require('dynamic-time-warping');

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

module.exports = { cluster_segments, normalize_2d_array };