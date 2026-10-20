import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(project, "dist");
const config = JSON.parse(await readFile(path.join(project, "site.config.json"), "utf8"));
const siteOrigin = new URL(config.siteUrl).origin;
const files = [];
const errors = [];

async function walk(directory) {
  for (const name of await readdir(directory)) {
    const filename = path.join(directory, name);
    if ((await stat(filename)).isDirectory()) await walk(filename);
    else files.push(filename);
  }
}

async function fileExists(filename) {
  try {
    return (await stat(filename)).isFile();
  } catch {
    return false;
  }
}

function pageUrl(filename) {
  const relative = path.relative(output, filename).replaceAll(path.sep, "/");
  return new URL(`/${relative}`, config.siteUrl);
}

function localFile(urlValue, sourceFilename) {
  let url;
  try {
    url = new URL(urlValue, pageUrl(sourceFilename));
  } catch {
    return null;
  }
  if (url.origin !== siteOrigin) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname.endsWith("/")) pathname += "index.html";
  const target = path.resolve(output, `.${pathname}`);
  if (target !== output && !target.startsWith(`${output}${path.sep}`)) return null;
  return target;
}

await walk(output);

for (const required of [
  "CNAME",
  "index.html",
  "index.md",
  "llms.txt",
  "robots.txt",
  "sitemap.xml",
]) {
  if (!(await fileExists(path.join(output, required))))
    errors.push(`missing generated file: ${required}`);
}

const htmlFiles = files.filter((filename) => filename.endsWith(".html"));
for (const filename of htmlFiles) {
  const html = await readFile(filename, "utf8");
  const relative = path.relative(output, filename);
  const expectedPath = relative === "index.html" ? "/" : `/${relative.replace(/index\.html$/, "")}`;
  const expectedCanonical = new URL(expectedPath, config.siteUrl).href;
  if (/(?:href|src)=""/.test(html)) errors.push(`${relative}: contains an empty href or src`);
  if ((html.match(/<h1\b/g) || []).length !== 1)
    errors.push(`${relative}: expected exactly one h1`);

  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!jsonLd) errors.push(`${relative}: missing JSON-LD`);
  else {
    try {
      const data = JSON.parse(jsonLd[1]);
      const expectedType = relative === "index.html" ? "PodcastSeries" : "PodcastEpisode";
      if (data["@context"] !== "https://schema.org" || data["@type"] !== expectedType)
        errors.push(`${relative}: unexpected JSON-LD type or context`);
      for (const field of ["name", "description", "url"]) {
        if (typeof data[field] !== "string" || !data[field])
          errors.push(`${relative}: JSON-LD ${field} must be non-empty text`);
      }
      if (data.url !== expectedCanonical)
        errors.push(`${relative}: JSON-LD URL does not match its output path`);
      if (expectedType === "PodcastSeries" && typeof data.webFeed !== "string")
        errors.push(`${relative}: PodcastSeries JSON-LD needs a webFeed`);
      if (
        expectedType === "PodcastEpisode" &&
        (!Number.isInteger(data.episodeNumber) ||
          typeof data.datePublished !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(data.datePublished))
      )
        errors.push(`${relative}: PodcastEpisode JSON-LD needs an episode number and publish date`);
    } catch {
      errors.push(`${relative}: invalid JSON-LD`);
    }
  }

  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (canonical !== expectedCanonical)
    errors.push(`${relative}: canonical URL does not match its output path`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = localFile(match[1], filename);
    if (target && !(await fileExists(target)))
      errors.push(`${relative}: missing local target ${match[1]}`);
  }
}

for (const filename of files.filter((item) => /\.(?:html|md|txt)$/.test(item))) {
  if ((await readFile(filename, "utf8")).includes("—"))
    errors.push(`${path.relative(output, filename)}: contains an em dash`);
}

const llmsFilename = path.join(output, "llms.txt");
if (await fileExists(llmsFilename)) {
  const llms = await readFile(llmsFilename, "utf8");
  if (!llms.startsWith(`# ${config.name}\n\n> ${config.tagline}`))
    errors.push("llms.txt: invalid header or summary");
}

const sitemapFilename = path.join(output, "sitemap.xml");
if (await fileExists(sitemapFilename)) {
  const sitemap = await readFile(sitemapFilename, "utf8");
  const sitemapUrls = new Set(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
      match[1]
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&apos;", "'"),
    ),
  );
  const expectedUrls = new Set(
    htmlFiles.map((filename) => {
      const relative = path.relative(output, filename).replaceAll(path.sep, "/");
      const pathname = relative === "index.html" ? "/" : `/${relative.replace(/index\.html$/, "")}`;
      return new URL(pathname, config.siteUrl).href;
    }),
  );
  for (const url of expectedUrls) {
    if (!sitemapUrls.has(url)) errors.push(`sitemap.xml: missing ${url}`);
  }
  for (const url of sitemapUrls) {
    if (!expectedUrls.has(url)) errors.push(`sitemap.xml: unexpected URL ${url}`);
  }
}

const cnameFilename = path.join(output, "CNAME");
if (await fileExists(cnameFilename)) {
  const cname = (await readFile(cnameFilename, "utf8")).trim();
  if (cname !== new URL(config.siteUrl).hostname) errors.push("CNAME does not match siteUrl");
}

if (errors.length) throw new Error(`Generated site checks failed:\n- ${errors.join("\n- ")}`);
console.log(`Checked ${htmlFiles.length} HTML pages and ${files.length} generated files.`);
