
export interface OCRResult {
    lastName: string;
    firstName: string;
    chineseName: string;
    englishName: string;
    company: string;
    jobTitle: string;
    unifiedBusinessNumber: string;
    email: string;
    mobile: string;
    website: string;
    address: string;
    notes: string;
}

export interface OCRResponse {
    success: boolean;
    data?: OCRResult;
    error?: string;
}

const getOCRSuiteletUrl = (): string | null => {
    return (window as any).NETSUITE_CONTEXT?.ocrSuiteletUrl || null;
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove data URL prefix (e.g. "data:image/png;base64,")
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

export const uploadBusinessCard = async (file: File): Promise<OCRResponse> => {
    const url = getOCRSuiteletUrl();

    // For local development or if URL not set
    if (!url || url.includes('placeholder')) {
        console.warn('OCR Suitelet URL not found, using mock.');
        // Mock response for testing
        return new Promise(resolve => setTimeout(() => resolve({
            success: true,
            data: {
                lastName: "Wang",
                firstName: "Ming-You",
                chineseName: "王明右",
                englishName: "Ming-You Wang",
                company: "OODA Technologies",
                jobTitle: "Senior Engineer",
                unifiedBusinessNumber: "12345678",
                email: "ming@ooda.com",
                mobile: "0912345678",
                website: "www.ooda.com",
                address: "Taipei, Taiwan",
                notes: "Met at conference"
            }
        }), 1500));
    }

    try {
        const base64Content = await fileToBase64(file);

        const payload = {
            action: 'analyzeCard',
            fileName: file.name,
            fileType: file.type,
            fileContent: base64Content
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const json = await response.json();
        return json;

    } catch (error) {
        console.error('OCR Upload Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
};
