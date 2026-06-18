import { OpenRouter } from '@openrouter/sdk';
import { Notice, normalizePath, TFile, App } from 'obsidian';

interface NotebookAnalysis {
    text: string;
    crops: Array<{ id: string; box_2d: [number, number, number, number] }>;
}

async function analyzeNotebookPage(
    imgBase64: string,
    apiKey: string,
    modelId: string,
    maxRetries: number = 3
): Promise<NotebookAnalysis> {
    const openRouter = new OpenRouter({
        apiKey
    });
    const prompt = `
    Analyze this notebook page.
    1. Transcribe all handwritten text into clean Markdown.
    2. Identify any distinct sketches, diagrams, or charts.
    3. Return a JSON object with:
       - "text": The markdown text. Do NOT describe the images in the text, just place a placeholder like {{IMG_1}} where the sketch fits.
       - "crops": A list of bounding boxes for sketches: [ymin, xmin, ymax, xmax] (scale 0-1000).
    
    Example Output:
    {
      "text": "# Header\\n\\nSome notes here.\\n\\n{{IMG_1}}\\n\\nMore text.",
      "crops": [{"id": "IMG_1", "box_2d": [150, 100, 500, 900]}]
    }
    `;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await openRouter.chat.send({
                chatGenerationParams: {
                    model: modelId,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                {
                                    type: "image_url",
                                    imageUrl: { url: `data:image/png;base64,${imgBase64}` }
                                }
                            ]
                        }
                    ],
                    temperature: 0.3,
                    responseFormat: { type: "json_object" }
                }
            });

            if (response.choices[0] !== undefined) {
                const content = response.choices[0].message.content as string;
                //todo: add validation
                return JSON.parse(content) as NotebookAnalysis;
            }

        } catch (error) {
            console.error("Analysis failed:", error);
            if (attempt === maxRetries - 1) throw error;
            // Short backoff for network timeouts
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    throw new Error("Max retries reached");
}

/**
 * Main Coordinator: Processes a list of images, performs OCR/Analysis,
 * crops out sketches, and saves a final Markdown file.
 */
export async function processNotebookPages(
    app: App,
    imageB64List: string[],
    folderPath: string,
    fileName: string,
    apiKey: string,
    modelId: string
) {
    const dirPath = normalizePath(folderPath);
    const attachmentPath = normalizePath(`${dirPath}/attachments`);
    let fullMarkdown = "";

    if (!(await app.vault.adapter.exists(dirPath))) await app.vault.createFolder(dirPath);
    if (!(await app.vault.adapter.exists(attachmentPath))) await app.vault.createFolder(attachmentPath);

    const notice = new Notice(`Analizing pages`, 0);

    for (let i = 0; i < imageB64List.length; i++) {
        const imgBase64 = imageB64List[i];
        if (!imgBase64)
            continue;
        try {
            const analysis: NotebookAnalysis = await analyzeNotebookPage(imgBase64, apiKey, modelId);
            let pageText = analysis.text;
            notice.setMessage(`Analyzing ${i+1} out of ${imageB64List.length}`);
            for (const crop of analysis.crops) {
                const cropFileName = `${fileName}_pg${i + 1}_${crop.id}.png`;
                const cropPath = `${attachmentPath}/${cropFileName}`;
                const croppedBlob = await cropImage(imgBase64, crop.box_2d);

                await saveBinaryToVault(app, cropPath, await croppedBlob.arrayBuffer());

                const placeholder = `{{${crop.id}}}`;
                const obsidianLink = `![[${cropFileName}]]`;
                pageText = pageText.replace(placeholder, obsidianLink);
            }

            fullMarkdown += pageText.trim() + '\n'

        } catch (e) {
            new Notice(`Failed to process page ${i + 1}`);
            console.error(e);
        }
    }
    notice.hide();

    // 3. Save the final Markdown file
    const mdFilePath = normalizePath(`${dirPath}/${fileName}.md`);
    await saveTextToVault(app, mdFilePath, fullMarkdown.trim());
    new Notice(`Finished! Notes saved to ${mdFilePath}`);
}

async function cropImage(base64: string, box: [number, number, number, number]): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) return reject(new Error('Could not get canvas context'));

            // Convert 0-1000 scale to actual pixel dimensions
            const ymin = (box[0] / 1000) * img.height;
            const xmin = (box[1] / 1000) * img.width;
            const ymax = (box[2] / 1000) * img.height;
            const xmax = (box[3] / 1000) * img.width;

            const width = xmax - xmin;
            const height = ymax - ymin;

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, xmin, ymin, width, height, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas to Blob failed"));
            }, 'image/png');
        };
        img.src = `data:image/png;base64,${base64}`;
    });
}

async function saveBinaryToVault(app: App, path: string, data: ArrayBuffer) {
    const existingFile = app.vault.getAbstractFileByPath(path);
    if (existingFile instanceof TFile) {
        await app.vault.modifyBinary(existingFile, data);
    } else {
        await app.vault.createBinary(path, data);
    }
}

async function saveTextToVault(app: App, path: string, content: string) {
    const existingFile = app.vault.getAbstractFileByPath(path);
    if (existingFile instanceof TFile) {
        await app.vault.process(existingFile, () => content);
    } else {
        await app.vault.create(path, content);
    }
}
