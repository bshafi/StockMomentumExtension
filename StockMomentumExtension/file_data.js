
class FileData {
    constructor(name, array_buffer) {
        this.name = name;
        this.array_buff_string = JSON.stringify(Array.from(new Uint8Array(array_buffer)));
    }
}
function file_data_to_file(file_data) {
    let blob = new Blob([new Uint8Array(JSON.parse(file_data.array_buff_string))]);
    return new File([blob], file_data.name);
}

module.exports = { FileData, file_data_to_file };