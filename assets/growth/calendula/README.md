# Growth image assets

Cloudflare R2 object layout:

- growth/calendula/seed.webp
- growth/calendula/germination.webp
- growth/calendula/sprout.webp
- growth/calendula/true_leaves.webp
- growth/calendula/bud.webp
- growth/calendula/bloom.webp

The canonical metadata, SHA-256 checksums and D1 rows are in:

- cloudflare/assets-manifest.json
- cloudflare/seed.sql

Binary image files should be uploaded to the R2 bucket `mind-garden-growth-images`.
The GitHub Actions workflow `.github/workflows/cloudflare-assets.yml` is prepared to upload files placed in this directory after Cloudflare credentials are configured.
