import { useState } from 'react';
import type { ContactRecord, SendEmailParams } from '../services/api';
import { sendEmail } from '../services/api';

interface EmailComposerInlineProps {
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
    onSuccess: () => void;
    onCancel: () => void;
}

// Inline styles
const styles = {
    container: {
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        padding: '16px',
        marginTop: '16px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '16px'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '15px',
        fontWeight: 600,
        color: '#1e293b',
        borderBottom: '1px solid #f1f5f9',
        paddingBottom: '12px'
    },
    error: {
        padding: '12px',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        color: '#b91c1c',
        fontSize: '14px'
    },
    success: {
        padding: '12px',
        backgroundColor: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '8px',
        color: '#15803d',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '6px'
    },
    label: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#64748b'
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s'
    },
    textarea: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        fontSize: '14px',
        outline: 'none',
        resize: 'vertical' as const,
        minHeight: '200px',
        lineHeight: 1.5
    },
    generateBtn: {
        width: '100%',
        padding: '10px',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px'
    },
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        paddingTop: '12px',
        borderTop: '1px solid #f1f5f9'
    },
    sendBtn: {
        padding: '8px 16px',
        background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    },
    cancelBtn: {
        padding: '8px 16px',
        backgroundColor: 'white',
        color: '#64748b',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        fontSize: '14px',
        cursor: 'pointer'
    }
};

/**
 * Inline AI Email Composer
 */
export const EmailComposerInline = ({
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
    onSuccess,
    onCancel
}: EmailComposerInlineProps) => {
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
                setBody(`${contactName} 您好，\n\n感謝您對於 ${opportunityTitle || '此案件'} 的關注與支持。\n\n我想向您更新目前的進度狀況：\n\n• 目前專案狀態：${opportunityStatus || '進行中'}\n• 預估金額：$${opportunityAmount?.toLocaleString() || '待確認'}\n\n如有任何問題或需要進一步討論，請隨時與我聯繫。\n\nBest regards`);
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
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <span style={{ fontSize: '20px' }}>🤖</span>
                <span>AI 建議郵件撰寫</span>
            </div>

            {/* Error */}
            {error && <div style={styles.error}>{error}</div>}

            {/* Success */}
            {aiSuccess && (
                <div style={styles.success}>
                    ✅ AI 已生成建議內容，您可以編輯後發送！
                </div>
            )}

            {/* Recipient */}
            <div style={styles.inputGroup}>
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
            <div style={styles.inputGroup}>
                <label style={styles.label}>主旨</label>
                <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="輸入郵件主旨..."
                    style={styles.input}
                />
            </div>

            {/* Body */}
            <div style={styles.inputGroup}>
                <label style={styles.label}>內容</label>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="輸入郵件內容..."
                    style={styles.textarea}
                    rows={8}
                />
            </div>

            {/* Actions */}
            <div style={styles.actions}>
                <button style={styles.cancelBtn} onClick={onCancel} disabled={isSending}>
                    返回洞察
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
    );
};
