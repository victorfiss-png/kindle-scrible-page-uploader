import { remote } from "electron";
import { requestUrl } from "obsidian";

export const getAmazonCookies = async (): Promise<string> => {
    const ses = remote.session.defaultSession;

    const cookies = await ses.cookies.get({ domain: '.amazon.com' });

    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
};

export const getChunk = async (endpointUrl: string, renderingToken: string): Promise<ArrayBuffer> => {
    const result = await requestUrl({
        url: endpointUrl,
        headers: {
            Cookie: await getAmazonCookies(),
            "x-amzn-karamel-notebook-rendering-token": renderingToken
        }
    })
    return result.arrayBuffer;
};

export const getAmazonApi = async <T extends object>(endpointUrl: string, headers?: object): Promise<T> => {
    const result = await requestUrl({
        url: endpointUrl,
        headers: {
            Cookie: await getAmazonCookies(),
            ...headers
        }
    })
    return await result.json as T;
};

export const noAmazonCookies = async ():Promise<boolean> => {
    const ses = remote.session.defaultSession;

    const cookies = await ses.cookies.get({ domain: '.amazon.com' });
    return cookies.length == 0;
};