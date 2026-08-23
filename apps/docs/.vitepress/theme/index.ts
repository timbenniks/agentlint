import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme-without-fonts";
import AgentHome from "./components/AgentHome.vue";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("AgentHome", AgentHome);
  },
} satisfies Theme;
