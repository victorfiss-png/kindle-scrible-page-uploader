import React, { useEffect, useState } from "react";
import { FileData } from "types/Notebook";
import { useNotebook } from "../util/loadNotebookData";
import { jobManager } from "pool";
import { Bot, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useSettings } from "context/SettingsContext";
import { Tooltip } from "react-tooltip";

const RenderJobProgress = ({ percentage }: { percentage: number }) => {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return (
        <div style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
            {'█'.repeat(filled)}{'░'.repeat(empty)} {percentage}%
        </div>
    );
};

const PageSelector = ({ totalPages, selectedPages, onToggle, onSelectAll, onSelectNone }: {
    totalPages: number;
    selectedPages: Set<number>;
    onToggle: (page: number) => void;
    onSelectAll: () => void;
    onSelectNone: () => void;
}) => {
    const allSelected = selectedPages.size === totalPages;
    return (
        <div className="page-selector">
            <div className="page-selector-header">
                <span>{selectedPages.size} of {totalPages} pages selected</span>
                <button className="page-selector-btn" onClick={allSelected ? onSelectNone : onSelectAll}>
                    {allSelected ? 'None' : 'All'}
                </button>
            </div>
            <div className="page-grid">
                {Array.from({ length: totalPages }, (_, i) => (
                    <button
                        key={i}
                        className={`page-chip ${selectedPages.has(i) ? 'page-chip-selected' : ''}`}
                        onClick={() => onToggle(i)}
                    >
                        {i + 1}
                    </button>
                ))}
            </div>
        </div>
    );
};

const Note = ({ file }: { file: FileData }) => {
    const [, setTick] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [totalPages, setTotalPages] = useState<number | null>(null);
    const [loadingMeta, setLoadingMeta] = useState(false);
    const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

    useEffect(() => {
        const unsub = jobManager.subscribe(() => setTick(t => t + 1));
        return () => { unsub(); };
    }, []);

    const { settings } = useSettings();

    const dlJob = jobManager.jobs.get(`${file.id}-dl`);
    const procJob = jobManager.jobs.get(`${file.id}-proc`);
    const activeJob = (dlJob && dlJob.status !== 'completed' && dlJob.status !== 'failed') ? dlJob
        : (procJob && procJob.status !== 'completed' && procJob.status !== 'failed') ? procJob
        : null;
    const { downloadOnly, downloadAndProcess, fetchMetadata } = useNotebook(file.id, file.title);

    const handleExpand = async () => {
        if (expanded) {
            setExpanded(false);
            return;
        }
        if (totalPages === null && !loadingMeta) {
            setLoadingMeta(true);
            try {
                const pages = await fetchMetadata();
                setTotalPages(pages);
                setSelectedPages(new Set(Array.from({ length: pages }, (_, i) => i)));
            } catch {
                setTotalPages(0);
            } finally {
                setLoadingMeta(false);
            }
        }
        setExpanded(true);
    };

    const togglePage = (page: number) => {
        setSelectedPages(prev => {
            const next = new Set(prev);
            if (next.has(page)) next.delete(page);
            else next.add(page);
            return next;
        });
    };

    const hasSelection = selectedPages.size > 0;
    const isPartialSelection = totalPages !== null && selectedPages.size < totalPages && selectedPages.size > 0;

    return (
        <div className="note-container">
            <div className="file-row">
                <div className="note-title" onClick={() => void handleExpand()}>
                    {loadingMeta ? '…' : expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {' '}{file.title}
                    {totalPages !== null && <span className="page-count">({totalPages} pg)</span>}
                </div>
                {!settings.openRouterKey && <Tooltip id="ai-download-tooltip" place="top">No OpenRouter API key configured. Go to Settings → Kindle Scribe Notes to add one.</Tooltip>}
                {activeJob
                    ? <RenderJobProgress percentage={activeJob.progress} />
                    : <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            disabled={expanded && !hasSelection}
                            onClick={() => downloadOnly(isPartialSelection ? selectedPages : undefined)}
                        >
                            <Download size={16} />
                            {isPartialSelection && <span className="sel-badge">{selectedPages.size}</span>}
                        </button>
                        or
                        <button
                            disabled={!settings.openRouterKey || (expanded && !hasSelection)}
                            onClick={() => downloadAndProcess(isPartialSelection ? selectedPages : undefined)}
                            data-tooltip-id="ai-download-tooltip"
                        >
                            <Download size={16} /> + <Bot size={16} />
                            {isPartialSelection && <span className="sel-badge">{selectedPages.size}</span>}
                        </button>
                    </div>
                }
            </div>
            {expanded && totalPages !== null && totalPages > 0 && (
                <PageSelector
                    totalPages={totalPages}
                    selectedPages={selectedPages}
                    onToggle={togglePage}
                    onSelectAll={() => setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i)))}
                    onSelectNone={() => setSelectedPages(new Set())}
                />
            )}
        </div>
    );
}

export const NotesList = ({ objects }: { objects: FileData[] }) => {
    const renderFolder = (folder: FileData) => {
        return <details className="file-row" style={{ marginRight: 0}}>
            <summary>{folder.title}</summary>
            <NotesList objects={folder.items} />
        </details>;
    }
    return <div>
        {objects.map(file => {
            if (file.type == 'folder')
                return renderFolder(file);
            return <Note key={file.id} file={file} />
        })}
    </div>
};
