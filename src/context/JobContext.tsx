import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export enum JobType {
    REGULAR,
    AI
}

export type JobStatus = {
    completedPercentage: number,
    jobType: JobType
}

interface JobContextType {
    updateJobStatus: (job: string, status: JobStatus) => void,
    finishJob: (job: string, type: JobType) => void,
    getJobStatus: (job: string) => JobStatus | undefined,
    addJob: (job: Job) => void,
}

const JobsContext = createContext<JobContextType | undefined>(undefined);

type Job = {job: string, jobFn: () => Promise<void>, jobStatus: JobStatus};

type JobList = Job[];

export const JobsContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [jobs, setJobs] = useState<JobList>([]);
    const [currentJob, setCurrentJob] = useState<string>();

    const addJob = (job: Job) => {
        setJobs(prev => [...prev, job])
    };

    useEffect(() => {
        if (!currentJob) {
            const job = jobs[0];
            if (job) {
                setCurrentJob(job.job);
                job.jobFn().then(() => {
                    setCurrentJob(undefined);
                    jobs.pop();
                }).catch(() => console.error('Job unexpectedly over'));
            }
        }
    }, [jobs, currentJob]);

    const findJob = (jobId: string, jobs: JobList) => {
        return jobs.find(job => job.job == jobId);
    };

    const getJobStatus = useCallback((jobId: string) => findJob(jobId, jobs)?.jobStatus, [jobs]);

    const finishJob = (jobId: string) => {
        setJobs(prev => {
            const job = findJob(jobId, prev);

            const copy = [...prev]
            if (job)
                copy.remove(job);
            return copy;
        });
    };

    const updateJobStatus = (jobId: string, jobStatus: JobStatus) => setJobs(prev => {
        const job = findJob(jobId, prev);

        const copy = [...prev]
        if (job) {
            copy.remove(job);
            return [...copy, { ...job, jobStatus }];
        }
        return [...copy];
    });

    return (
        <JobsContext.Provider value={{ getJobStatus, updateJobStatus, finishJob, addJob }}>
            {children}
        </JobsContext.Provider>
    );
};

export const useJobs = () => {
    const context = useContext(JobsContext);
    if (!context) {
        throw new Error('useJobs must be used within a JobsContextProvider');
    }
    return context;
};