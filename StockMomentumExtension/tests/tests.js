let tests = new Map();

function add_test(file_name, name, fn) {
    let test_suit_name = file_name.split('/')[file_name.split('/').length - 1];
    if (tests.has(test_suit_name)) {
        tests.get(test_suit_name).push({ name: name, fn: fn });
    } else {
        tests.set(test_suit_name, [{ name: name, fn: fn }]);
    }
}

function run_tests() {
    for (let test_suit_name of tests.keys()) {
        console.log('BEGGINING', test_suit_name, 'TESTS');
        let test_suite = tests.get(test_suit_name);
        for (let test_obj of test_suite) {
            let test = test_obj.fn;
            let test_name = test.name;
            let error_occured = false;
            try { 
                test();
            } catch(err) {
                error_occured = true;
                console.log('FAILED : TEST', test_name, err.toString());
            }
            if (!error_occured) {
                console.log('OK     : TEST', test_name);
            }
        }
        console.log('\n\n');
    }
}

module.exports = { run_tests: run_tests, add_test: add_test };