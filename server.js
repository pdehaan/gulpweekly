// ========== REQUIRES ---------------------------------------------------------

var NpmWatcher = require("./lib/NpmWatcher").NpmWatcher;
var Tweeter = require("./lib/Tweeter").Tweeter;

var keywordFilter = require("./lib/NpmWatcher").keywordFilter;


// ========== UTILITY FUNCTIONS ------------------------------------------------

function filterFunc(pkg) {
  "use strict";
  return pkg.name.match(/^gulp-/i) || keywordFilter(pkg.keywords, ["gulp", "gulpplugin"]);
}


// ========= MAIN --------------------------------------------------------------

var npmOptions = {
  "since": "12h",
  "interval": "5m",
  "filterFunc": filterFunc
};
var npmer = new NpmWatcher(npmOptions);

var twitterOptions = {
  "consumer_key": process.env.CONSUMER_KEY,
  "consumer_secret": process.env.CONSUMER_SECRET,
  "access_token": process.env.ACCESS_TOKEN,
  "access_token_secret": process.env.ACCESS_TOKEN_SECRET
};
// var tweeter = new Tweeter("${name} (${version}): ${url} ${description}", twitterOptions, process.env.MONGOLAB_URI);


/* The `pkg` event gets dispatched for *every* package that matches the specified filter function. */
// npmer.on("pkg", function (pkg) {
//   var tweet = tweeter.create(pkg);
//   tweeter.tweet(tweet);
// });

/* The `pkgs` event gets dispatched once per heartbeat and returns an array of all packages that match the specified filter function. */
npmer.on("pkgs", function (pkgs) {
  "use strict";
  pkgs.forEach(function (pkg) {
    // console.log("%s (%s): %s", pkg.name, pkg.version, pkg.url, pkg.keywords);
    tweeter.tweet(pkg).then(function (data) {
      if (data) {
        console.log(data);
      }
    }, function (err) {
      console.error("fail: %s", err);
    });
  });
});
