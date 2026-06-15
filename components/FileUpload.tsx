
import React from 'react';
import * as XLSX from 'xlsx';

interface FileUploadProps {
    onFileUpload: (data: any[][]) => void;
    onError: (message: string) => void;
    setIsLoading: (loading: boolean) => void;
    customClass?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, onError, setIsLoading, customClass }) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setIsLoading(true);
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const targetSheetName = workbook.SheetNames.find(s => s.trim().toUpperCase() === 'CONTAINERS') || workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[targetSheetName];
                    // Fixed: cast to any[][] because sheet_to_json with header: 1 returns a 2D array
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as any[][];
                    onFileUpload(jsonData);
                } catch (err) {
                    console.error(err);
                    onError(err instanceof Error ? err.message : 'Failed to parse the Excel file.');
                }
            };
            reader.onerror = () => {
                onError('Failed to read the file.');
                setIsLoading(false);
            };
            reader.readAsArrayBuffer(file);
        }
        // Reset file input to allow re-uploading the same file
        event.target.value = '';
    };

    return (
        <>
            <label htmlFor="fileInput" className={customClass || "inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm cursor-pointer hover:bg-indigo-700 transition-colors"}>
                <span className="material-icons mr-2">upload_file</span>
                Upload Excel File
            </label>
            <input 
                type="file" 
                id="fileInput" 
                className="hidden" 
                accept=".xlsx, .xls"
                onChange={handleFileChange}
            />
        </>
    );
};

export default FileUpload;
