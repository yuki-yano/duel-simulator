export const SCREEN_WIDTH = {
  LARGE: 1024,
  MEDIUM: 768,
  SMALL: 640,
} as const

export const SCREENSHOT_SCREEN_WIDTH = {
  PC: 974,
  TABLET: 717,
  SP: 430,
} as const

export const GRAVE_ZONE_SIZE = {
  SELF: {
    LARGE: {
      HEIGHT: "308px",
      WIDTH: "82px",
      MARGIN_TOP: "-105px",
    },
    MEDIUM: {
      HEIGHT: "308px",
      WIDTH: "82px",
      MARGIN_TOP: "-105px",
    },
    SMALL: {
      HEIGHT: "253px",
      WIDTH: "70px",
      MARGIN_TOP: "-86px",
    },
    SP: {
      HEIGHT: "174px",
      WIDTH: "56px",
      MARGIN_TOP: "-58px",
    },
  },
  OPPONENT: {
    LARGE: {
      HEIGHT: "200px",
      WIDTH: "82px",
    },
    MEDIUM: {
      HEIGHT: "200px",
      WIDTH: "82px",
    },
    SMALL: {
      HEIGHT: "168px",
      WIDTH: "70px",
    },
    SP: {
      HEIGHT: "116px",
      WIDTH: "56px",
    },
  },
} as const
