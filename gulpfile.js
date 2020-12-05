var gulp = require('gulp'),
 browserify = require('gulp-browserify'),
 sass = require('gulp-sass');

 gulp.task('js' , function(){
  return gulp.src('src/js/main.js')
    .pipe(browserify({debug : true}))
    .pipe(gulp.dest('build/js')); 
 });


 //compile sass
 gulp.task('sass' ,  function(){
  return gulp.src('src/scss/*.scss')
    .pipe(sass().on('error' , sass.logError))
    .pipe(gulp.dest('build/css'))
 });


 gulp.task('watch' , function(){
  gulp.watch('src/js/*.js' ,gulp.series('js'));
  gulp.watch('src/scss/*.scss' ,gulp.series('sass'));
 });


 