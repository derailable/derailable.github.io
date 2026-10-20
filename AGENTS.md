<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown,
Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend
tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through
`vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for
information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a
`vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do
different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the
project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+ release. Add a tool name
to select part of the graph. For example, run `vp toolchain vite`. Use `--global` to ignore the
local `vite-plus` package. Use `vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation,
      run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include
      its output when asking for help.

<!--VITE PLUS END-->

# Derailable project guide

## Project overview

Derailable is a history podcast and companion website at https://derailable.com/. It explores
strange, surprising, forgotten, and sometimes unbelievable stories from real history.

Caleb hosts the show with his daughter Hazel. Hazel chooses a topic, Caleb researches it, and he
tells her the story during recording. Hazel hears the details for the first time, so her questions,
reactions, and discoveries are genuine and unscripted. The podcast is produced by Mudhop Studios.

### Editorial identity

- Subject: strange and surprising stories from real history.
- Audience: curious adults and children who enjoy history.
- Tone: conversational, intelligent, curious, occasionally funny, and grounded in evidence.
- Format: narrative storytelling mixed with spontaneous father-daughter conversation.
- Typical episode length: 20 to 25 minutes, with storytelling quality taking priority over runtime.

The show should be accessible to children without sounding childish. Historical complexity, unusual
details, and darker subjects are welcome when handled thoughtfully. Avoid sensationalism,
exaggerated claims, forced humor, and generic promotional language.

## Brand and privacy

- Podcast name: Derailable.
- Canonical website: https://derailable.com/.
- Tagline: Strange and surprising stories from history.
- Production credit: Mudhop Studios.
- Use "Derailable" consistently in navigation, metadata, page titles, and podcast references.
- The former public name was "Wait, That's History?" Preserve a historical reference when relevant,
  but never introduce the old name into new public-facing copy.
- Keep the Mudhop Studios credit modest, normally in the footer. It must not visually compete with
  Derailable.
- Preserve the established logo, typography, colors, and visual language unless a task explicitly
  calls for a redesign.
- Hazel is a child co-host. Use only the first names Caleb and Hazel unless explicitly instructed
  otherwise. Never add private contact details, school information, precise home locations, private
  schedules, or other unnecessary family information.
- Do not put Hazel's age in evergreen descriptions unless specifically requested.

## Website purpose and architecture

Derailable.com is the show's canonical web presence. It introduces the show and hosts, offers
listening and subscription links, provides sourced episode pages, supports search discovery, and
maintains a durable independent archive of episode information.

The website is not the podcast host. Audio and the authoritative RSS feed live externally. Do not
invent audio files, enclosure URLs, or a second podcast feed.

This repository uses a custom Node static-site generator, not a Vite web application or frontend
framework. It intentionally ships no client-side JavaScript, database, CMS, or application runtime.
Favor simple, fast, accessible, static-first solutions.

Sources of truth:

- `site.config.json` contains show metadata, canonical URLs, distribution links, and artwork paths.
- `src/content/episodes/` contains episode Markdown source files, including drafts.
- `templates/episode.md` is the starting point for a new episode.
- `assets/` contains the source stylesheet and brand artwork.
- `scripts/content.mjs` parses YAML frontmatter and enforces the episode content schema.
- `scripts/build.mjs` validates content and regenerates the complete site.
- `scripts/check.mjs` validates generated files, local links, metadata, and other output invariants.
- `dist/` is generated and ignored by Git. Never edit it directly or treat it as source.
- `.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages.

## Podcast distribution

### Show-level URLs

- Apple Podcasts: https://podcasts.apple.com/us/podcast/derailable/id6824321418
- Spotify: https://open.spotify.com/show/7izZqcaoe69vQOLcqvisAp
- Overcast: https://overcast.fm/itunes6824321418/derailable
- RSS: https://anchor.fm/s/118a88194/podcast/rss

Keep these shared values centralized in `site.config.json`. Apple Podcasts, Spotify, and Overcast
are equally prominent homepage listening options. RSS is a smaller secondary subscription link. When
a show URL changes, update configuration rather than duplicating a replacement in renderers.

### Episode-level URLs

Episodes may define direct Apple Podcasts, Spotify, and Overcast URLs in Markdown frontmatter as
`appleUrl`, `spotifyUrl`, and `overcastUrl`.

- Episode links are optional and must use HTTPS when present.
- Render only the direct URLs actually supplied for that episode.
- Never substitute a show-level URL for a missing episode-level URL.
- Never guess, derive, or construct an episode URL without verification.
- Missing values must not produce empty buttons, empty navigation, or broken links.
- Preserve the shared `listenLinks` renderer, visible platform names, accessible labels, consistent
  icons, and consistent button styling.

## Episode content model

Episode 1 is `src/content/episodes/001-washington-monument-that-almost-wasnt.md`.

Required frontmatter fields:

- `title`: non-empty text.
- `episode`: unique positive integer.
- `published`: a real date in `YYYY-MM-DD` format.
- `description`: concise text used in cards, metadata, and social previews.
- `draft`: `true` or `false`.

Optional frontmatter fields:

- `duration`: human-readable duration.
- `durationIso`: ISO 8601 duration for structured data.
- `slug`: lowercase words separated by hyphens. Otherwise the filename determines the slug.
- `appleUrl`, `spotifyUrl`, and `overcastUrl`: verified direct episode URLs.

Do not add or rename fields without updating content parsing, validation, rendering, generated
Markdown, documentation, and `templates/episode.md` as applicable.

