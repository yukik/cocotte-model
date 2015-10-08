var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');

var fname = process.cwd().match(/cocotte-(.*)$/)[1];

gulp.task('build', function () {
  browserify('lib/' + fname + '.js')
    .bundle()
    .pipe(source(fname + '.min.js'))
    .pipe(buffer())
    .pipe(uglify({preserveComments: 'some'}))
    .pipe(gulp.dest('public'));
});

gulp.task('watch', function() {
  gulp.watch('lib/**/*.js', ['build']);
});

gulp.task('default', ['build', 'watch']);