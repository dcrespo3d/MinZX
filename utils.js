function loadRemoteBinaryFile(url, callback)
{
    let req = new XMLHttpRequest();
    req.responseType = 'arraybuffer';
    req.addEventListener('load', function() {
        if (this.status != 200) {
            console.error('loadRemoteBinaryFile: error ' + this.status + ' while trying to read url ' + url);
            callback(null);
            return;
        }
        let arrayBuffer = this.response;
        let byteArray = new Uint8Array(arrayBuffer);
        callback(byteArray);
    });
    req.open('get', url);
    req.send();
}

function loadLocalFile(callback) {
    var input = document.createElement('input');
    input.type = 'file';
    input.addEventListener('change', function(e)
    {
        var file = event.target.files[0];
        if (file.size > 1048576) {
            alert('File is bigger than 1Mb');
            selected_file = null;
            return;
        }

        var reader = new FileReader();
        reader.onload = function(f) {
            if (this.error) {
                console.error('loadRemoteBinaryFile: error ' + this.error + ' while trying to read file ' + file.name);
                callback(null);
                return;
            }
            let arrayBuffer = this.result;
            let byteArray = new Uint8Array(arrayBuffer);
            callback(byteArray);
        };

        reader.onabort = function() { alert('File read aborted'); }
        reader.onerror = function() { alert('File read error'); }

        reader.readAsArrayBuffer(file);
    });
    input.click();    
}
