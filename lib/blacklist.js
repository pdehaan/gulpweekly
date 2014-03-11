var request = require("request");

exports.blacklist = [];

request({url: "http://gulpjs.com/plugins/blackList.json", json: true}, function (err, req, data) {
    "use strict";
    if (err) {
        return console.error(err);
    }
    exports.blacklist = Object.keys(data).sort();
});

exports.isBlacklisted = function (name) {
    "use strict";
    return (exports.blacklist.indexOf(name) !== -1);
};
