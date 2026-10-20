import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { parseEpisode, validateEpisode } from "./content.mjs";

const validFrontmatter = `title: "A surprising story"
episode: 2
published: 2026-11-01
description: >-
  A concise episode description that uses standard YAML folding.
duration: "24 min 10 sec"
durationIso: "PT24M10S"
appleUrl: ""
spotifyUrl: ""
overcastUrl: "https://overcast.fm/+example"
draft: false`;

const validBody = `## Summary

A complete episode summary.

## Interesting Discoveries

- First discovery.
- Second discovery.
- Third discovery.

## Sources and Further Reading

- [A reliable source](https://example.org/source)`;

function source(frontmatter = validFrontmatter, body = validBody) {
  return `---\n${frontmatter}\n---\n${body}\n`;
}

describe("episode content", () => {
  it("parses YAML frontmatter and derives the slug from the filename", () => {
    const episode = parseEpisode(source(), "002-a-surprising-story.md");

    expect(episode.description).toBe(
      "A concise episode description that uses standard YAML folding.",
    );
    expect(episode.slug).toBe("a-surprising-story");
    expect(validateEpisode(episode)).toEqual([]);
  });

  it("rejects duplicate and unknown frontmatter fields", () => {
    expect(() =>
      parseEpisode(source(`${validFrontmatter}\ntitle: "Duplicate"`), "duplicate.md"),
    ).toThrow(/Map keys must be unique/);
    expect(() => parseEpisode(source(`${validFrontmatter}\nunknown: true`), "unknown.md")).toThrow(
      /unknown frontmatter fields: unknown/,
    );
  });

  it("requires a summary and validates paired durations for published episodes", () => {
    const episode = parseEpisode(
      source(validFrontmatter.replace('durationIso: "PT24M10S"\n', ""), "## Summary\n"),
      "invalid.md",
    );

    expect(validateEpisode(episode).join("\n")).toMatch(/duration and durationIso/);
    expect(validateEpisode(episode).join("\n")).toMatch(/non-empty Summary/);
  });

  it("rejects malformed ISO durations and unsafe Markdown URLs", () => {
    const episode = parseEpisode(
      source(
        validFrontmatter.replace('durationIso: "PT24M10S"', 'durationIso: "24 minutes"'),
        `${validBody}\n\n[Unsafe](javascript:alert(1))`,
      ),
      "unsafe.md",
    );
    const errors = validateEpisode(episode).join("\n");

    expect(errors).toMatch(/valid ISO 8601 duration/);
    expect(errors).toMatch(/Markdown links and images must use HTTPS or local paths/);
  });

  it("rejects unsupported and duplicate section headings", () => {
    const episode = parseEpisode(
      source(validFrontmatter, `${validBody}\n\n## Summary\n\nAgain.\n\n## Notes\n\nUnsupported.`),
      "sections.md",
    );
    const errors = validateEpisode(episode).join("\n");

    expect(errors).toMatch(/duplicate section headings: Summary/);
    expect(errors).toMatch(/unsupported section heading: Notes/);
  });

  it("keeps the checked-in template invalid until required metadata is filled", async () => {
    const templateUrl = new URL("../templates/episode.md", import.meta.url);
    const episode = parseEpisode(await readFile(fileURLToPath(templateUrl), "utf8"), "template.md");
    const errors = validateEpisode(episode).join("\n");

    expect(errors).toMatch(/missing required frontmatter/);
    expect(errors).toMatch(/episode must be a positive integer/);
    expect(episode.sections.every((section) => !section.content)).toBe(true);
  });
});
