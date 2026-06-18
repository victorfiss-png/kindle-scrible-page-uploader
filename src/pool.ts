
type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

type Job = {
    id: string;
    status: JobStatus;
    progress: number;
};

type JobTask = (update: (p: number) => void) => Promise<void>;

type Listener = (jobsArray: Job[]) => void;

class JobManager {
    jobs: Map<string, Job> = new Map();
    private listeners: Set<Listener> = new Set();

    private queue: Array<{ id: string; task: JobTask }> = [];
    private running = 0;
    private concurrency: number;
    private unloaded = false;

    constructor(concurrency = 1) {
        this.concurrency = concurrency;
    }

    // Subscribe to all job state changes. Returns an unsubscribe function.
    subscribe(listener: Listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private broadcast() {
        const jobsArray = Array.from(this.jobs.values());
        this.listeners.forEach(listener => listener(jobsArray));
    }

    async addJob(id: string, task: JobTask) {
        if (this.unloaded) return;

        // Overwrite any previous terminal state so the button re-enables after failure.
        const newJob: Job = { id, status: 'queued', progress: 0 };
        this.jobs.set(id, newJob);
        this.broadcast();

        this.queue.push({ id, task });
        this.drain();
    }

    private drain() {
        while (this.running < this.concurrency && this.queue.length > 0 && !this.unloaded) {
            const next = this.queue.shift()!;
            this.running++;
            void this.runJob(next.id, next.task).finally(() => {
                this.running--;
                this.drain();
            });
        }
    }

    private async runJob(id: string, task: JobTask) {
        this.updateJob(id, { status: 'running' });

        try {
            await task((percent) => {
                this.updateJob(id, { progress: Math.round(percent) });
            });
            this.updateJob(id, { status: 'completed', progress: 100 });
        } catch (e) {
            console.error(`[JobManager] Job ${id} failed:`, e);
            this.updateJob(id, { status: 'failed' });
        }
    }

    private updateJob(id: string, updates: Partial<Job>) {
        const job = this.jobs.get(id);
        if (job) {
            this.jobs.set(id, { ...job, ...updates });
            this.broadcast();
        }
    }

    /** Call from plugin onunload() to stop accepting new work. In-flight jobs finish naturally. */
    onUnload() {
        this.unloaded = true;
        this.queue = [];
    }
}

export const jobManager = new JobManager(1);