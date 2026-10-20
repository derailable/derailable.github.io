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

# Project-specific workflow

This repository is a custom static-site generator, not a Vite application. The source of truth is
`site.config.json`, `src/content/episodes/`, `assets/`, and `scripts/build.mjs`; generated files in
`dist/` must not be edited directly.

Use these commands from the repository root:

- `vp install` installs dependencies using the Vite+-managed package manager.
- `vp check` runs Oxfmt (including Markdown and fenced code), Oxlint, and the configured type checks
  only.
- `vp run build` runs the project's Node generator and recreates `dist/`. Do not use bare
  `vp build`; that invokes Vite's application bundler instead.
- `vp run check` is the required full validation. It runs `vp check`, rebuilds the site, validates
  the generated HTML, and runs the generated-output checks.
- `vp run dev` builds once and serves `dist/` at `http://127.0.0.1:3001`. It does not watch source
  files; restart it after changes.
- `vp preview` serves the existing `dist/` without rebuilding it. Do not use bare `vp dev`, which
  would serve the repository as a Vite application rather than run this project's workflow.

There is currently no test suite, so `vp test` is not required. Before handing off changes, run
`vp run check`; for changes that affect rendered output, also inspect the site through `vp run dev`
or `vp preview`.
