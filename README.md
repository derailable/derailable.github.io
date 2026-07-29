# Derailable

Static homepage for [derailable.com](https://derailable.com/), a concise site for reproducible analysis, datasets, visualizations, and research.

Derailable focuses on reproducible analysis in R and Python, turning messy operational data into signal teams can measure, explain, and act on.

## Structure

- `index.html` contains the homepage content and metadata.
- `style.css` contains the responsive visual system.
- `assets/` contains the Derailable logo files.
- `CNAME` configures the GitHub Pages custom domain.

There is no build step, dependency setup, JavaScript, or external font service.

## Local Editing

Open `index.html` directly in a browser, or run a simple static server from the repository root:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
