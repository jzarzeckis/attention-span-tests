import { createContext, useContext, useEffect, useState } from "react";
import { type ThemeId, THEMES, DEFAULT_THEME } from "@/themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: ThemeId;
}) {
  const [theme, setThemeState] = useState<ThemeId>(initialTheme ?? DEFAULT_THEME);

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach((t) => {
      if (t.id !== "default") root.classList.remove(`theme-${t.id}`);
    });
    if (theme !== "default") {
      root.classList.add(`theme-${theme}`);
    }

    // Dynamically load the theme font
    const themeObj = THEMES.find((t) => t.id === theme);
    if (themeObj?.fontUrl) {
      const linkId = `font-${theme}`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = themeObj.fontUrl;
        document.head.appendChild(link);
      }
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
