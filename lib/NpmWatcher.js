// ========== REQUIRES ---------------------------------------------------------

var EventEmitter = require("events").EventEmitter;
var fs = require("fs");
var util = require("util");

var _ = {
  "extend": require("lodash.assign"),
  "intersection": require("lodash.intersection"),
  "map": require("lodash.map")
};
var Duration = require("duration-js");
var gitHubUrlFromGit = require("github-url-from-git");
var request = require("request");


// ========== UTILITY FUNCTIONS ------------------------------------------------


/**
 * Converts an array of things to a lowercase array of things.
 * @param  {Array} arr An array of strings (or whatever).
 * @return {Array} The specified input array with all elements converted to lowercase.
 */
function arrayToLower(arr) {
  "use strict";
  return _.map(arr, function (item) {
    return item.toLowerCase();
  });
}


/**
 * Compares the intersection of two arrays and returns true if at least one match is found in both arrays.
 * @param  {Array} keywords An array of keywords for the current package.
 * @param  {Array} filterKeywords An array of desired keywords to filter on.
 * @return {Boolean} Returns `true` if at least one item was found in both arrays, returns `false` otherwise.
 */
function keywordFilter(keywords, filterKeywords) {
  "use strict";
  keywords = keywords || [];
  keywords = arrayToLower(keywords);
  if (!Array.isArray(filterKeywords)) {
    filterKeywords = [filterKeywords];
  }
  filterKeywords = arrayToLower(filterKeywords);
  var matchedKeywords = _.intersection(keywords, filterKeywords);
  return (matchedKeywords.length > 0);
}


/**
 * Calculate the duration between the specified relative time ("5d") and the current date.
 * @param {String} duration A time duration. For example, "4d" for 4 days, "9m" for 9 minutes.
 * @return {Number} A bunch of milliseconds.
 */
function since(duration) {
  "use strict";
  return Date.now() - Duration.parse(duration).milliseconds();
}


/**
 * Fix the inconsistent GitHub URLs, if it's even a GitHub URL. If not, just hand it right back unmodified.
 * @param  {String} url The URL to try and fix.
 * @return {String} The pretty GitHub URL, or the original URL.
 */
function fixGitHubRepoUrl(url) {
  "use strict";
  return gitHubUrlFromGit(url);
  // if (url.match(/github.com/i)) {
  //   return url.replace(/^.*?github.com[\/:]/i, "https://github.com/").replace(/\.git$/i, "");
  // }
  // return url;
}


/**
 * Inspect the package data and try and find the best thing to link to. In order of preference:
 * 1. `homepage` from package.json
 * 2. `repository.url` from package.json
 * 3. npm package page
 *
 * @param  {Object} pkg The package data returned from the npm registry.
 * @return {String} Our best guess at a URL.
 */
function prettyRepo(pkg) {
  "use strict";
  var url;

  if (pkg.homepage) {
    // If we have a homepage, use it first.
    url = pkg.homepage;
  } else if (pkg.repository && pkg.repository.url) {
    // If there is a valid repository URL, use that; but lets clean up goofy GitHub urls.
    url = fixGitHubRepoUrl(pkg.repository.url);
  }
  if (!url || !url.match(/^https?:/i)) {
    // If we don't have a URL, or the URL isn't http[s]:// friendly, default to npm page.
    url = "https://npmjs.org/package/" + (pkg.name);
  }
  return url;
}


/**
 * Cleans up the package data returned from npm and sets some default values so we don't need to do data checks everywhere in the code.
 * @param  {Object} pkg The package data returned from the npm registry.
 * @return {Object} The cleaned up package with default keywords, version, and pretty URL.
 */
function nicePackage(pkg) {
  "use strict";
  pkg.keywords = pkg.keywords || [];
  pkg.version = pkg["dist-tags"].latest;
  pkg.url = prettyRepo(pkg);
  return pkg;
}


// ========== CLASSES ----------------------------------------------------------

/**
 * Creates a new NpmWatcher object.
 * @param  {Object} options An object containing the following optional properties:
 * - `registry`: The registry URI to check for updates. Default: 'http://registry.npmjs.org'
 * - `pathname`: The registry path to search. Default: '/-/all/since/'
 * - `since`: How far back we should look for npm registry updates; 1hr, 15min, etc. Default: '1h'
 * - `interval`: How often should we ping the specified registry for updates. Default: '10s'
 */
var NpmWatcher = function (options) {
  "use strict";
  var defaults = {
    "registry": "http://registry.npmjs.org",
    "pathname": "/-/all/since/",
    "since": "30m",
    "interval": "15m",
    "filterFunc": function () {
      return true;
    },
    "logfile": ".lastnpmsync"
  };
  var params = {};
  _.extend(params, defaults, options);

  this.registry = params.registry;
  this.pathname = params.pathname;
  this.since = since(params.since);
  this.interval = Duration.parse(params.interval).milliseconds();
  this.filterFunc = params.filterFunc;
  this.logfile = params.logfile;

  if (fs.existsSync(this.logfile)) {
    var data = fs.readFileSync(this.logfile, "utf8");
    this.since = parseInt(data, 10);
  }

  this.getPackages();
  setInterval(this.getPackages.bind(this), this.interval);
};


// Make sure our NpmWatcher class can emit events.
util.inherits(NpmWatcher, EventEmitter);


/**
 * Gets the packages from the specified registry and filters the results based
 * on the specified filter function.
 * This method emits two events: `pkg` and `pkgs`.
 * The `pkg` event is dispatched for each new package from npm.
 */
NpmWatcher.prototype.getPackages = function npmwatcherGetpackages() {
  "use strict";
  var that = this;
  var opts = {
    "uri": that.registry + that.pathname,
    "qs": {
      "stale": "update_after",
      "startkey": that.since
    },
    "json": true
  };

  console.log("---------- %s (since: %s) ----------", new Date().toLocaleTimeString(), new Date(that.since).toLocaleTimeString());
  request(opts, function (err, res, data) {
    if (err) {
      console.error(err.message);
      return;
    }

    if (res.statusCode !== 200) {
      console.error("bad status code: %d", res.statusCode);
      return;
    }

    if (!data || data instanceof Array) {
      return;
    }

    var pkgs = Object.keys(data).filter(function (key) {
      // Ignore any keys starting with an underscore.
      return !key.match(/^_/);
    }).map(function (key) {
      // Return the cleaned up package instead of the current object key.
      var pkg = data[key];
      return nicePackage(pkg);
    }).filter(that.filterFunc);

    // Emit the `pkgs` event with an array of all matching packages.
    that.emit("pkgs", pkgs);

    // Emit the `pkg` event for each matching package.
    pkgs.forEach(function (pkg) {
      that.emit("pkg", pkg);
    });

    that.since = data._updated;
    fs.writeFile(that.logfile, that.since);
  });
};


// ========== EXPORTS ----------------------------------------------------------

exports.NpmWatcher = NpmWatcher;
exports.keywordFilter = keywordFilter;

