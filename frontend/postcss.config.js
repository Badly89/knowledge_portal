module.exports = {
  plugins: [
    require('autoprefixer')({
      overrideBrowserslist: ['last 2 versions', 'not dead', 'not < 2%']
    }),
    require('cssnano')({
      preset: 'default'
    })
  ]
}