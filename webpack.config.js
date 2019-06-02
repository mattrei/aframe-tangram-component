module.exports = {
  entry: './index.js',
  module: {
    loaders: [
    {
      test: /\.css$/, 
      loader: "style-loader!css-loader"
    },
    {
      test: /\.png$/,
      loader: 'url-loader',
      query: { mimetype: 'image/png' }
    }   
    ],  
  }     
};      
