module.exports = {
  entry: './index.js',
  module: {
    // Apply `noParse` to Tangram to prevent mangling of UMD boilerplate
    noParse: /tangram\/dist\/tangram/
  }
};
