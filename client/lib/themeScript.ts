// Shared by the server layout and the client theme code.

export const THEME_STORAGE_KEY = "codeshare:theme";

// The browser toolbar's color in each theme (the page background, --ink-950).
export const THEME_COLORS = { dark: "#131316", light: "#fafafa" } as const;

// Runs before the page draws, so the chosen theme shows from the very first
// frame (no flash of the wrong one). Dark needs nothing: it's the default.
export const THEME_SCRIPT = `try{var c=localStorage.getItem("${THEME_STORAGE_KEY}");if(c==="light"||(c==="system"&&matchMedia("(prefers-color-scheme: light)").matches)){document.documentElement.classList.add("light");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","${THEME_COLORS.light}")}}catch(e){}`;