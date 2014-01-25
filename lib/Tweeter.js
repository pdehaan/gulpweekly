// ========== REQUIRES ---------------------------------------------------------

var _ = {
  template: require("lodash.template")
};
var Promise = require("promise");
var db = require("./db");
var Tweet;
var Twit = require("twit");


// ========== CLASSES ----------------------------------------------------------

/**
 * Creates a new Tweeter object.
 * @param  {String} formatter The format of the tweet. This will get compiled
 * into a lodash template.
 */
var Tweeter = function (formatter, twitterOptions, dbUri) {
  "use strict";
  Tweet = db(dbUri).Tweet;
  this.tmpl = _.template(formatter);
  this.twitter = new Twit(twitterOptions);
};


/**
 * Creates a tweet based on the specified package data and truncates it to a Twitter friendly length.
 * @param  {Object} data The data object to pass to the compiled lodash template.
 * @param {String} truncationText The string to use if we need to truncate the tweet text. Default: "...".
 * @return {String} A string containing the truncated tweet text.
 */
Tweeter.prototype.create = function tweeterCreate(data, truncationText) {
  "use strict";
  var maxlen = 140;
  var str = this.tmpl(data).trim();
  truncationText = truncationText || "...";

  if (str.length > maxlen) {
    str = (str.substr(0, maxlen - truncationText.length).trim() + truncationText);
  }
  return str;
};


/**
 * Publishes the tweet on Twitter.com.
 * @param  {Object} pkg The package data.
 * @return {Boolean} A Boolean value depending on whether the tweet was
 * published or not.
 * @todo Add mongodb or some other form of optional caching. We want to make sure
 * that we aren't republishing the same tweets again and again by accident.
 */
Tweeter.prototype.tweet = function tweeterTweet(pkg) {
  "use strict";
  var that = this;
  var tweet = this.create(pkg);
  var data = {
    "key": pkg.name + "@" + pkg.version,
    "tweet": tweet,
    "pkg": {
      "name": pkg.name,
      "version": pkg.version,
      "description": pkg.description || "",
      "url": pkg.url || {}
    }
    // "pkg": JSON.stringify(pkg)
  };
  var promise = new Promise(function (resolve, reject) {
    Tweet.findOne({"key": data.key}, "key", function (err, result) {
      if (err) {
        // An error?!
        return reject(err);
      }
      // Tweet doesn't exist, add it.
      if (!result) {
        new Tweet(data).save(function (err) {
          if (err) {
            // Unable to save tweet.
            return reject(err);
          }
          that.postStatus(data.tweet).then(resolve, function (err) {
            console.error(err);
          });
          resolve(tweet);
        });
      } else {
        // We already tweeted this.
        resolve(false);
      }
    });
  });
  return promise;
};


Tweeter.prototype.postStatus = function tweeterPostStatus(str) {
  "use strict";
  var that = this;
  var promise = new Promise(function (resolve, reject) {
    that.twitter.post("statuses/update", {"status": str}, function (err, reply) {
      if (err) {
        return reject(err);
      }
      resolve(reply);
    });
  });
  return promise;
};


// ========== EXPORTS ----------------------------------------------------------

exports.Tweeter = Tweeter;


// ========== UTILITY FUNCTIONS ------------------------------------------------

