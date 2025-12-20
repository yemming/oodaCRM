import { useState, useEffect } from 'react';
import { savePainSheet as savePainSheetApi, fetchPainSheet } from '../services/api';

interface PainSheetRow {
    id: string;
    reason: string;      // 原因
    impact: string;      // 影響
    capability: string;  // 能力
}

interface PainSheetData {
    pain: string;           // 痛苦
    positionIndustry: string; // 職位與行業
    productsServices: string; // 產品與服務
    rows: PainSheetRow[];
}

interface PainSheetProps {
    opportunityId: string;
    contactId: string;
    contactName: string;
    contactTitle: string;
    onClose: () => void;
    onSave?: (data: PainSheetData) => void;
}

const DEFAULT_ROWS: PainSheetRow[] = [
    { id: 'A', reason: '', impact: '', capability: '' },
    { id: 'B', reason: '', impact: '', capability: '' },
    { id: 'C', reason: '', impact: '', capability: '' },
    { id: 'D', reason: '', impact: '', capability: '' },
];

export function PainSheet({ opportunityId, contactId, contactName, contactTitle, onClose, onSave }: PainSheetProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<PainSheetData>({
        pain: '',
        positionIndustry: contactTitle || '',
        productsServices: '',
        rows: DEFAULT_ROWS.map(r => ({ ...r })),
    });

    // Load existing pain sheet data on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const result = await fetchPainSheet(opportunityId, contactId);
                if (result.success && result.painSheet) {
                    setData({
                        pain: result.painSheet.pain || '',
                        positionIndustry: result.painSheet.positionIndustry || contactTitle || '',
                        productsServices: result.painSheet.productsServices || '',
                        rows: result.painSheet.rows?.length > 0
                            ? result.painSheet.rows
                            : DEFAULT_ROWS.map(r => ({ ...r })),
                    });
                }
            } catch (err) {
                console.error('Error loading pain sheet:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [opportunityId, contactId, contactTitle]);

    const handleHeaderChange = (field: keyof Omit<PainSheetData, 'rows'>, value: string) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    const handleRowChange = (rowId: string, field: keyof Omit<PainSheetRow, 'id'>, value: string) => {
        setData(prev => ({
            ...prev,
            rows: prev.rows.map(row =>
                row.id === rowId ? { ...row, [field]: value } : row
            )
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await savePainSheetApi(opportunityId, contactId, data);
            if (result.success) {
                console.log('Pain Sheet saved successfully');
                if (onSave) {
                    onSave(data);
                }
                onClose();
            } else {
                console.error('Save failed:', result.error);
                alert('儲存失敗: ' + (result.error || '未知錯誤'));
            }
        } catch (err) {
            console.error('Error saving pain sheet:', err);
            alert('儲存失敗');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="pain-sheet-overlay" onClick={onClose}>
            <div className="pain-sheet-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="pain-sheet-header">
                    <h2 className="pain-sheet-title">
                        <span className="pain-sheet-icon">📋</span>
                        痛苦表 - {contactName}
                    </h2>
                    <button className="pain-sheet-close" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Info Section */}
                <div className="pain-sheet-info">
                    <div className="pain-sheet-info-row">
                        <label>痛苦：</label>
                        <input
                            type="text"
                            placeholder="描述主要痛點..."
                            value={data.pain}
                            onChange={e => handleHeaderChange('pain', e.target.value)}
                        />
                    </div>
                    <div className="pain-sheet-info-row">
                        <label>職位與行業：</label>
                        <input
                            type="text"
                            placeholder="例如：業務副總裁，製造業"
                            value={data.positionIndustry}
                            onChange={e => handleHeaderChange('positionIndustry', e.target.value)}
                        />
                    </div>
                    <div className="pain-sheet-info-row">
                        <label>我們的產品與服務：</label>
                        <input
                            type="text"
                            placeholder="例如：電子商務應用軟體"
                            value={data.productsServices}
                            onChange={e => handleHeaderChange('productsServices', e.target.value)}
                        />
                    </div>
                </div>

                {/* Pain Table */}
                <div className="pain-sheet-table-container">
                    <table className="pain-sheet-table">
                        <thead>
                            <tr>
                                <th className="pain-col-id"></th>
                                <th className="pain-col-reason">
                                    <div className="pain-col-header">原因</div>
                                    <div className="pain-col-subheader">這不是因為……？今天？</div>
                                </th>
                                <th className="pain-col-impact">
                                    <div className="pain-col-header">影響</div>
                                    <div className="pain-col-subheader">痛苦是否導致……？</div>
                                </th>
                                <th className="pain-col-capability">
                                    <div className="pain-col-header">能力</div>
                                    <div className="pain-col-subheader">如果……是否有幫助？</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map(row => (
                                <tr key={row.id}>
                                    <td className="pain-row-id">{row.id}.</td>
                                    <td>
                                        <textarea
                                            placeholder="輸入原因..."
                                            value={row.reason}
                                            onChange={e => handleRowChange(row.id, 'reason', e.target.value)}
                                            rows={3}
                                        />
                                    </td>
                                    <td>
                                        <textarea
                                            placeholder="輸入影響..."
                                            value={row.impact}
                                            onChange={e => handleRowChange(row.id, 'impact', e.target.value)}
                                            rows={3}
                                        />
                                    </td>
                                    <td>
                                        <textarea
                                            placeholder="輸入能力..."
                                            value={row.capability}
                                            onChange={e => handleRowChange(row.id, 'capability', e.target.value)}
                                            rows={3}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="pain-sheet-footer">
                    <button
                        className="pain-sheet-btn pain-sheet-btn-cancel"
                        onClick={onClose}
                        disabled={saving}
                    >
                        取消
                    </button>
                    <button
                        className="pain-sheet-btn pain-sheet-btn-save"
                        onClick={handleSave}
                        disabled={loading || saving}
                    >
                        {saving ? '儲存中...' : '儲存'}
                    </button>
                </div>

                <style>{`
                    .pain-sheet-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.6);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10000;
                    }

                    .pain-sheet-modal {
                        background: white;
                        border-radius: 12px;
                        width: 90%;
                        max-width: 900px;
                        max-height: 90vh;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    }

                    .pain-sheet-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 16px 24px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }

                    .pain-sheet-title {
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .pain-sheet-icon {
                        font-size: 24px;
                    }

                    .pain-sheet-close {
                        background: rgba(255, 255, 255, 0.2);
                        border: none;
                        border-radius: 8px;
                        padding: 8px;
                        cursor: pointer;
                        color: white;
                        transition: background 0.2s;
                    }

                    .pain-sheet-close:hover {
                        background: rgba(255, 255, 255, 0.3);
                    }

                    .pain-sheet-info {
                        padding: 16px 24px;
                        background: #f8fafc;
                        border-bottom: 1px solid #e2e8f0;
                    }

                    .pain-sheet-info-row {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        margin-bottom: 8px;
                    }

                    .pain-sheet-info-row:last-child {
                        margin-bottom: 0;
                    }

                    .pain-sheet-info-row label {
                        font-weight: 600;
                        color: #475569;
                        min-width: 140px;
                        font-size: 14px;
                    }

                    .pain-sheet-info-row input {
                        flex: 1;
                        padding: 8px 12px;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        font-size: 14px;
                        transition: border-color 0.2s;
                    }

                    .pain-sheet-info-row input:focus {
                        outline: none;
                        border-color: #667eea;
                        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                    }

                    .pain-sheet-table-container {
                        flex: 1;
                        overflow: auto;
                        padding: 16px 24px;
                    }

                    .pain-sheet-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 13px;
                    }

                    .pain-sheet-table th {
                        background: #f1f5f9;
                        padding: 12px;
                        text-align: left;
                        border: 1px solid #e2e8f0;
                        vertical-align: top;
                    }

                    .pain-col-id {
                        width: 40px;
                    }

                    .pain-col-reason,
                    .pain-col-impact,
                    .pain-col-capability {
                        width: calc((100% - 40px) / 3);
                    }

                    .pain-col-header {
                        font-weight: 700;
                        color: #1e293b;
                        font-size: 14px;
                        margin-bottom: 4px;
                    }

                    .pain-col-subheader {
                        font-weight: 400;
                        color: #64748b;
                        font-size: 12px;
                    }

                    .pain-sheet-table td {
                        padding: 8px;
                        border: 1px solid #e2e8f0;
                        vertical-align: top;
                    }

                    .pain-row-id {
                        font-weight: 700;
                        color: #475569;
                        text-align: center;
                        background: #f8fafc;
                    }

                    .pain-sheet-table textarea {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #e2e8f0;
                        border-radius: 4px;
                        font-size: 13px;
                        resize: vertical;
                        font-family: inherit;
                        transition: border-color 0.2s;
                    }

                    .pain-sheet-table textarea:focus {
                        outline: none;
                        border-color: #667eea;
                        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
                    }

                    .pain-sheet-footer {
                        display: flex;
                        justify-content: flex-end;
                        gap: 12px;
                        padding: 16px 24px;
                        background: #f8fafc;
                        border-top: 1px solid #e2e8f0;
                    }

                    .pain-sheet-btn {
                        padding: 10px 24px;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .pain-sheet-btn-cancel {
                        background: white;
                        border: 1px solid #e2e8f0;
                        color: #64748b;
                    }

                    .pain-sheet-btn-cancel:hover {
                        background: #f1f5f9;
                    }

                    .pain-sheet-btn-save {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border: none;
                        color: white;
                    }

                    .pain-sheet-btn-save:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                    }
                `}</style>
            </div>
        </div>
    );
}
