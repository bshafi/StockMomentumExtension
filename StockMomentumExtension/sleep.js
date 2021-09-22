
async function sleep_ms(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function sleep_minutes(minutes) {
    return await sleep_ms(minutes * 60 * 1000);
}

module.exports = { sleep_ms, sleep_minutes };