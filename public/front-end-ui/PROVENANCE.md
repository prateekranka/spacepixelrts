# Front-end UI asset provenance

The bundled typefaces are retained WOFF2 webfont files from their upstream font
projects. They are served only from this repository at runtime; the browser does
not request a font CDN. Each family is licensed under the SIL Open Font License
1.1, and the corresponding upstream `OFL.txt` is retained beside the bundled
files.

## Fonts

| Bundled file | Fixed role | Source repository and pinned commit | Upstream path | SHA-256 |
| --- | --- | --- | --- | --- |
| `PixelifySans-Bold.woff2` | Pixelify Sans Bold display | [eifetx/Pixelify-Sans](https://github.com/eifetx/Pixelify-Sans) at `39df74aba80df8157546034b878e8be1eb565ced` | `fonts/webfonts/PixelifySans-Bold.woff2` | `2cfe309fa95c695dae8069760f62b48fb457874e8d101bf822bf30ebad06c504` |
| `Silkscreen-Regular.woff2` | Silkscreen Regular interface labels | [googlefonts/silkscreen](https://github.com/googlefonts/silkscreen) at `206ccf3f5234c281461e63ecc59cbc6b0563472b` | `fonts/webfonts/Silkscreen-Regular.woff2` | `a8509db65e47b89daa545d8c9e0b4ffaf0e153fa19d754ec9d4a3a13878d77a9` |
| `Silkscreen-Bold.woff2` | Silkscreen Bold interface labels | [googlefonts/silkscreen](https://github.com/googlefonts/silkscreen) at `206ccf3f5234c281461e63ecc59cbc6b0563472b` | `fonts/webfonts/Silkscreen-Bold.woff2` | `eb1e8471d5e81886e7bd12ea8bcd2564d27f3e3dddb7820a25c034b5afd7bf4e` |
| `KodeMono-Regular.woff2` | Kode Mono Regular body copy | [isaozler/kode-mono](https://github.com/isaozler/kode-mono) at `2d427d3f44649656d2c1932bb671d0c4cd064041` | `fonts/webfonts/KodeMono-Regular.woff2` | `fae2658fd572bed1adf796b2f284b7ee3e0448fd093a5436bfb39d45098de03f` |
| `KodeMono-Medium.woff2` | Kode Mono Medium body copy | [isaozler/kode-mono](https://github.com/isaozler/kode-mono) at `2d427d3f44649656d2c1932bb671d0c4cd064041` | `fonts/webfonts/KodeMono-Medium.woff2` | `2e9fd63d9c93f37ef128212291d310f9ddea9e6451b7e8f6dc03ffbac132f460` |

License files:

- `fonts/PixelifySans-OFL.txt` — [upstream license](https://github.com/eifetx/Pixelify-Sans/blob/39df74aba80df8157546034b878e8be1eb565ced/OFL.txt)
- `fonts/Silkscreen-OFL.txt` — [upstream license](https://github.com/googlefonts/silkscreen/blob/206ccf3f5234c281461e63ecc59cbc6b0563472b/OFL.txt)
- `fonts/KodeMono-OFL.txt` — [upstream license](https://github.com/isaozler/kode-mono/blob/2d427d3f44649656d2c1932bb671d0c4cd064041/OFL.txt)

All bundled font files above are licensed under SIL Open Font License 1.1.

## Icons and faction sigils

`icons/records.svg`, `icons/history.svg`, `icons/codex.svg`,
`icons/dispatches.svg`, `icons/sunweaver-sigil.svg`, and
`icons/gravemark-sigil.svg` are authored for Starhaven in this repository. They
use integer-grid geometry and have no external asset dependency or license.
