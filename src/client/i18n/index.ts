import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

// Import translation files
import jaCommon from "./locales/ja/common.json"
import jaGame from "./locales/ja/game.json"
import jaReplay from "./locales/ja/replay.json"
import jaUI from "./locales/ja/ui.json"

import enCommon from "./locales/en/common.json"
import enGame from "./locales/en/game.json"
import enReplay from "./locales/en/replay.json"
import enUI from "./locales/en/ui.json"

import zhCommon from "./locales/zh/common.json"
import zhGame from "./locales/zh/game.json"
import zhReplay from "./locales/zh/replay.json"
import zhUI from "./locales/zh/ui.json"

import koCommon from "./locales/ko/common.json"
import koGame from "./locales/ko/game.json"
import koReplay from "./locales/ko/replay.json"
import koUI from "./locales/ko/ui.json"

const resources = {
  ja: {
    common: jaCommon,
    game: jaGame,
    replay: jaReplay,
    ui: jaUI,
  },
  en: {
    common: enCommon,
    game: enGame,
    replay: enReplay,
    ui: enUI,
  },
  zh: {
    common: zhCommon,
    game: zhGame,
    replay: zhReplay,
    ui: zhUI,
  },
  ko: {
    common: koCommon,
    game: koGame,
    replay: koReplay,
    ui: koUI,
  },
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "ja",
    supportedLngs: ["ja", "en", "zh", "ko"],
    // Automatically detect language without region code (e.g., en-US -> en)
    load: "languageOnly",
    ns: ["common", "game", "replay", "ui"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
  })

export default i18n
