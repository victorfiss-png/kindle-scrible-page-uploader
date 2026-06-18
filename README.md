# Kindle Scribe Page Uploader
## Obsidian plugin with page selection and OpenRouter support

Download selected pages from your Kindle Scribe notebooks into your Obsidian Vault.

> [!NOTE]
> Fork of [obsidian-kindle-scribe-notes-sync-plugin](https://github.com/k4rnaj1k/obsidian-kindle-scribe-notes-sync-plugin) by k4rnaj1k, with added page selection support.

Current functionality:
- [x] pulling notes from root folder
- [x] pulling notes from subfolders
- [x] **select individual pages** before downloading
- [x] download selected pages as PDF
- [x] notes OCR via OpenRouter API
- [x] separate download and AI processing flows

# Instructions

> [!NOTE]
> This plugin is only available on Desktop. This plugin uses unofficial Amazon API and might break. For notes processing - an OpenRouter key is needed. (But downloading of notes as PDF is **available without a key**.)

## Install via [BRAT plugin](https://tfthacker.com/BRAT)

1. Install the BRAT plugin in Obsidian
2. In BRAT settings, click "Add Beta plugin"
3. Enter: `victorfiss-png/kindle-scrible-page-uploader`

## To Download notes:
1. Install this plugin via BRAT into your Obsidian
1. Click the notepad icon on the left sidebar
1. Login via modal and see your notebooks list
1. Click a notebook title to expand and see the page selector
1. Select the pages you want (all selected by default)
1. Click the download button to save as PDF

## To Process notes via AI models:
1. Install plugin
1. Go to Obsidian settings (cog in bottom left of screen)
1. Select Kindle Scribe Page Uploader from plugins list
1. Insert your OpenRouter API key `it is something like "sk-or-v1..."`
1. Open the modal, expand a notebook, select pages, and click Download+Process

### Page Selection

Click any notebook title to expand it and see a grid of page numbers. Toggle individual pages on/off, or use the All/None button. The download buttons show a badge with the count when only some pages are selected. If you don't expand the notebook, clicking download will fetch all pages (same as before).

### Some information regarding OpenRouter/downloads

Bigger notebooks might take a while to download and process. The progress bar shows download status.

`google/gemini-3.1-flash-lite-preview` seems to be the best model at the moment in terms of price-performance. There is a way of changing models in settings in case you want to try out other models.

Downloads are done sequentially to avoid triggering Amazon rate limits. This uses APIs that are under the hood of notebook preview in their apps/web.

## License

[MIT](LICENSE)
