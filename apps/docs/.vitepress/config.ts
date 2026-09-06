import { defineConfig } from "vitepress";

export default defineConfig({
  site: "https://agentlint.timbenniks.dev",
  lang: "en-US",
  title: "Agentlint",
  titleTemplate: ":title · Agentlint",
  description: "Evidence-first website testing for coding agents.",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#f4f6f0" }],
    ["meta", { name: "color-scheme", content: "light dark" }],
    ["link", { rel: "icon", href: "/mark.svg", type: "image/svg+xml" }],
  ],
  markdown: { lineNumbers: true },
  themeConfig: {
    logo: { src: "/mark.svg", alt: "Agentlint" },
    siteTitle: "agentlint",
    nav: [
      { text: "Guide", link: "/guide/getting-started", activeMatch: "/guide/" },
      { text: "Concepts", link: "/concepts/deterministic-first", activeMatch: "/concepts/" },
      { text: "Reference", link: "/reference/cli", activeMatch: "/reference/" },
      { text: "Integrations", link: "/integrations/coding-agents", activeMatch: "/integrations/" },
      { text: "Rules", link: "/reference/checks" },
      { text: "0.1", items: [{ text: "MVP status", link: "/reference/checks#current-scope" }] },
    ],
    sidebar: {
      "/guide/": [
        { text: "Start here", items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Add it to a project", link: "/guide/project-setup" },
          { text: "Run the agent loop", link: "/guide/agent-loop" },
        ] },
        { text: "Workflows", items: [
          { text: "CI and regressions", link: "/guide/ci-regressions" },
          { text: "Local and private sites", link: "/guide/local-private" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
        ] },
      ],
      "/concepts/": [{ text: "How it works", items: [
        { text: "Deterministic first", link: "/concepts/deterministic-first" },
        { text: "Scoring", link: "/concepts/scoring" },
        { text: "Reasoning tasks", link: "/concepts/reasoning-tasks" },
        { text: "Bounded missions", link: "/concepts/missions" },
      ] }],
      "/reference/": [{ text: "Reference", items: [
        { text: "CLI", link: "/reference/cli" },
        { text: "Configuration", link: "/reference/config" },
        { text: "Reports and files", link: "/reference/reports" },
        { text: "Rules reference", link: "/reference/checks" },
      ] }],
      "/integrations/": [{ text: "Integrations", items: [
        { text: "Coding agents", link: "/integrations/coding-agents" },
        { text: "GitHub Actions", link: "/integrations/github-actions" },
      ] }],
    },
    outline: { level: [2, 3], label: "On this trace" },
    search: { provider: "local" },
    editLink: {
      pattern: "https://github.com/timbenniks/agentlint/edit/main/apps/docs/:path",
      text: "Edit this page on GitHub",
    },
    socialLinks: [{ icon: "github", link: "https://github.com/timbenniks/agentlint" }],
    footer: {
      message: "Deterministic evidence. Bounded reasoning. No model API key.",
      copyright: "Released under the MIT License.",
    },
    lastUpdated: { text: "Evidence updated" },
    docFooter: { prev: "Previous", next: "Next" },
  },
});
