function split_on_comma(line) {
    let elems = [];
    let double_quote = false;
    let single_quote = false;
    let start = 0;
    for (let stop = 0; stop < line.length; ++stop) {
        let c = line[stop];
        if (c === '"') {
            double_quote = !double_quote;
        } else if (c === "'") {
            single_quote = !single_quote;
        } else if (c == ',') {
            if (!double_quote && !single_quote) {
                elems.push(line.slice(start, stop));
                start = stop + 1;
            }
        }
    }
    elems.push(line.slice(start));
    return elems;
}

function fuse_Uint8Array(a, b) {
    if (b.length === 0) {
        return a;
    } else if (a.length === 0) {
        return b;
    }
    let c = new Uint8Array(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    
    return c;
}

async function* read_lines(file) {
    let reader = file.stream().getReader();
    let decoder = new TextDecoder();
    let remainder = new Uint8Array();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        let start = 0;
        let stop = 0;
        for (; stop < value.length; ++stop) {
            // Since \n in utf8 has char code of 10 we can check if one byte is 10
            if (value[stop] === 10) {
                yield decoder.decode(fuse_Uint8Array(remainder, value.slice(start, stop)));
                remainder = "";
                start = stop + 1;
            }
        }
        remainder = new Uint8Array(value.slice(start));
    }
    if (remainder.length !== 0) {
        yield decoder.decode(remainder);
    }
}

async function* parse_ameritrade_csv(file) {
    console.assert(typeof file !== 'undefined');

    let file_line_iter = read_lines(file);

    let columns = null;
    let i = 0;
    for (
        let line = (await file_line_iter.next()).value;
        typeof line !== 'undefined';
        line = (await file_line_iter.next()).value
    ) {
        if (line.includes('DATE')) {
            columns = split_on_comma(line);
            break;
        }
    }

    yield columns;

    for (
        let line = (await file_line_iter.next()).value;
        typeof line !== 'undefined';
        line = (await file_line_iter.next()).value
    ) {
        if (line.includes('TOTAL')) {
            break;
        }
        yield split_on_comma(line);
    }
}

module.exports = { parse_ameritrade_csv: parse_ameritrade_csv, read_lines: read_lines };