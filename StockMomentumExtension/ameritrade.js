"use strict";

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
            // Since '\n' in utf8 has char code of 10 we can check if one byte is 10
            if (value[stop] === 10) {
                yield decoder.decode(fuse_Uint8Array(remainder, value.slice(start, stop))).trim();
                remainder = '';
                start = stop + 1;
            }
        }
        remainder = new Uint8Array(value.slice(start));
    }
    if (remainder.length !== 0) {
        yield decoder.decode(remainder);
    }
}

const AmeritradeColumns = {
    date: 'DATE',
    time: 'TIME',
    type: 'TYPE',
    ref_num: 'REF #',
    description: 'DESCRIPTION',
    amount: 'AMOUNT',
    commisions_and_fees: 'Commissions & Fees',
    balance: 'BALANCE'
}

async function* parse_ameritrade_csv(file) {
    console.assert(typeof file !== 'undefined');

    let file_line_iter = read_lines(file);

    let columns = null;
    for (
        let line = (await file_line_iter.next()).value;
        typeof line !== 'undefined';
        line = (await file_line_iter.next()).value
    ) {
        if (line.includes(AmeritradeColumns.date)) {
            columns = split_on_comma(line);
            break;
        }
    }

    yield columns;

    let date_index = columns.indexOf(AmeritradeColumns.date);

    console.assert(date_index !== -1);
    function correct_date(date) {
        let terms = date.split('/');
        let m = terms[0];
        let d = terms[1];
        let y = terms[2].length == 4 ? terms[2] : '20' + terms[2];
        return m + '/' + d + '/' + y;
    }

    for (
        let line_iter = (await file_line_iter.next()).value;
        typeof line_iter !== 'undefined';
        line_iter = (await file_line_iter.next()).value
    ) {
        if (line_iter.includes('TOTAL')) {
            break;
        }
        let row = split_on_comma(line_iter).map(x => x.replace(',', '').replace('"', ''));
        row[date_index] = correct_date(row[date_index]);
        
        yield row;
    }
}

class Transaction {
    constructor(description, date, time, timezone_code = 'CST') {
        this.date = date + ' ' + time + ' ' + timezone_code;
		let terms = description.split(' ');
		let offset = 0;
		if (terms[offset] === 'tIP') {
			this.has_tIP = true;
			++offset;
		} else {
			this.has_tIP = false;
		}

		if (terms[offset] === 'SOLD') {
			this.sold_else_bought = true;
			++offset;
		} else if (terms[offset] === 'BOT') {
			this.sold_else_bought = false;
			++offset;
		} else {
			throw new Error('Could not find SOLD or BOT');
		}

		this.num = parseInt(terms[offset].replace(',', ''), 10);
		++offset;
		
		this.ticker = terms[offset];
		++offset;
		this.price = parseFloat(terms[offset].replace('@', ''));
    }
    get datetime() {
        return this.date;
    }
    get symbol() {
        return this.ticker;
    }
    get action() {
        return this.sold_else_bought ? "SOLD" : "BOT";
    }
    get cost() {
        return this.price * this.num;
    }
}


class AmeritradeCSV {
    constructor(rows, header) {
        let date_index = header.indexOf(AmeritradeColumns.date);
        let time_index = header.indexOf(AmeritradeColumns.time);
        let type_index = header.indexOf(AmeritradeColumns.type);
        let ref_index = header.indexOf(AmeritradeColumns.ref_num);
        let description_index = header.indexOf(AmeritradeColumns.description);
        let amount_index = header.indexOf(AmeritradeColumns.amount);
        let balance_index = header.indexOf(AmeritradeColumns.balance);

        console.assert([date_index, time_index, type_index, ref_index, description_index, amount_index, balance_index].every(x => x !== -1));
        
        this.trade_segments = [];
        let previous_ticker = null;
        let chain = [];
        let timezone_code = 'CST';
        for (let row of rows) {
            let transaction = null;
            if (row[type_index] === 'TRD') {
                transaction = new Transaction(row[description_index], row[date_index], row[time_index]);
                if (transaction.symbol ===  previous_ticker) {
                    chain.push(transaction);
                } else {
                    if (chain.length !== 0) {
                        this.trade_segments.push(chain);
                    }

                    chain = [];
                    previous_ticker = transaction.symbol;
                }
            } else {
                if (row[type_index] === 'BAL') {
                    let s = row[description_index].split(' ');
                    let new_timezone_code = s[s.length - 1];
                    console.assert(new_timezone_code.length === 3);
                    timezone_code = new_timezone_code;
                }

                if (chain.length !== 0) {
                    this.trade_segments.push(chain);
                }

                chain = [];
                previous_ticker = null;
            }
        }
    }
};

AmeritradeCSV.FromFile = async (file) => {
    let rows = [];
    let csv_iter = parse_ameritrade_csv(file);
    let header = (await csv_iter.next()).value;
    for (let row_iter = await csv_iter.next(); !row_iter.done; row_iter = await csv_iter.next()) {
        rows.push(row_iter.value);
    }
    return new AmeritradeCSV(rows, header);
}

async function ameritrade_dataframe(file) {
    let header = null;
    let date_index = -1;
    let time_index = -1;
    let description_index = -1;
    let type_index = -1;

    let timezone = 'CST';
    let data = [];

    for await (let row of parse_ameritrade_csv(file)) {
        if (header === null) {
            console.assert(row !== null);

            header = row;
            date_index = header.indexOf(AmeritradeColumns.date);
            time_index = header.indexOf(AmeritradeColumns.time);
            description_index = header.indexOf(AmeritradeColumns.description);
            type_index = header.indexOf(AmeritradeColumns.type);

            console.assert(date_index !== -1);
            console.assert(time_index !== -1);
            console.assert(description_index !== -1);
            console.assert(type_index !== -1);

            continue;
        }

        let date = row[date_index];
        let time = row[time_index];
        let description = row[description_index];
        let type = row[type_index];

        if (type === 'BAL') {
            let s = row[description_index].split(' ');
            let new_timezone_code = s[s.length - 1];
            console.assert(new_timezone_code.length === 3);
            timezone = new_timezone_code;
        } else if (type === 'TRD') {
            let transaction = new Transaction(description, date, time, timezone);
            let datetime = transaction.datetime;
            let ticker = transaction.symbol;
            let price = parseFloat(transaction.price);
            let amount = parseInt(transaction.num, 10);
            data.push({ 'datetime': datetime, 'ticker': ticker, 'amount': amount, 'price': price });
        }
    }
    return data;
}

module.exports = {
    parse_ameritrade_csv: parse_ameritrade_csv, 
    read_lines: read_lines, 
    AmeritradeCSV: AmeritradeCSV, 
    split_on_comma: split_on_comma,
    ameritrade_dataframe: ameritrade_dataframe
};