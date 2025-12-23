
import React, { useState, useRef, useEffect } from 'react';
import { uploadBusinessCard, type OCRResult } from '../services/ocrService';

// Simple logger
const log = (...args: any[]) => console.log('[OCR Modal]', ...args);

interface BusinessCardUploadModalProps {
    onClose: () => void;
}

// Inline styles for consistency with existing components
const styles = {
    overlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column' as const
    },
    header: {
        background: '#336179',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    },

    body: {
        padding: '24px',
        overflowY: 'auto' as const,
        flex: 1
    },
    footer: {
        padding: '16px 24px',
        backgroundColor: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'center',
        gap: '12px'
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px'
    },
    inputGroup: {
        marginBottom: '16px'
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box' as const
    },
    label: {
        display: 'block',
        fontSize: '13px',
        fontWeight: 600,
        color: '#4b5563',
        marginBottom: '6px'
    },
    dropzone: {
        border: '2px dashed #d1d5db',
        borderRadius: '8px',
        padding: '32px',
        textAlign: 'center' as const,
        cursor: 'pointer',
        transition: 'border-color 0.2s, background-color 0.2s',
        backgroundColor: '#f9fafb',
        marginBottom: '20px'
    },
    uploadBtn: {
        padding: '10px 20px',
        background: 'white',
        color: '#336179',
        border: '1px solid #336179',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        margin: '10px 0'
    },
    actionBtn: {
        padding: '10px 20px',
        background: '#336179',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    cancelBtn: {
        padding: '10px 20px',
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '14px',
        cursor: 'pointer'
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.8)',
        cursor: 'pointer',
        padding: '4px'
    }
};

