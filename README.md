# Derailable

<p align="center">
  <a href="https://derailable.com/">
    <img src="assets/brand/logo-lockup-on-dark.png" width="640" alt="Derailable">
  </a>
</p>

<p align="center"><strong>Strange and surprising stories from history.</strong></p>

<p align="center">
  <a href="https://derailable.com/">Website</a> ·
  <a href="https://podcasts.apple.com/us/podcast/derailable/id6824321418">Apple Podcasts</a> ·
  <a href="https://open.spotify.com/show/7izZqcaoe69vQOLcqvisAp">Spotify</a> ·
  <a href="https://overcast.fm/itunes6824321418/derailable">Overcast</a> ·
  <a href="https://anchor.fm/s/118a88194/podcast/rss">RSS</a>
</p>

<p align="center">
  <a href="https://github.com/derailable/derailable.github.io/actions/workflows/deploy.yml">
    <img src="https://github.com/derailable/derailable.github.io/actions/workflows/deploy.yml/badge.svg" alt="Deploy site status">
  </a>
</p>

## About the podcast

**Derailable** is a history podcast hosted by Caleb and his daughter Hazel. Hazel chooses something
from history she wants to understand, Caleb researches it, and then he tells her the story while
they record. Hazel hears the details for the first time, so her questions, reactions, and
discoveries are genuine and unscripted.

The show explores the strange, surprising, forgotten, and sometimes unbelievable turns hidden in
real history. It is made for curious adults and children, with thoughtful storytelling, reliable
sources, and enough room for the conversation to take an unexpected detour.

