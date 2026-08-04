// babel-preset-expo carries everything the universal app needs, including the
// expo-router transform. No extra plugins at this minimal init (NativeWind is
// deferred to P1).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
