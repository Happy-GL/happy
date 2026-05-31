# Happy Creative Ecosystem

Static HTML, CSS, and vanilla JavaScript website for the Happy Creative Ecosystem brand, with products loaded from JSON data.

To update social links later, edit `data/links.json`.

## Run Locally

Because the site loads JSON files with `fetch`, run it through a local static server instead of opening `index.html` directly.

```bash
python -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000/
```

Product detail pages use URLs like:

```text
http://127.0.0.1:8000/product.html?id=PRODUCT_ID
```

## DeviantArt Product Import

This site imports new products from DeviantArt RSS feeds. It does not scrape DeviantArt pages.

Run the import manually with:

```bash
npm run import:deviantart
```

The script reads `data/deviantart-sources.json` and updates `data/deviantart-products.json`.

Imported works appear in the correct collection based on the DeviantArt account:

- `happygl1` -> T-Shirt Designs -> `$24.00`
- `happyfi` -> Dark Art -> `$20.00`
- `happyal1` -> Anime Wallpapers -> `$3.00`

Manual products stay in `data/products.json`; imported products stay in `data/deviantart-products.json`.

## Automatic DeviantArt Updates

GitHub Actions updates DeviantArt products automatically once per day.

Workflow file:

```text
.github/workflows/import-deviantart.yml
```

Schedule:

```text
0 3 * * *
```

That runs every day at 03:00 UTC. You can also run it manually from the GitHub Actions tab with `workflow_dispatch`.

The workflow:

- checks out the repository
- sets up Node.js
- installs dependencies
- runs `npm run import:deviantart`
- checks whether `data/deviantart-products.json` changed
- commits and pushes only when product data changed

Commit message:

```text
chore: update DeviantArt products
```

If no new products are found, the workflow finishes successfully without committing.

## Deploy With Netlify

1. Push this project to a GitHub repository.
2. In Netlify, choose **Add new site** -> **Import an existing project**.
3. Connect the GitHub repository.
4. Use these settings:

```text
Build command: leave empty
Publish directory: .
```

5. Deploy the site.

After GitHub Actions commits updated `data/deviantart-products.json`, Netlify will detect the repository change and redeploy automatically.

## GitHub Pages Fallback

You can also publish the site with GitHub Pages:

1. Push the project to GitHub.
2. Open the repository settings.
3. Go to **Pages**.
4. Set the source to your main branch and the root folder.
5. Save the Pages settings.

GitHub Pages will serve `index.html` from the project root. After the scheduled import workflow commits updated product data, GitHub Pages will update from the latest repository contents.