Frontmatter is parsed as YAML with duplicate keys and unknown fields rejected. Keep an episode's
metadata and prose together in its Markdown file. Do not split them into parallel JSON or YAML
files.

Published episodes require a non-empty `Summary`. Other editorial sections are optional. Supported
sections use these exact level-two headings:

- `Summary`
- `Interesting Discoveries`
- `Sources and Further Reading`
- `Transcript`, optional

Unknown and duplicate level-two section headings fail validation. Empty optional sections are not
rendered. When present, Interesting Discoveries should contain three to five list items. Sources and
Further Reading must contain at least one descriptive HTTPS link. A short two-space-indented
annotation may follow a source link. Raw HTML in episode Markdown is escaped rather than executed.
Markdown links and images must use HTTPS or a local path.

### Creating an episode

1. Copy `templates/episode.md` into `src/content/episodes/`.
2. Follow the numeric filename and lowercase hyphenated slug conventions.
3. Supply accurate metadata and a concise, compelling description.
4. Keep `draft: true` while the episode is incomplete.
5. Add only verified episode-specific listening URLs.
6. Include historical sources when available.
7. Change to `draft: false` only when ready to publish.
8. Build and inspect the homepage and episode page before handoff.

Keep the template synchronized with the implemented schema. Do not change a published episode slug
or URL without explicitly handling redirects and existing inbound links.

## Editorial standards

### Historical accuracy and sources

- Support historical claims with reliable evidence.
- Prefer primary sources, museums, archives, government historical resources, established historical
  institutions, and credible scholarly publications.
- Distinguish documented facts from disputed accounts, legends, and popular myths.
- Communicate uncertainty instead of presenting speculation as fact.
- Never invent facts, quotations, citations, dates, sources, listening links, or other URLs.
- Link to original publications or authoritative archives when possible.
- Use descriptive source link text rather than bare URLs where appropriate.
- Never fabricate sources merely to fill a section.

### Writing style

- Use American English, direct language, short paragraphs, and specific historical details.
- Sound conversational and curious, not childish, academic, promotional, or generically AI-written.
- Avoid clickbait, exaggerated certainty, unnecessary jargon, forced jokes, and filler.
- Do not use em dashes or semicolons in editorial copy.
- Episode descriptions should introduce the central story or question without revealing every
  surprise.
- Show notes should complement the audio rather than reproduce the entire episode.

### Transcripts

Transcripts are optional. When available, preserve the actual spoken conversation and Hazel's
contributions. Light cleanup for readability is acceptable. Do not invent dialogue, generate a
fictional transcript from notes, or silently rewrite factual statements.

## Technical and design principles

Prioritize, in order:

1. Simplicity and maintainability.
2. Accessibility.
3. Performance.
4. Semantic HTML.
5. Responsive design.
6. Search discoverability.

Reuse existing functions, configuration, styles, and dependencies. Prefer native platform features
over new packages. Avoid unnecessary JavaScript, services, databases, and infrastructure.

Each episode needs its own meaningful title, description, canonical URL, social metadata, and valid
PodcastEpisode structured data. Keep canonical URLs stable and never fabricate publication dates,
durations, audio URLs, or structured-data values.

Use a logical heading hierarchy, descriptive links, accessible labels, sufficient contrast, and
keyboard-accessible navigation. Listening controls must remain understandable without icons. Check
responsive layouts when changing the number, size, or text of navigation items and buttons.

## Toolchain and commands

Run commands from the repository root:

- `vp install` installs dependencies with the Vite+-managed package manager.
- `vp fmt` formats all supported files, including Markdown, YAML frontmatter, and fenced code.
- `vp check` runs Oxfmt, Oxlint, and configured type checks only.
- `vp test` runs the focused content parser and validation tests.
- `vp run build` runs `scripts/build.mjs` and recreates `dist/`. Do not use bare `vp build`, which
  invokes Vite's application bundler.
- `vp run check` is the required full validation. It runs static checks, rebuilds the site, runs
  tests, validates generated HTML, and runs `scripts/check.mjs`.
- `vp run dev` builds once and serves `dist/` at `http://127.0.0.1:3001`. It does not watch or
  live-reload. Restart it after source changes.
- `vp preview` serves the existing `dist/` without rebuilding.

Do not use bare `vp dev`, which would treat the repository as a Vite application.

## Working conventions for agents

Before changing the project:

- Inspect the relevant files and established conventions.
- Preserve unrelated user changes, published copy, historical claims, and styling.
- Make the smallest maintainable change that satisfies the request.
- Reuse shared configuration and renderers rather than duplicating values or markup.
- Avoid broad refactors or new dependencies without clear justification.
- Do not alter episode claims, sources, quotations, titles, descriptions, or publication data unless
  the task requires it.

After changing the project:

- Keep README guidance and the episode template aligned with implementation.
- Run `vp run check` before handoff.
- For rendered changes, inspect the relevant output through `vp run dev` or `vp preview` when
  practical.
- Check episode frontmatter, generated HTML and Markdown, internal links, canonical metadata,
  structured data, and responsive behavior as relevant.
- Confirm optional content does not create empty elements, broken links, or awkward layouts.
- Report changed files, validation performed, and any verification limitations.

The guiding principle: Derailable.com should be an independent, trustworthy, accessible, and durable
home for the show. Keep it simple to maintain, welcoming to curious listeners, careful with history,
and protective of the family behind it.
