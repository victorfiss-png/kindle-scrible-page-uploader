import { FileData } from 'types/Notebook';
import { getAmazonApi } from '../util/amazonApiUtils';


const getNotesData = async (): Promise<FileData[]> => {
    const result = await getAmazonApi<{ itemsList: FileData[] }>('https://read.amazon.com/kindle-notebook/api/notes');
    return result.itemsList;
}

export const notesService = {
    getNotesData
}