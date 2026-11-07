// A weather condition (Home Assistant's `weather.*` state) as one symbol, for the weather tile by the clock and its forecast (#333).

const ICONS: Record<string, string> = {
  sunny: "☀️",
  "clear-night": "🌙",
  partlycloudy: "⛅",
  cloudy: "☁️",
  fog: "🌫️",
  hail: "🌨️",
  lightning: "⚡",
  "lightning-rainy": "⛈️",
  pouring: "🌧️",
  rainy: "🌦️",
  snowy: "❄️",
  "snowy-rainy": "🌨️",
  windy: "💨",
  "windy-variant": "💨",
  exceptional: "⚠️",
};

export const weatherIcon = (condition: string | undefined): string => ICONS[condition ?? ""] ?? "🌡️";
