var gulp = require('gulp');
var sass = require('gulp-sass');
var scsslint = require('gulp-scss-lint');
var autoprefixer = require('gulp-autoprefixer');
var babel = require("gulp-babel");
var concat = require("gulp-concat");
var del = require('del');
var ignore = require("gulp-ignore");
var styleInject = require("gulp-style-inject");
var browserSync = require('browser-sync').create();

gulp.task('component-scss', function() {
  return gulp.src(['components/**/*.scss']) // Gets all files ending with .scss
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer())
    .pipe(gulp.dest('processing'));
});

gulp.task('change-scss', ["component-scss"], function() {
  return gulp.src(['scss/*.scss']) // Gets all files ending with .scss
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer())
    .pipe(concat("styles.css"))
    .pipe(gulp.dest('dist'));
});

gulp.task("change-es2015", ["change-scss"], function () {
  return gulp.src(["javascript/*.js", "components/**/*.js"])
    .pipe(styleInject())
    .pipe(babel({presets: ['es2015']}))
    .pipe(gulp.dest("./changed-es2015"));
});

gulp.task("build-project", ["change-es2015"], function () {
  return gulp.src(["javascript/polyfills/*.js", "changed-es2015/main.js", "changed-es2015/**/*.js"])
    .pipe(concat("app.js"))
    .pipe(gulp.dest("./dist/js"))
    .pipe(browserSync.reload({
      stream: true
    }));
});

gulp.task("build", ["build-project"], function () {
  return del(['changed-es2015', 'processing']);
});

gulp.task('browserSync', function() {
  browserSync.init({
    server: {
      baseDir: './dist'
    },
  })
});

gulp.task('watch', ['browserSync', 'build'], function (){
    gulp.watch(['javascript/**/*.js', 'components/**/*.js', 'scss/*.scss', 'components/**/*.scss'], ['build']);
    gulp.watch("dist/**/*.html").on('change', browserSync.reload);
});