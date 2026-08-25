// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // RN Text HTML emas — o'zbekcha matndagi apostroflar (o', so'm) xavfsiz
      "react/no-unescaped-entities": "off",
    },
  },
]);
