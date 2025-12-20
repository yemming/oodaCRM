import { useState } from 'react';
import type { ContactRecord, SendEmailParams } from '../services/api';
import { sendEmail } from '../services/api';

interface EmailComposerModalProps {
    opportunityId: string;
    opportunityTitle?: string;
    opportunityStatus?: string;
    opportunityAmount?: number;
    opportunityProbability?: number;
    opportunityCloseDate?: string;
    opportunityCustomer?: string;
    opportunityCustomerId?: string;
    opportunitySalesRep?: string;
    contacts: ContactRecord[];
    // Full opportunity data for AI context
    buyingCenter?: any[];
    weeklyNotes?: any[];
    activities?: {
        emails?: any[];
        phoneCalls?: any[];
        tasks?: any[];
        events?: any[];
    };
    scorecardData?: any;
    formData?: any;
    onClose: () => void;
    onSuccess: () => void;
}

// Inline styles (since TailwindCSS is not configured)
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
        maxWidth: '640px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column' as const
    },
    header: {
        background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    headerIcon: {
        width: '40px',
        height: '40px',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '12px'
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
        justifyContent: 'flex-end',
        gap: '12px'
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '14px',
        outline: 'none',
        marginBottom: '16px'
    },
    textarea: {
        width: '100%',
        padding: '12px 16px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '14px',
        outline: 'none',
        resize: 'none' as const,
        minHeight: '200px'
    },
    label: {
        display: 'block',
        fontSize: '14px',
        fontWeight: 600,
        color: '#374151',
        marginBottom: '8px'
    },
    generateBtn: {
        width: '100%',
        padding: '14px',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginBottom: '20px'
    },
    sendBtn: {
        padding: '10px 20px',
        background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
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
    error: {
        padding: '12px',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        color: '#b91c1c',
        fontSize: '14px',
        marginBottom: '16px'
    },
    success: {
        padding: '12px',
        backgroundColor: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '8px',
        color: '#15803d',
        fontSize: '14px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.8)',
        cursor: 'pointer',
        padding: '4px'
    }
};

/**
 * AI Email Composer Modal
 */
const EmailComposerModal = ({
    opportunityId,
    opportunityTitle = '',
    opportunityStatus = '',
    opportunityAmount = 0,
    opportunityProbability = 0,
    opportunityCloseDate = '',
    opportunityCustomer = '',
    opportunityCustomerId = '',
    opportunitySalesRep = '',
    contacts,
    buyingCenter = [],
    weeklyNotes = [],
    activities = {},
    scorecardData = {},
    formData = {},
    onClose,
    onSuccess
}: EmailComposerModalProps) => {
    const [selectedContactId, setSelectedContactId] = useState<string>('');
    const [customEmail, setCustomEmail] = useState<string>('');
    const [subject, setSubject] = useState<string>('');
    const [body, setBody] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [aiSuccess, setAiSuccess] = useState<boolean>(false);

    // Get the selected contact's email and name
    const selectedContact = contacts.find(c => c.id === selectedContactId);
    const recipientEmail = selectedContact?.email || customEmail;
    const recipientName = selectedContact?.name || '';
    const recipientTitle = selectedContact?.title || '';

    // Generate AI Email Suggestion
    const handleGenerateAI = async () => {
        if (!selectedContactId && !customEmail) {
            setError('請先選擇收件人');
            return;
        }

        setIsGenerating(true);
        setError('');
        setAiSuccess(false);

        try {
            // Import n8nApi dynamically
            const { callN8N, createEmailTemplatePayload, extractTextFromN8NResponse } = await import('../services/n8nApi');

            // Create payload with FULL opportunity data
            const payload = createEmailTemplatePayload(
                {
                    id: opportunityId,
                    title: opportunityTitle,
                    customer: opportunityCustomer,
                    customerId: opportunityCustomerId,
                    status: opportunityStatus,
                    amount: opportunityAmount,
                    probability: opportunityProbability,
                    closeDate: opportunityCloseDate,
                    salesRep: opportunitySalesRep
                },
                {
                    name: recipientName || '客戶',
                    email: recipientEmail,
                    title: recipientTitle
                },
                'follow_up',
                {
                    buyingCenter: buyingCenter,
                    weeklyNotes: weeklyNotes,
                    activities: activities,
                    scorecardData: scorecardData,
                    formData: formData
                }
            );

            // Call N8N
            const result = await callN8N(payload);

            if (!result.success || !result.data) {
                // Use a default template if N8N failed
                const contactName = recipientName || '客戶';
                setSubject(`關於 ${opportunityTitle || '商機'} 的進度更新`);
                setBody(`${contactName} 您好，

感謝您對於 ${opportunityTitle || '此案件'} 的關注與支持。

我想向您更新目前的進度狀況：

• 目前專案狀態：${opportunityStatus || '進行中'}
• 預估金額：$${opportunityAmount?.toLocaleString() || '待確認'}

如有任何問題或需要進一步討論，請隨時與我聯繫。

期待您的回覆！

Best regards`);
                setAiSuccess(true);
                setIsGenerating(false);
                return;
            }

            // Extract text from N8N response
            const aiText = extractTextFromN8NResponse(result.data);

            // Parse subject and body
            const lines = aiText.split('\n');
            const subjectLine = lines.find((l: string) => l.toLowerCase().startsWith('subject:') || l.toLowerCase().startsWith('主旨:'));
            if (subjectLine) {
                setSubject(subjectLine.replace(/^(subject:|主旨:)/i, '').trim());
                setBody(lines.filter((l: string) => l !== subjectLine).join('\n').trim());
            } else if (typeof result.data === 'object' && result.data.subject && result.data.body) {
                setSubject(result.data.subject);
                setBody(result.data.body);
            } else {
                setBody(aiText);
                setSubject(`關於 ${opportunityTitle || '商機'} 的跟進`);
            }

            setAiSuccess(true);
        } catch (e) {
            console.error('AI Generation Error:', e);
            setError('AI 生成失敗: ' + String(e));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSend = async () => {
        if (!recipientEmail) {
            setError('請選擇收件人或輸入 Email 地址');
            return;
        }
        if (!subject.trim()) {
            setError('請輸入郵件主旨');
            return;
        }

        setIsSending(true);
        setError('');

        try {
            const params: SendEmailParams = {
                opportunityId,
                recipientContactId: selectedContactId || undefined,
                recipientEmail,
                emailSubject: subject,
                emailBody: body
            };

            const result = await sendEmail(params);

            if (result.success) {
                onSuccess();
                onClose();
            } else {
                setError(result.error || '發送失敗');
            }
        } catch (e) {
            setError('發送時發生錯誤');
        } finally {
            setIsSending(false);
        }
    };

    // Filter contacts with email
    const contactsWithEmail = contacts.filter(c => c.email);

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={styles.headerIcon}>
                            <span style={{ fontSize: '20px' }}>🤖</span>
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'white' }}>AI 建議郵件</h2>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>AI 將根據商機狀況生成建議內容</p>
                        </div>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div style={styles.body}>
                    {/* Error */}
                    {error && <div style={styles.error}>{error}</div>}

                    {/* Success */}
                    {aiSuccess && (
                        <div style={styles.success}>
                            ✅ AI 已生成建議內容，您可以編輯後發送！
                        </div>
                    )}

                    {/* Recipient */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={styles.label}>收件人</label>
                        {contactsWithEmail.length > 0 && (
                            <select
                                value={selectedContactId}
                                onChange={(e) => {
                                    setSelectedContactId(e.target.value);
                                    if (e.target.value) setCustomEmail('');
                                }}
                                style={{ ...styles.input, cursor: 'pointer' }}
                            >
                                <option value="">-- 選擇聯絡人 --</option>
                                {contactsWithEmail.map(contact => (
                                    <option key={contact.id} value={contact.id}>
                                        {contact.name} {contact.title ? `(${contact.title})` : ''} - {contact.email}
                                    </option>
                                ))}
                            </select>
                        )}
                        <input
                            type="email"
                            value={customEmail}
                            onChange={(e) => {
                                setCustomEmail(e.target.value);
                                if (e.target.value) setSelectedContactId('');
                            }}
                            placeholder="或手動輸入 Email 地址"
                            style={styles.input}
                        />
                        {recipientEmail && (
                            <div style={{ fontSize: '13px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                ✓ 將發送至: {recipientEmail}
                            </div>
                        )}
                    </div>

                    {/* AI Generate Button */}
                    <button
                        onClick={handleGenerateAI}
                        disabled={isGenerating || (!selectedContactId && !customEmail)}
                        style={{
                            ...styles.generateBtn,
                            opacity: (isGenerating || (!selectedContactId && !customEmail)) ? 0.6 : 1,
                            cursor: (isGenerating || (!selectedContactId && !customEmail)) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isGenerating ? '⏳ AI 正在生成建議...' : '✨ 生成 AI 建議郵件'}
                    </button>

                    {/* Subject */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={styles.label}>主旨</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="輸入郵件主旨（或點擊上方按鈕讓 AI 生成）"
                            style={styles.input}
                        />
                    </div>

                    {/* Body */}
                    <div>
                        <label style={styles.label}>內容</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="輸入郵件內容（或點擊上方按鈕讓 AI 生成）..."
                            style={styles.textarea}
                            rows={10}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <button style={styles.cancelBtn} onClick={onClose} disabled={isSending}>
                        取消
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isSending || !recipientEmail || !subject}
                        style={{
                            ...styles.sendBtn,
                            opacity: (isSending || !recipientEmail || !subject) ? 0.6 : 1,
                            cursor: (isSending || !recipientEmail || !subject) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isSending ? '發送中...' : '📤 發送郵件'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmailComposerModal;
