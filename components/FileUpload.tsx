import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { processRawDataAsync } from '../utils/dataProcessor';

interface FileUploadProps {
    onFileUpload?: (data: any[][]) => Promise<void> | void;
    onParsedData?: (data: any) => Promise<void> | void;
    onProgress?: (percent: number, message: string) => void;
    onError: (message: string) => void;
    setIsLoading: (loading: boolean) => void;
    customClass?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
    onFileUpload, 
    onParsedData, 
    onProgress, 
    onError, 
    setIsLoading, 
    customClass 
}) => {
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setIsLoading(true);
        if (onProgress) onProgress(5, `Reading ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);

        try {
            const arrayBuffer = await file.arrayBuffer();

            // Try running in Web Worker for maximum responsiveness and 0-freeze memory efficiency
            if (typeof Worker !== 'undefined' && onParsedData) {
                try {
                    const worker = new Worker(new URL('../workers/excelWorker.ts', import.meta.url), { type: 'module' });

                    worker.onmessage = async (e: MessageEvent) => {
                        const { type, percent, message, data, error } = e.data;
                        if (type === 'progress') {
                            if (onProgress) onProgress(percent, message);
                        } else if (type === 'success') {
                            worker.terminate();
                            await onParsedData(data);
                        } else if (type === 'error') {
                            worker.terminate();
                            throw new Error(error || 'Worker parsing error');
                        }
                    };

                    worker.onerror = async (err) => {
                        console.warn('Worker execution failed, falling back to main-thread processing:', err);
                        worker.terminate();
                        await fallbackProcess(arrayBuffer);
                    };

                    // Transfer the ArrayBuffer with zero-copy overhead
                    worker.postMessage({ fileBuffer: arrayBuffer }, [arrayBuffer]);
                    event.target.value = '';
                    return;
                } catch (workerInitErr) {
                    console.warn('Could not initialize Worker, using fallback:', workerInitErr);
                    await fallbackProcess(arrayBuffer);
                    event.target.value = '';
                    return;
                }
            } else {
                await fallbackProcess(arrayBuffer);
            }
        } catch (err: any) {
            console.error('File reading error:', err);
            onError(err instanceof Error ? err.message : 'Failed to read file.');
            setIsLoading(false);
        }

        event.target.value = '';
    };

    const fallbackProcess = async (arrayBuffer: ArrayBuffer) => {
        try {
            if (onProgress) onProgress(15, 'Reading workbook data...');
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true, dense: true });
            const targetSheetName = workbook.SheetNames.find(s => s.trim().toUpperCase() === 'CONTAINERS') || workbook.SheetNames[0];
            const worksheet = workbook.Sheets[targetSheetName];

            if (onProgress) onProgress(35, 'Extracting spreadsheet rows...');
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' }) as any[][];

            if (onParsedData) {
                const processed = await processRawDataAsync(jsonData, onProgress);
                await onParsedData(processed);
            } else if (onFileUpload) {
                await onFileUpload(jsonData);
            }
        } catch (err: any) {
            console.error('Fallback error:', err);
            onError(err instanceof Error ? err.message : 'Failed to process spreadsheet.');
            setIsLoading(false);
        }
    };

    return (
        <>
            <label htmlFor="fileInput" className={customClass || "inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm cursor-pointer hover:bg-indigo-700 transition-colors"}>
                <span className="material-icons mr-2">upload_file</span>
                {fileName ? 'Re-upload Excel File' : 'Upload Excel File'}
            </label>
            <input 
                type="file" 
                id="fileInput" 
                className="hidden" 
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
            />
        </>
    );
};

export default FileUpload;
