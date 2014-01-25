// ========== REQUIRES ---------------------------------------------------------

var mongoose = require("mongoose");


// ========== CLASSES ----------------------------------------------------------

var TweetSchema = new mongoose.Schema({
  "key": {"type": String, "index": true},
  "tweet": String,
  "pkg": Object,
  "date": {"type": Date, "default": Date.now()}
});


// ========== EXPORTS ----------------------------------------------------------

module.exports = function (dbUri) {
    "use strict";
    mongoose.connect(dbUri);
    return {
        "Tweet": mongoose.model("Tweet", TweetSchema)
    };
};
