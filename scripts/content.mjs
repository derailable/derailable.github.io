import path from "node:path";
import { marked } from "marked";
import { parseDocument } from "yaml";

const requiredFields = ["title", "episode", "published", "description", "draft"];
const optionalFields = ["slug", "duration", "durationIso", "appleUrl", "spotifyUrl", "overcastUrl"];
const allowedFields = new Set([...requiredFields, ...optionalFields]);
const allowedSections = new Set([
  "Summary",
  "Interesting Discoveries",
  "Sources and Further Reading",
  "Transcript",
]);

export function isHttpsUrl(value) {
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

function isIsoDuration(value) {
  return (
    typeof value === "string" &&
    /^P(?=\d|T\d)(?:\d+(?:\.\d+)?Y)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?W)?(?:\d+(?:\.\d+)?D)?(?:T(?=\d)(?:\d+(?:\.\d+)?H)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?S)?)?$/.test(
      value,
    )
  );
}

function isSafeMarkdownUrl(value) {
  try {
    return new URL(value, "https://episode-content.invalid/").protocol === "https:";
  } catch {
    return false;
  }
}

export function parseEpisode(source, file) {
  const match = source.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing frontmatter enclosed by --- lines`);

  const document = parseDocument(match[1], { uniqueKeys: true });
  if (document.errors.length) {
    const details = document.errors.map((error) => error.message.split("\n")[0]).join("; ");
    throw new Error(`${file}: invalid YAML frontmatter: ${details}`);
  }

  let data;
  try {
    data = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new Error(`${file}: invalid YAML frontmatter: ${error.message}`, { cause: error });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${file}: frontmatter must be a YAML mapping`);
  }

  const unknownFields = Object.keys(data).filter((field) => !allowedFields.has(field));
  if (unknownFields.length) {
    throw new Error(`${file}: unknown frontmatter fields: ${unknownFields.join(", ")}`);
  }

  const sections = [];
  const preamble = [];
  let current;
  for (const line of match[2].split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = { heading: heading[1], content: [] };
      sections.push(current);
    } else if (current) {
      current.content.push(line);
    } else {
      preamble.push(line);
    }
  }

  const meaningfulPreamble = preamble
    .join("\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  if (meaningfulPreamble)
    throw new Error(`${file}: content before the first level-two section heading is not supported`);

  const filenameSlug = path.basename(file, path.extname(file)).replace(/^\d+-/, "");
  return {
    ...data,
    file,
    slug: data.slug === undefined || data.slug === "" ? filenameSlug : data.slug,
    sections: sections.map((section) => ({
      ...section,
      content: section.content.join("\n").trim(),
    })),
  };
}

export function validateEpisode(episode) {
  const errors = [];
  const prefix = `${episode.file}: `;
  const missing = requiredFields.filter((field) => {
    const value = episode[field];
    return value === undefined || value === null || (typeof value === "string" && !value.trim());
  });
  if (missing.length) errors.push(`${prefix}missing required frontmatter: ${missing.join(", ")}`);

  if (!Number.isInteger(episode.episode) || episode.episode < 1)
    errors.push(`${prefix}episode must be a positive integer`);
  if (typeof episode.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(episode.slug))
    errors.push(`${prefix}slug must use lowercase words separated by hyphens`);
  if (!isValidDate(episode.published))
    errors.push(`${prefix}published must be a valid date in YYYY-MM-DD format`);
  if (typeof episode.draft !== "boolean") errors.push(`${prefix}draft must be true or false`);
  if (typeof episode.title !== "string" || !episode.title.trim())
    errors.push(`${prefix}title must be non-empty text`);
  if (typeof episode.description !== "string" || !episode.description.trim())
    errors.push(`${prefix}description must be non-empty text`);

  for (const field of ["appleUrl", "spotifyUrl", "overcastUrl"]) {
    const value = episode[field];
    if (value !== undefined && value !== "" && !isHttpsUrl(value))
      errors.push(`${prefix}${field} must be an https URL`);
  }

  const hasDuration = episode.duration !== undefined && episode.duration !== "";
  const hasDurationIso = episode.durationIso !== undefined && episode.durationIso !== "";
  if (hasDuration && (typeof episode.duration !== "string" || !episode.duration.trim()))
    errors.push(`${prefix}duration must be non-empty text when provided`);
  if (hasDurationIso && !isIsoDuration(episode.durationIso))
    errors.push(`${prefix}durationIso must be a valid ISO 8601 duration`);
  if (hasDuration !== hasDurationIso)
    errors.push(`${prefix}duration and durationIso must be provided together`);

  const headingCounts = new Map();
  for (const section of episode.sections) {
    headingCounts.set(section.heading, (headingCounts.get(section.heading) || 0) + 1);
    if (!allowedSections.has(section.heading))
      errors.push(`${prefix}unsupported section heading: ${section.heading}`);
  }
  const duplicates = [...headingCounts]
    .filter(([, count]) => count > 1)
    .map(([heading]) => heading);
  if (duplicates.length)
    errors.push(`${prefix}duplicate section headings: ${duplicates.join(", ")}`);

  const unsafeUrls = new Set();
  for (const section of episode.sections) {
    void marked.walkTokens(marked.lexer(section.content), (token) => {
      if ((token.type === "link" || token.type === "image") && !isSafeMarkdownUrl(token.href))
        unsafeUrls.add(token.href);
    });
  }
  if (unsafeUrls.size)
    errors.push(`${prefix}Markdown links and images must use HTTPS or local paths`);

  if (episode.draft === false) {
    const byName = new Map(episode.sections.map((section) => [section.heading, section]));
    const summary = byName.get("Summary");
    if (!summary?.content) errors.push(`${prefix}published episodes need a non-empty Summary`);

    const discoveries = byName.get("Interesting Discoveries");
    const sources = byName.get("Sources and Further Reading");
    const discoveryCount = discoveries?.content.match(/^\s*(?:[-*+] |\d+[.)] )/gm)?.length || 0;
    if (discoveries?.content && (discoveryCount < 3 || discoveryCount > 5))
      errors.push(`${prefix}include three to five discovery list items`);
    if (sources?.content && !/\[[^\]]+\]\(https:\/\/[^)]+\)/.test(sources.content))
      errors.push(`${prefix}sources need at least one Markdown link with an https URL`);
  }

  return errors;
}
