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

function localFile(urlValue) {
  let url;
  try {
    url = new URL(urlValue, config.siteUrl);
  } catch {
    return null;
  }
  if (url.origin !== siteOrigin) return null;
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  return path.join(output, pathname.replace(/^\/+/, ""));
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
  if (/(?:href|src)=""/.test(html)) errors.push(`${relative}: contains an empty href or src`);
  if ((html.match(/<h1\b/g) || []).length !== 1)
    errors.push(`${relative}: expected exactly one h1`);

  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!jsonLd) errors.push(`${relative}: missing JSON-LD`);
  else {
    try {
      JSON.parse(jsonLd[1]);
    } catch {
      errors.push(`${relative}: invalid JSON-LD`);
    }
  }

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = localFile(match[1]);
    if (target && !(await fileExists(target)))
      errors.push(`${relative}: missing local target ${match[1]}`);
  }
}

for (const filename of files.filter((item) => /\.(?:html|md|txt)$/.test(item))) {
  if ((await readFile(filename, "utf8")).includes("—"))
    errors.push(`${path.relative(output, filename)}: contains an em dash`);
}

const llms = await readFile(path.join(output, "llms.txt"), "utf8");
if (!llms.startsWith(`# ${config.name}\n\n> ${config.tagline}`))
  errors.push("llms.txt: invalid header or summary");

const sitemap = await readFile(path.join(output, "sitemap.xml"), "utf8");
for (const filename of htmlFiles) {
  const relative = path.relative(output, filename).replaceAll(path.sep, "/");
  const pathname = relative === "index.html" ? "/" : `/${relative.replace(/index\.html$/, "")}`;
  if (!sitemap.includes(new URL(pathname, config.siteUrl).href))
    errors.push(`sitemap.xml: missing ${pathname}`);
}

const cname = (await readFile(path.join(output, "CNAME"), "utf8")).trim();
if (cname !== new URL(config.siteUrl).hostname) errors.push("CNAME does not match siteUrl");

if (errors.length) throw new Error(`Generated site checks failed:\n- ${errors.join("\n- ")}`);
console.log(`Checked ${htmlFiles.length} HTML pages and ${files.length} generated files.`);