export const BusinessCardUploadModal = ({ onClose, isStandalone = false }: BusinessCardUploadModalProps & { isStandalone?: boolean }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<OCRResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Jokes state for loading
    const [currentJokeIndex, setCurrentJokeIndex] = useState(0);
    const jokes = [
        "正在用力看這張名片...字有點小... 🧐",
        "為什麼業務員喜歡雨天？\n因為客戶都在家。 ☔️",
        "正在將紙本名片轉化為數位商機... 🔄",
        "別擔心，AI 不會搶走您的工作，但會用 AI 的人可能會喔！ 🤖",
        "CRM 系統就像健身房會員卡，買了不代表你會變壯，你得去用它！ 💪",
        "成功的業務員從不等待機會，而是創造機會！ ✨"
    ];

    // Cycle jokes when loading
    useEffect(() => {
        let interval: any;
        if (isAnalyzing) {
            setCurrentJokeIndex(0);
            interval = setInterval(() => {
                setCurrentJokeIndex(prev => (prev + 1) % jokes.length);
            }, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isAnalyzing]);

    const processFile = (selectedFile: File) => {
        setFile(selectedFile);
        setError(null);

        // Create preview if it's an image
        if (selectedFile.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => setPreview(reader.result as string);
            reader.readAsDataURL(selectedFile);
        } else {
            setPreview(null);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;

        setIsAnalyzing(true);
        setError(null);

        try {
            const response = await uploadBusinessCard(file);
            if (response.success && response.data) {
                setResult(response.data);
            } else {
                setError(response.error || '無法辨識名片，請重試。');
            }
        } catch (e) {
            setError('發生錯誤: ' + String(e));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleCreateRecords = async () => {
        if (!result || !file) {
            log('handleCreateRecords aborted: result or file missing', { result: !!result, file: !!file });
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        log('Starting createRecord process...');

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = async () => {
                try {
                    const resultStr = reader.result as string;
                    if (!resultStr) throw new Error('File reading failed: Empty result');
                    const base64Content = resultStr.split(',')[1];

                    log('File read success, sending to NetSuite...', { fileName: file.name });

                    const payload = {
                        action: 'createRecord',
                        ocrData: result,
                        fileName: file.name,
                        fileType: file.type,
                        fileContent: base64Content
                    };

                    const context = (window as any).NETSUITE_CONTEXT;
                    if (!context) throw new Error('NETSUITE_CONTEXT not found');

                    const url = context.ocrSuiteletUrl;
                    if (!url) throw new Error('OCR Suitelet URL not found');

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    log('Response received', response.status);

                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                    }

                    const json = await response.json();
                    log('Response JSON:', json);

                    if (json.success) {
                        const { customerId, contactId, isNewCustomer, fileError, debugFolderId } = json.data;
                        let msg = isNewCustomer
                            ? `成功建立新客戶 (ID: ${customerId}) 與聯絡人 (ID: ${contactId})`
                            : `成功於現有客戶 (ID: ${customerId}) 下新增聯絡人 (ID: ${contactId})`;

                        if (fileError) {
                            msg += `\n\n⚠️ 注意：名片圖檔儲存失敗！\n錯誤訊息: ${fileError}\n嘗試寫入 Folder ID: ${debugFolderId}`;
                        } else {
                            msg += `\n\n✅ 名片圖檔已儲存 (Folder: ${debugFolderId})`;
                        }

                        alert(msg);

                        // Redirect to the new Contact Record
                        const contactUrl = `/app/common/entity/contact.nl?id=${contactId}`;
                        window.location.href = contactUrl;
                    } else {
                        setError('建立失敗: ' + (json.error || 'Unknown error'));
                    }
                } catch (innerError) {
                    console.error('Inner logic error:', innerError);
                    setError('建立失敗: ' + String(innerError));
                } finally {
                    setIsAnalyzing(false);
                }
            };

            reader.onerror = () => {
                console.error('Reader OnError');
                setError('檔案讀取失敗');
                setIsAnalyzing(false);
            };

        } catch (e) {
            console.error('Outer handler error:', e);
            setError('提交錯誤: ' + String(e));
            setIsAnalyzing(false);
        }
    };

    // Helper to render input fields
    const renderField = (label: string, value: string, key: keyof OCRResult) => (
        <div style={styles.inputGroup}>
            <label style={styles.label}>{label}</label>
            <input
                style={styles.input}
                value={value}
                onChange={(e) => setResult(prev => prev ? { ...prev, [key]: e.target.value } : null)}
            />
        </div>
    );

    // Dynamic Styles for Standalone Mode
    const containerStyle = isStandalone ? {
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        padding: '40px 20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start'
    } : styles.overlay;

    const modalStyle = isStandalone ? {
        ...styles.modal,
        maxWidth: '1200px',
        height: '85vh', // Fixed height for scrolling
        maxHeight: 'none',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    } : styles.modal;

    return (
        <div style={containerStyle} onClick={!isStandalone ? onClose : undefined}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'white' }}>
                                名片 OCR 辨識
                            </h2>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                                上傳名片以自動建立客戶與聯絡人資料
                            </p>
                        </div>
                    </div>
                    {!isStandalone && (
                        <button style={styles.closeBtn} onClick={onClose}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Body */}
                <div style={styles.body}>
                    {error && (
                        <div style={{ padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', marginBottom: '16px', fontSize: '14px' }}>
                            {error}
                        </div>
                    )}

                    {!result ? (
                        /* Upload State */
                        <>
                            <div
                                style={styles.dropzone}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                        processFile(e.dataTransfer.files[0]);
                                    }
                                }}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*,application/pdf"
                                    onChange={handleFileSelect}
                                />
                                {preview ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <img src={preview} alt="Preview" style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '8px', marginBottom: '10px' }} />
                                        <div style={{ fontSize: '14px', color: '#4b5563' }}>{file?.name}</div>
                                        <button type="button" style={styles.uploadBtn}>更換圖片</button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '16px', color: '#cbd5e1' }}>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                                            </svg>
                                        </div>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#111827' }}>點擊或拖曳上傳名片</h3>
                                        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>支援 JPG, PNG, PDF 格式</p>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <button
                                    type="button"
                                    onClick={handleAnalyze}
                                    disabled={!file || isAnalyzing}
                                    style={{
                                        ...styles.actionBtn,
                                        width: '100%',
                                        justifyContent: 'center',
                                        opacity: (!file || isAnalyzing) ? 0.6 : 1,
                                        cursor: (!file || isAnalyzing) ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {isAnalyzing ? (
                                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <span>正在分析名片...</span>
                                            <span style={{ fontSize: '11px', fontWeight: 'normal', marginTop: '4px', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                                                {jokes[currentJokeIndex]}
                                            </span>
                                        </span>
                                    ) : '開始辨識'}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* Result State */
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', flexShrink: 0 }}>
                                <span style={{ color: '#1e40af', fontSize: '14px', fontWeight: 500 }}>辨識成功！請確認以下資訊</span>
                            </div>

                            <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
                                {/* Left Column: Image Preview */}
                                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                                    <div style={{
                                        backgroundColor: '#1f2937',
                                        borderRadius: '12px',
                                        padding: '12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: '300px'
                                    }}>
                                        {preview ? (
                                            <img src={preview} alt="Business Card" style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }} />
                                        ) : (
                                            <div style={{ color: '#9ca3af' }}>No Image</div>
                                        )}
                                    </div>

                                </div>

                                {/* Right Column: Form */}
                                <div style={{ flex: '1', overflowY: 'auto', paddingRight: '4px' }}>
                                    <div style={styles.grid}>
                                        {renderField('姓名', result.chineseName || result.firstName + ' ' + result.lastName, 'chineseName')}
                                        {renderField('英文姓名', result.englishName, 'englishName')}
                                        {renderField('公司名稱', result.company, 'company')}
                                        {renderField('職稱', result.jobTitle, 'jobTitle')}
                                        {renderField('Email', result.email, 'email')}
                                        {renderField('手機', result.mobile, 'mobile')}
                                        {renderField('統編', result.unifiedBusinessNumber, 'unifiedBusinessNumber')}
                                        {renderField('網站', result.website, 'website')}
                                    </div>

                                    {renderField('地址', result.address, 'address')}

                                    <div style={styles.inputGroup}>
                                        <label style={styles.label}>備註</label>
                                        <textarea
                                            style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                                            value={result.notes}
                                            onChange={(e) => setResult({ ...result, notes: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <button
                        type="button"
                        style={{ ...styles.cancelBtn, flex: 1, justifyContent: 'center' }}
                        onClick={() => {
                            if (result) {
                                setResult(null);
                                setError(null);
                            } else {
                                onClose();
                            }
                        }}
                    >
                        {result ? '重新上傳' : '取消'}
                    </button>

                    {result && (
                        <button
                            type="button"
                            style={{
                                ...styles.actionBtn,
                                flex: 1,
                                justifyContent: 'center',
                                opacity: isAnalyzing ? 0.7 : 1,
                                cursor: isAnalyzing ? 'not-allowed' : 'pointer'
                            }}
                            onClick={handleCreateRecords}
                            disabled={isAnalyzing}
                        >
                            {isAnalyzing ? (
                                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span>處理中...</span>
                                    <span style={{ fontSize: '11px', fontWeight: 'normal', marginTop: '4px', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                                        {jokes[currentJokeIndex]}
                                    </span>
                                </span>
                            ) : '建立客戶與聯絡人'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
