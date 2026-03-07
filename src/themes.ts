export type ThemeId = "default" | "kawaii" | "jinx" | "euphoria" | "lastofus";

export interface Theme {
  id: ThemeId;
  name: string;
  emoji: string;
  fontUrl: string;
}

export const THEMES: Theme[] = [
  {
    id: "default",
    name: "Default",
    emoji: "⚡",
    fontUrl: "",
  },
  {
    id: "kawaii",
    name: "Kawaii",
    emoji: "🌸",
    fontUrl: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap",
  },
  {
    id: "jinx",
    name: "Jinx",
    emoji: "💜",
    fontUrl: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=Bangers&display=swap",
  },
  {
    id: "euphoria",
    name: "Euphoria",
    emoji: "✨",
    fontUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap",
  },
  {
    id: "lastofus",
    name: "Last of Us",
    emoji: "🍄",
    fontUrl: "https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap",
  },
];

export const DEFAULT_THEME: ThemeId = "default";
