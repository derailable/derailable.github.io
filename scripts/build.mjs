import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const config = JSON.parse(await readFile(path.join(root, "site.config.json"), "utf8"));
const episodeDirectory = path.join(root, "src", "content", "episodes");
const required = ["title", "episode", "published", "description", "draft"];

function isHttpsUrl(value) {
  try {
    return typeof value === "string" && new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const configErrors = [];
for (const field of ["name", "tagline", "description", "producer", "copyrightHolder"]) {
  if (typeof config[field] !== "string" || !config[field].trim())
    configErrors.push(`${field} must be non-empty text`);
}
for (const field of ["siteUrl", "appleUrl", "spotifyUrl", "rssUrl"]) {
  if (!isHttpsUrl(config[field])) configErrors.push(`${field} must be an https URL`);
}
for (const field of ["podcastArtwork", "socialImage"]) {
  if (typeof config[field] !== "string" || !config[field].startsWith("/"))
    configErrors.push(`${field} must be a root-relative path`);
}
if (configErrors.length)
  throw new Error(`Site configuration validation failed:\n- ${configErrors.join("\n- ")}`);

const customDomain = new URL(config.siteUrl).hostname;

marked.use({ gfm: true, breaks: false });

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const safeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
const absoluteUrl = (pathname) => new URL(pathname, config.siteUrl).href;
const episodeUrl = (episode) => `/episodes/${episode.slug}/`;
const episodeMarkdownUrl = (episode) => `${episodeUrl(episode)}index.md`;
const numberLabel = (number) => String(number).padStart(3, "0");
const sectionId = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function dateValue(value) {
  return new Date(`${value}T12:00:00Z`);
}

function displayDate(value, short = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: short ? "short" : "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(dateValue(value));
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

function parseEpisode(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing frontmatter enclosed by --- lines`);

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (!field) throw new Error(`${file}: unsupported frontmatter line: ${line}`);
    data[field[1]] = parseScalar(field[2]);
  }

  const sections = [];
  let current;
  for (const line of match[2].split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = { heading: heading[1], content: [] };
      sections.push(current);
    } else if (current) {
      current.content.push(line);
    }
  }

  return {
    ...data,
    file,
    slug: data.slug || path.basename(file, path.extname(file)).replace(/^\d+-/, ""),
    sections: sections.map((section) => ({
      ...section,
      content: section.content.join("\n").trim(),
    })),
  };
}

const files = (await readdir(episodeDirectory)).filter((file) => /\.md(?:own)?$/.test(file)).sort();
const allEpisodes = [];
const errors = [];

for (const file of files) {
  try {
    const episode = parseEpisode(await readFile(path.join(episodeDirectory, file), "utf8"), file);
    const missing = required.filter(
      (field) => episode[field] === undefined || episode[field] === null || episode[field] === "",
    );
    if (missing.length) errors.push(`${file}: missing required frontmatter: ${missing.join(", ")}`);
    if (!Number.isInteger(episode.episode) || episode.episode < 1)
      errors.push(`${file}: episode must be a positive integer`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(episode.slug))
      errors.push(`${file}: slug must use lowercase words separated by hyphens`);
    if (!isValidDate(episode.published))
      errors.push(`${file}: published must be a valid date in YYYY-MM-DD format`);
    if (typeof episode.draft !== "boolean") errors.push(`${file}: draft must be true or false`);
    if (typeof episode.title !== "string" || !episode.title.trim())
      errors.push(`${file}: title must be non-empty text`);
    if (typeof episode.description !== "string" || !episode.description.trim())
      errors.push(`${file}: description must be non-empty text`);
    for (const field of ["appleUrl", "spotifyUrl"]) {
      if (episode[field] && !isHttpsUrl(episode[field]))
        errors.push(`${file}: ${field} must be an https URL`);
    }

    if (!episode.draft) {
      const byName = new Map(
        episode.sections.map((section) => [section.heading.toLowerCase(), section]),
      );
      const discoveries = byName.get("interesting discoveries");
      const sources = byName.get("sources and further reading");
      const discoveryCount = discoveries?.content.match(/^\s*(?:[-*+] |\d+[.)] )/gm)?.length || 0;
      if (discoveries?.content && (discoveryCount < 3 || discoveryCount > 5))
        errors.push(`${file}: include three to five discovery list items`);
      if (sources?.content && !/\[[^\]]+\]\(https:\/\/[^)]+\)/.test(sources.content))
        errors.push(`${file}: sources need at least one Markdown link with an https URL`);
    }
    allEpisodes.push(episode);
  } catch (error) {
    errors.push(error.message);
  }
}

const duplicateEpisodes = allEpisodes.filter(
  (episode, index) => allEpisodes.findIndex((item) => item.episode === episode.episode) !== index,
);
const duplicateSlugs = allEpisodes.filter(
  (episode, index) => allEpisodes.findIndex((item) => item.slug === episode.slug) !== index,
);
if (duplicateEpisodes.length) errors.push("Episode numbers must be unique");
if (duplicateSlugs.length) errors.push("Episode slugs must be unique");
if (errors.length) throw new Error(`Episode validation failed:\n- ${errors.join("\n- ")}`);

const episodes = allEpisodes
  .filter((episode) => !episode.draft)
  .sort((a, b) => dateValue(String(b.published)) - dateValue(String(a.published)));

function listenLinks(includeRss = false, label = "Listen to Derailable", episode = {}) {
  const appleUrl = episode.appleUrl || config.appleUrl;
  const spotifyUrl = episode.spotifyUrl || config.spotifyUrl;
  const rssLink = includeRss
    ? `\n    <a class="text-link" href="${escapeHtml(config.rssUrl)}">Subscribe via RSS <span aria-hidden="true">&rarr;</span></a>`
    : "";
  return `<nav class="listen-links" aria-label="${escapeHtml(label)}">
    <a class="button button-primary" href="${escapeHtml(appleUrl)}">Apple Podcasts</a>
    <a class="button button-primary" href="${escapeHtml(spotifyUrl)}">Spotify</a>${rssLink}
  </nav>`;
}

function layout({ title, description, pathname, type = "website", body, structuredData }) {
  const fullTitle = title ? `${title} | ${config.name}` : `${config.name} | ${config.tagline}`;
  const markdownPath = pathname === "/" ? "/index.md" : `${pathname}index.md`;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${absoluteUrl(pathname)}">
    <link rel="alternate" type="text/markdown" href="${absoluteUrl(markdownPath)}">
    <link rel="describedby" type="text/markdown" href="${absoluteUrl("/llms.txt")}">
    <link rel="alternate" type="application/rss+xml" title="Derailable podcast RSS" href="${escapeHtml(config.rssUrl)}">
    <meta name="theme-color" content="#0D1928">
    <meta name="color-scheme" content="light">
    <meta name="robots" content="index,follow">
    <meta property="og:site_name" content="${escapeHtml(config.name)}">
    <meta property="og:title" content="${escapeHtml(fullTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${absoluteUrl(pathname)}">
    <meta property="og:type" content="${type}">
    <meta property="og:image" content="${absoluteUrl(config.socialImage)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Derailable: strange and surprising stories from history">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(fullTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${absoluteUrl(config.socialImage)}">
    <link rel="icon" href="/assets/brand/favicon.ico" sizes="any">
    <link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
${pathname === "/" ? '    <link rel="preload" as="image" href="/assets/brand/logo-lockup-on-dark.png">\n' : ""}    <link rel="stylesheet" href="/assets/style.css">
    <script type="application/ld+json">${safeJson(structuredData)}</script>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="shell header-inner">
        <a class="wordmark" href="/" aria-label="Derailable home">
          <img src="/assets/brand/logo-mark.png" alt="" width="144" height="144" decoding="async">
          <span>Derailable</span>
        </a>
        <a class="header-listen" href="${escapeHtml(config.appleUrl)}">Listen now <span aria-hidden="true">&rarr;</span></a>
      </div>
    </header>
    <main id="main">${body}</main>
    <footer class="site-footer">
      <div class="shell footer-inner">
        <div><p class="footer-name">Derailable</p><p>A ${escapeHtml(config.producer)} production.</p></div>
        <p>&copy; ${new Date().getFullYear()} ${escapeHtml(config.copyrightHolder)}.</p>
      </div>
    </footer>
  </body>
</html>`;
}

function renderHome() {
  const latest = episodes[0];
  const latestMarkup = latest
    ? `<section class="latest-section shell" aria-labelledby="latest-heading">
    <div class="section-label"><span>Latest episode</span><span aria-hidden="true">No. ${numberLabel(latest.episode)}</span></div>
    <article class="latest-grid">
      <div><p class="kicker">Episode ${latest.episode}</p><h2 id="latest-heading"><a href="${episodeUrl(latest)}">${escapeHtml(latest.title)}</a></h2></div>
      <div class="latest-copy">
        <time datetime="${escapeHtml(String(latest.published))}">${displayDate(String(latest.published))}</time>
        <p>${escapeHtml(latest.description)}</p>
        <a class="text-link" href="${episodeUrl(latest)}">Explore the episode <span aria-hidden="true">&rarr;</span></a>
        ${listenLinks(false, "Listen to the latest episode", latest)}
      </div>
    </article>
  </section>`
    : "";

  const archive = episodes
    .map(
      (episode) => `<li><a href="${episodeUrl(episode)}" class="episode-row">
    <span class="episode-number">${numberLabel(episode.episode)}</span>
    <span class="episode-row-main"><span class="episode-row-title">${escapeHtml(episode.title)}</span><span class="episode-row-description">${escapeHtml(episode.description)}</span></span>
    <time datetime="${escapeHtml(String(episode.published))}">${displayDate(String(episode.published), true)}</time>
    <span class="row-arrow" aria-hidden="true">&rarr;</span>
  </a></li>`,
    )
    .join("\n");

  const body = `<section class="hero-section">
    <div class="hero shell">
      <div class="hero-brand"><img src="/assets/brand/logo-lockup-on-dark.png" alt="Derailable" width="2100" height="520" fetchpriority="high"></div>
      <div class="hero-copy">
        <p class="kicker">A father-daughter history podcast</p>
        <h1>${escapeHtml(config.tagline)}</h1>
        <p class="hero-intro">Hazel picks something from history she&rsquo;s curious about. Her dad, Caleb, does the research and tells her one fascinating true story for the first time, on mic.</p>
        ${listenLinks(true, "Listen and subscribe")}
      </div>
    </div>
  </section>
  ${latestMarkup}
  <section class="archive-section shell" id="episodes" aria-labelledby="archive-heading">
    <div class="section-label"><h2 id="archive-heading">Episode archive</h2><span>${episodes.length} ${episodes.length === 1 ? "story" : "stories"}</span></div>
    <ol class="episode-list">${archive}</ol>
  </section>
  <section class="about-section shell" aria-labelledby="about-heading">
    <div class="section-label"><span>About the show</span><span aria-hidden="true">Caleb &amp; Hazel</span></div>
    <div class="about-grid">
      <h2 id="about-heading">History takes unexpected turns.</h2>
      <div><p>Every episode begins with something Hazel wants to know. Caleb follows the trail through archives, old accounts, and the details that usually get left out. Then he tells her the story while they record.</p><p>Hazel hears it for the first time, so her questions, surprises, and detours are completely unscripted. It&rsquo;s history for curious kids and grown-ups alike.</p></div>
    </div>
  </section>`;

  return layout({
    description: config.description,
    pathname: "/",
    body,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "PodcastSeries",
      name: config.name,
      description: config.description,
      url: config.siteUrl,
      webFeed: config.rssUrl,
      image: absoluteUrl(config.podcastArtwork),
      author: [
        { "@type": "Person", name: "Caleb" },
        { "@type": "Person", name: "Hazel" },
      ],
      publisher: { "@type": "Organization", name: config.producer },
    },
  });
}

function renderSection(section) {
  const id = sectionId(section.heading);
  return `<section class="episode-section" aria-labelledby="${id}"><h2 id="${id}">${escapeHtml(section.heading === "Summary" ? "Episode Summary" : section.heading)}</h2>${marked.parse(section.content)}</section>`;
}

function renderEpisode(episode) {
  const transcript = episode.sections.find(
    (section) => section.heading.toLowerCase() === "transcript",
  );
  const sections = episode.sections
    .filter((section) => section.content && section !== transcript)
    .map(renderSection);
  if (transcript?.content) {
    sections.push(
      `<details class="transcript"><summary>Read the transcript</summary>${renderSection(transcript)}</details>`,
    );
  }

  const body = `<article class="episode-page">
    <header class="episode-hero shell reading-shell">
      <a class="back-link" href="/#episodes"><span aria-hidden="true">&larr;</span> All episodes</a>
      <p class="kicker">Episode ${episode.episode}</p>
      <h1>${escapeHtml(episode.title)}</h1>
      <div class="episode-meta"><time datetime="${escapeHtml(String(episode.published))}">${displayDate(String(episode.published))}</time>${episode.duration ? `<span aria-hidden="true">&bull;</span><span>${escapeHtml(episode.duration)}</span>` : ""}</div>
      <p class="episode-deck">${escapeHtml(episode.description)}</p>
      ${listenLinks(false, "Listen to this episode", episode)}
    </header>
    <div class="article-rule shell" aria-hidden="true"><span></span></div>
    <div class="episode-content shell reading-shell prose">${sections.join("\n")}</div>
  </article>`;

  return layout({
    title: episode.title,
    description: episode.description,
    pathname: episodeUrl(episode),
    type: "article",
    body,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "PodcastEpisode",
      name: episode.title,
      description: episode.description,
      episodeNumber: episode.episode,
      datePublished: String(episode.published),
      ...(episode.durationIso ? { duration: episode.durationIso } : {}),
      url: absoluteUrl(episodeUrl(episode)),
      image: absoluteUrl(config.podcastArtwork),
      partOfSeries: { "@type": "PodcastSeries", name: config.name, url: config.siteUrl },
      author: [
        { "@type": "Person", name: "Caleb" },
        { "@type": "Person", name: "Hazel" },
      ],
    },
  });
}

function renderHomeMarkdown() {
  const episodeList = episodes.length
    ? episodes
        .map(
          (episode) =>
            `- [Episode ${episode.episode}: ${episode.title}](${absoluteUrl(episodeMarkdownUrl(episode))}): Published ${displayDate(String(episode.published))}. ${episode.description}`,
        )
        .join("\n")
    : "No episodes have been published yet.";

  return `# ${config.name}

> ${config.tagline}

${config.description}

Every episode, Hazel chooses a historical topic she is curious about. Caleb researches it and tells her one fascinating true story for the first time during recording. Her questions and reactions are unscripted.

## Listen

- [Apple Podcasts](${config.appleUrl})
- [Spotify](${config.spotifyUrl})
- [Podcast RSS](${config.rssUrl}): The authoritative podcast feed.

## Episodes

${episodeList}
`;
}

function renderEpisodeMarkdown(episode) {
  const appleUrl = episode.appleUrl || config.appleUrl;
  const spotifyUrl = episode.spotifyUrl || config.spotifyUrl;
  const duration = episode.duration ? `\n- Duration: ${episode.duration}` : "";
  const sections = episode.sections
    .filter((section) => section.content)
    .map((section) => `## ${section.heading}\n\n${section.content}`)
    .join("\n\n");

  return `# Episode ${episode.episode}: ${episode.title}

> ${episode.description}

- Published: ${displayDate(String(episode.published))}${duration}
- [Apple Podcasts](${appleUrl})
- [Spotify](${spotifyUrl})
- [Podcast RSS](${config.rssUrl})

${sections}
`;
}

function renderLlmsTxt() {
  const episodeList = episodes.length
    ? `\n## Episodes\n\n${episodes.map((episode) => `- [Episode ${episode.episode}: ${episode.title}](${absoluteUrl(episodeMarkdownUrl(episode))}): ${episode.description}`).join("\n")}`
    : "";

  return `# ${config.name}

> ${config.tagline}

${config.description} Episode pages contain editorial summaries, independently sourced historical discoveries, further reading, and optional transcripts.

## Site

- [Derailable overview and episode archive](${absoluteUrl("/index.md")}): Show description, listening links, and all published episodes.
- [Podcast RSS](${config.rssUrl}): The authoritative feed for podcast metadata and audio distribution.
${episodeList}

## Listen

- [Apple Podcasts](${config.appleUrl})
- [Spotify](${config.spotifyUrl})
`;
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(path.join(output, "assets", "brand"), { recursive: true });
await cp(path.join(root, "assets", "style.css"), path.join(output, "assets", "style.css"));
for (const asset of [
  "apple-touch-icon.png",
  "favicon.ico",
  "favicon.svg",
  "logo-lockup-on-dark.png",
  "logo-mark.png",
  "og-image.jpg",
  "podcast-cover.jpg",
]) {
  await cp(path.join(root, "assets", "brand", asset), path.join(output, "assets", "brand", asset));
}
await writeFile(path.join(output, "index.html"), renderHome());
await writeFile(path.join(output, "index.md"), renderHomeMarkdown());
await writeFile(path.join(output, "llms.txt"), renderLlmsTxt());
await writeFile(path.join(output, "CNAME"), `${customDomain}\n`);
await writeFile(
  path.join(output, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`,
);

for (const episode of episodes) {
  const directory = path.join(output, "episodes", episode.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "index.html"), renderEpisode(episode));
  await writeFile(path.join(directory, "index.md"), renderEpisodeMarkdown(episode));
}

const sitemapEntries = [
  `  <url><loc>${absoluteUrl("/")}</loc></url>`,
  ...episodes.map(
    (episode) =>
      `  <url><loc>${absoluteUrl(episodeUrl(episode))}</loc><lastmod>${episode.published}</lastmod></url>`,
  ),
];
await writeFile(
  path.join(output, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join("\n")}\n</urlset>\n`,
);

console.log(
  `Built ${episodes.length} published episode${episodes.length === 1 ? "" : "s"} in dist/.`,
);
