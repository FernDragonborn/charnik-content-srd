# charnik-content-srd

The SRD rules data that [Charnik](https://github.com/FernDragonborn/charnik) ships with, as plain
CSV. It lives in its own repository so **rules data can be corrected and released without shipping
an app build** — a content fix is a commit here, not a new binary.

```
srd-2014/   D&D 5e   — from SRD 5.1    (source tag "SRD 5.1")
srd-2024/   D&D 5.5e — from SRD 5.2.1  (source tag "SRD 5.2.1")
```

Each top-level folder is one **content pack**. A pack is just a folder of CSVs — there is no
manifest or index file; every CSV describes itself in-band through its `#content-*` header
(`#content-source`, `#content-license`, `#content-url`, `#content-id`, `#content-updated_at`,
`#content-hash`, `#content-systems`). Drop another folder in beside these and it is another pack.

## Using it with the app

Clone this repo **next to** the app repo — that layout needs no configuration at all:

```
some-folder/
├─ charnik/               ← the app
└─ charnik-content-srd/   ← this repo
```

A different location goes in `charnik.dev.json` in the app repo (`{ "contentRepo": "…" }`), or in
the `CHARNIK_CONTENT` environment variable. The app vendors these CSVs into its build, so a release
always carries a working copy of the content as its floor.

## Editing

Every row is **transcribed** from the published SRD text — data is never authored from memory.
After any hand-edit, re-stamp the file's hash
from the app repo, or the app's content-health panel flags it as drifted:

```
pnpm restamp <path-to-file.csv>
```

One column is not a plain fact: **`effects`**, which is what makes a number on the character sheet
change by itself. [**Effects — the author's guide**](https://claude.ai/code/artifact/b908baa5-f4c7-46bf-bd51-f3b2bdd4ad9e)
is the whole of it in plain language — every effect kind, everything one can point at, and the small
formula language — for whoever is writing that column rather than changing the app.

## The pack checks its own size

```sh
node check.mjs            # every CSV's row count against manifest.json
node check.mjs --update   # after a deliberate change: rewrite it, commit both
```

No install, no dependencies. It catches a truncated file, a bad hand-edit or a half-finished import
— the shape of failure that otherwise ships silently. What it cannot tell you is that a row is
*wrong*, only that the pack is no longer the shape it was released as.

Count rows with this, never with `wc -l`: most of this content is multi-line prose inside quoted
cells, so line counts run about eight times high — `srd-2024/items_srd.csv` is 3576 lines and 420 items.

## License

The rules data is © Wizards of the Coast LLC, licensed under
[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode). See `LICENSE` and
`ATTRIBUTION.md` — keeping that credit is a condition of use. SRD material only: no Product
Identity, no non-SRD content.
