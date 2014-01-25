var gulp = require('gulp');
var eslint = require('gulp-eslint');
var jscs = require('gulp-jscs');

var JS_FILES = ['**/*.js', '!node_modules/**'];


gulp.task('eslint', function () {
  'use strict';

  gulp.src(JS_FILES)
    .pipe(eslint())
    .pipe(eslint.format());
});

gulp.task('jscs', function () {
  'use strict';

  gulp.src(JS_FILES)
    .pipe(jscs());
});

gulp.task('default', ['eslint', 'jscs']);