Derailable is produced by **Mudhop Studios**. Visit [derailable.com](https://derailable.com/) to
browse episodes, read show notes, and explore the historical sources behind each story.

## About this repository

This repository contains the podcast's canonical website. A small Node build script turns one
Markdown file per episode into plain HTML for GitHub Pages. There is no frontend framework,
client-side JavaScript, CMS, database, or application runtime. No package dependencies are delivered
to visitors.

## Project structure

```text
assets/brand/            Brand artwork and icons used by the site
assets/style.css         Site-wide styles
scripts/content.mjs      Parses and validates episode content
scripts/content.test.mjs Focused content validation tests
scripts/build.mjs        Validates content and generates the site
scripts/check.mjs        Validates the generated production output
vite.config.ts           Vite+ checks and local preview configuration
site.config.json         Show details, platform links, and artwork paths
src/content/episodes/    One Markdown file per episode
templates/episode.md     Starting point for a new episode
dist/                    Generated site, ignored by Git
```

Do not edit files in `dist/`. Every build deletes and recreates that directory from the source
files.

## Local development

Install Vite+, then install the dependencies and start the site:

```sh
vp install
vp run dev
```

Open `http://127.0.0.1:3001`.

`vp run dev` builds the site once and then serves `dist/`. It does not watch files or live-reload.
After changing content or styles, stop the server with Ctrl+C and run `vp run dev` again.

Other commands:

```sh
# Build dist/ without starting a server (bare `vp build` is not the site generator)
vp run build

# Run formatting (including Markdown), linting, and type checks
vp check

# Run focused content parser and schema tests
vp test

# Build and run all production checks
vp run check

# Serve the most recent build without rebuilding it
vp preview

# Serve the most recent build on another port
vp preview --port 3002
```

Always use the project preview command. Serving the repository root will show the source directory
instead of the generated website and may display `Index of /`.

## Publish an episode

1. Copy `templates/episode.md` to `src/content/episodes/002-topic-name.md`.
2. Update the frontmatter.
3. Write the Summary and any other sections needed for the episode. Interesting Discoveries and
   Sources and Further Reading are recommended when applicable.
4. Keep `draft: true` while writing.
5. Change it to `draft: false` when the episode is ready.
6. Run `vp run dev` and review the homepage and episode page.
7. Commit and push to `main`. GitHub Actions builds and deploys the site.

The filename becomes the permanent URL after its numeric prefix is removed:

```text
src/content/episodes/002-topic-name.md
https://derailable.com/episodes/topic-name/
```

Use lowercase words separated by hyphens. The optional `slug` field can override the
filename-derived URL, but changing a published slug will break existing links.

### Episode frontmatter

Required fields:

| Field         | Format            | Purpose                                                 |
| ------------- | ----------------- | ------------------------------------------------------- |
| `title`       | Text              | Episode title                                           |
| `episode`     | Positive integer  | Episode number; must be unique                          |
| `published`   | `YYYY-MM-DD`      | Publication date and archive sorting                    |
| `description` | Text              | Homepage excerpt, page description, and social metadata |
| `draft`       | `true` or `false` | Controls whether the episode is generated               |

Optional fields:

| Field         | Format                        | Purpose                                       |
| ------------- | ----------------------------- | --------------------------------------------- |
| `duration`    | Text, such as `20 min 14 sec` | Human-readable duration shown on the page     |
| `durationIso` | ISO 8601, such as `PT20M14S`  | Machine-readable duration for structured data |
| `slug`        | Lowercase hyphenated text     | Overrides the URL derived from the filename   |
| `appleUrl`    | HTTPS URL                     | Episode-specific Apple Podcasts link          |
| `spotifyUrl`  | HTTPS URL                     | Episode-specific Spotify link                 |
| `overcastUrl` | HTTPS URL                     | Episode-specific Overcast link                |

Leave an episode platform URL blank or omit it until that episode is available there. Episode pages
only render buttons for direct links supplied in frontmatter; show-level links remain centralized in
`site.config.json` for the homepage.

Frontmatter uses standard YAML. Duplicate keys, unknown fields, invalid field types, and unverified
placeholder values fail validation. Keep episode metadata and prose in the same Markdown file.

### Episode sections

Use these exact level-two Markdown headings for the corresponding editorial sections:

```markdown
## Summary

## Interesting Discoveries

## Sources and Further Reading
```

Summary is required and must be non-empty for a published episode. The other sections are optional,
and empty optional sections are not rendered. Unknown or duplicate level-two headings fail
validation. When Interesting Discoveries is present, use three to five Markdown list items. When
Sources and Further Reading is present, include at least one Markdown link using an `https` URL. A
short annotation can follow each source link on the next line. Raw HTML is displayed as text rather
than executed. Markdown links and images must use HTTPS or a local path.

The transcript is optional. Add it only when one is available:

```markdown
## Transcript

**Caleb:** Welcome to Derailable...

**Hazel:** Hi!
```

The generated page places a transcript in an accessible collapsible section. If the heading is
absent or empty, no transcript interface or placeholder is rendered.

### Drafts and validation

Draft episodes are parsed and checked for valid frontmatter, unique episode numbers, unique slugs,
and valid dates. They are excluded from the homepage, archive, episode routes, sitemap, and
deployment artifact.

Published episodes require a Summary and receive additional checks for three to five discoveries
when that section is present and at least one source link when the sources section is present. Dates
must be real calendar dates in `YYYY-MM-DD` format, duration fields must be supplied as a valid
pair, and podcast links must use HTTPS. A failed check stops the build and prints the filename and
problem.

## Site settings

Edit `site.config.json` to change:

- Site name, tagline, and description
- Canonical site URL
- Apple Podcasts, Spotify, Overcast, and RSS links
- Production credit and copyright holder
- Podcast artwork and social preview image paths

Platform links are centralized there. Episode-specific Apple Podcasts, Spotify, and Overcast links
remain optional.

The homepage presents all three listening platforms with equal button styling and keeps RSS as a
smaller subscription link. Episode pages do not fall back to these show URLs: they only show a
platform button when that episode's Markdown frontmatter provides a direct URL. The same distinction
is preserved in the generated Markdown pages and `llms.txt`.

## Brand assets

The brand files used by the website live in `assets/brand/`:

- `logo-mark.png`: optimized 144px header mark beside the live “Derailable” text
- `logo-lockup-on-dark.png`: homepage hero lockup on navy
- `favicon.svg` and `favicon.ico`: primary and fallback browser icons
- `apple-touch-icon.png`: iOS home-screen icon
- `og-image.jpg`: Open Graph and Twitter sharing image
- `podcast-cover.jpg`: square podcast artwork used in structured data

Replace an image in place to update it without code changes. Preserve its filename, transparency,
aspect ratio, and intended background. Keep only files referenced by the build or site
configuration.

The development dependencies are `marked`, which converts episode Markdown into HTML; `yaml`, which
parses episode frontmatter; `html-validate`, which checks generated pages before deployment; and
Vite+, which provides the development toolchain, test runner, and preview server. None are shipped
to visitors.

## Build output

`vp run build` performs the following work:

1. Reads every Markdown file in `src/content/episodes/` and validates its YAML frontmatter and
   editorial sections.
2. Excludes drafts and sorts published episodes newest first.
3. Generates the homepage and permanent episode pages.
4. Generates metadata, PodcastSeries and PodcastEpisode structured data, `robots.txt`,
   `sitemap.xml`, and `CNAME`.
5. Generates `llms.txt` and clean Markdown versions of the homepage and episode pages.
6. Copies the stylesheet and only the brand assets used by the site.
7. Writes the complete static website to `dist/`.

The existing external podcast RSS feed remains authoritative. The website links to that feed and
does not generate a second podcast feed.

## LLM-readable output

The build generates `/llms.txt` as a concise guide to the show and its published episodes. It also
generates `/index.md` and `/episodes/[slug]/index.md` as clean Markdown versions of the public
pages. Each HTML page identifies its Markdown version and `/llms.txt` through standard link
relations.

These files are generated from `site.config.json` and the existing episode Markdown files. Do not
edit them in `dist/`, and do not maintain separate LLM content. Publishing or updating an episode
refreshes the human-readable and LLM-readable versions together.

## GitHub Pages deployment

The deployment workflow is `.github/workflows/deploy.yml`.

- A push to `main`, or a manual workflow dispatch, starts deployment.
- GitHub Actions installs dependencies with `npm ci`.
- The action runs `npm run check` so the repository-local Vite+ binary is available, and uploads
  `dist/` only after validation succeeds.
- GitHub Pages publishes the uploaded artifact.
- The generated `CNAME` uses the hostname from `siteUrl` in `site.config.json`.

In the repository settings, Pages must use **GitHub Actions** as its source. Deployment progress and
build failures appear in the repository's Actions tab.

The local server and GitHub Actions have separate jobs. Local preview lets you review the generated
site before committing. GitHub Actions creates and publishes a fresh production build after the
push.

## Why there is no frontend framework

The current site only needs static pages generated from a small set of Markdown files. Vite+
provides the local preview server and code-quality toolchain but does not replace the content
generator. Astro would provide a larger framework and similar Markdown behavior with more
dependencies and project structure.

The current approach keeps episode publishing to one file, produces no client-side JavaScript, and
has fewer moving parts. Astro would be worth reconsidering if the site later gains several content
types, shared interactive components, or a substantially larger archive.
