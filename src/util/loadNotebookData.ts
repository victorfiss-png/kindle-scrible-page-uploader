import { App, arrayBufferToBase64, Notice } from "obsidian";
import { convertTarToPdf, exportImagesFromTar } from "./saveToPdf";
import { processNotebookPages } from "services/OpenRouterService";
import { getAmazonApi, getChunk } from "./amazonApiUtils";
import { useSettings } from "context/SettingsContext";
import { useCallback } from "react";
import { jobManager } from "pool";

type Metadata = {
    "metadata": { "currentPage": number, "modificationTime": number, "title": string, "totalPages": number },
    "readingSessionId": string, "renderingToken": string
};
const NOTE_WIDTH = 620;
const NOTE_HEIGHT = 877;
type UseNotebook = {
    downloadOnly: (selectedPages?: Set<number>) => void;
    downloadAndProcess: (selectedPages?: Set<number>) => void;
    fetchMetadata: () => Promise<number>;
};

export async function fetchNotebookMetadata(fileId: string): Promise<{ totalPages: number; renderingToken: string }> {
    const { metadata, renderingToken } = await getAmazonApi<Metadata>(
        `https://read.amazon.com/openNotebook?notebookId=${fileId}&marketplaceId=ATVPDKIKX0DER`
    );
    return { totalPages: metadata.totalPages, renderingToken };
}

async function fetchPages(
    app: App,
    fileId: string,
    noteName: string,
    update: (p: number) => void,
    selectedPages?: Set<number>,
    pdfFolder = 'scribe notes'
): Promise<string[]> {
    update(0);

    const { totalPages, renderingToken } = await fetchNotebookMetadata(fileId);

    const notice = new Notice(`Starting fetching pages for ${noteName}`);
    const pagesData: ArrayBuffer[] = [];
    const fetchAll = !selectedPages || selectedPages.size === 0;

    // Build fetch ranges — groups of up to 3 pages (matching API chunk size).
    // For selected pages, we batch nearby pages into a single range even if
    // there are unselected gaps, since the API returns up to 3 pages per call.
    const sorted = fetchAll
        ? Array.from({ length: totalPages }, (_, i) => i)
        : Array.from(selectedPages).sort((a, b) => a - b);

    const ranges: [number, number][] = [];
    for (let i = 0; i < sorted.length;) {
        const start = sorted[i]!;
        let end = start;
        // Extend the range as long as the next selected page fits within
        // a 3-page window from start
        while (i + 1 < sorted.length && sorted[i + 1]! - start <= 2) {
            end = sorted[++i]!;
        }
        ranges.push([start, end]);
        i++;
    }

    const fetchedPageIndices: number[] = [];
    let fetched = 0;

    for (const [start, end] of ranges) {
        const count = end - start + 1;
        notice.setMessage(`Fetching pages ${start + 1}-${end + 1} of ${totalPages}`);
        const chunk = await getChunk(
            `https://read.amazon.com/renderPage?startPage=${start}&endPage=${end}&width=${NOTE_WIDTH}&height=${NOTE_HEIGHT}&dpi=50`,
            renderingToken
        );
        pagesData.push(chunk);
        for (let p = start; p <= end; p++) fetchedPageIndices.push(p);
        fetched += count;
        update((fetched / sorted.length) * 50);
    }

    notice.hide();
    const allImages = await exportImagesFromTar(pagesData.map(page => page.slice(0)));

    // When ranges include pages not in the selection (gap-filling), filter them out
    const images = fetchAll
        ? allImages
        : allImages.filter((_, i) => {
            const pageIdx = fetchedPageIndices[i];
            return pageIdx !== undefined && selectedPages!.has(pageIdx);
        });

    await convertTarToPdf(app, pagesData, noteName, pdfFolder);
    update(50);

    return images.map(image => arrayBufferToBase64(image.data.buffer as ArrayBuffer));
}

export const useNotebook = (fileId: string, noteName: string): UseNotebook => {
    const { app, settings } = useSettings();

    const downloadOnlyTask = useCallback(async (update: (p: number) => void, selectedPages?: Set<number>) => {
        await fetchPages(app, fileId, noteName, update, selectedPages);
        update(100);
        new Notice(`Downloaded "${noteName}" — PDF saved.`);
    }, [app, fileId, noteName]);

    const downloadAndProcessTask = useCallback(async (update: (p: number) => void, selectedPages?: Set<number>) => {
        const { openRouterKey, model } = settings;
        const folder = 'scribe notes/' + noteName;

        const images = await fetchPages(app, fileId, noteName, update, selectedPages, folder);
        await processNotebookPages(
            app,
            images,
            folder,
            noteName,
            openRouterKey,
            model
        );
        update(100);
        new Notice(`Note "${noteName}" downloaded and processed.`);
    }, [app, fileId, noteName, settings]);

    const fetchMeta = useCallback(async () => {
        const { totalPages } = await fetchNotebookMetadata(fileId);
        return totalPages;
    }, [fileId]);

    return {
        downloadOnly: (selectedPages) =>
            void jobManager.addJob(`${fileId}-dl`, (update) => downloadOnlyTask(update, selectedPages)),
        downloadAndProcess: (selectedPages) =>
            void jobManager.addJob(`${fileId}-proc`, (update) => downloadAndProcessTask(update, selectedPages)),
        fetchMetadata: fetchMeta,
    };
}
