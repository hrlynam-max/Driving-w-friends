// Merges static app.json with runtime env so secrets stay out of source control.
const base = require('./app.json');

module.exports = ({ config }) => ({
  ...base.expo,
  ...config,
  extra: {
    ...base.expo.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    mapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
  },
});
