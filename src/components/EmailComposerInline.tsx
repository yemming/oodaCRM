import { useState, useEffect } from 'react';
import type { ContactRecord, SendEmailParams } from '../services/api';
import { sendEmail } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    observation?: string; // BANT/Observation details
    onSuccess: () => void;
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
        padding: '12px',
        backgroundColor: '#f8fafc',
        color: '#336179',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        transition: 'all 0.2s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    },
    actions: {
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        paddingTop: '16px',
        borderTop: '1px solid #f1f5f9'
    },
    sendBtn: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#336179',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: '0 2px 4px rgba(51, 97, 121, 0.2)'
    },
    checkboxList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
        maxHeight: '150px',
        overflowY: 'auto' as const,
        padding: '8px',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        backgroundColor: '#f8fafc'
    },
    checkboxItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        color: '#1e293b',
        cursor: 'pointer',
        padding: '4px 0'
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
    observation = '',
    onSuccess
}: EmailComposerInlineProps) => {
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [customEmail, setCustomEmail] = useState<string>('');
    const [subject, setSubject] = useState<string>('');
    const [body, setBody] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    // View Mode: 'compose' | 'preview'
    const [viewMode, setViewMode] = useState<'compose' | 'preview'>('compose');
    const [previewContent, setPreviewContent] = useState<string>('');

    // Jokes state for loading
    const [currentJokeIndex, setCurrentJokeIndex] = useState(0);
    const jokes = [
        "為什麼業務員喜歡雨天？\n因為客戶都在家。",
        "正在替您準備絕佳的郵件內容...",
        "別擔心，AI 不會搶走您的工作，但會用 AI 的人可能會喔！",
        "CRM 系統就像健身房會員卡，買了不代表你會變壯，你得去用它！",
        "成功的業務員從不等待機會，而是創造機會（和好郵件）！"
    ];

    // Cycle jokes when loading
    useEffect(() => {
        let interval: any;
        if (isGenerating) {
            setCurrentJokeIndex(0);
            interval = setInterval(() => {
                setCurrentJokeIndex(prev => (prev + 1) % jokes.length);
            }, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isGenerating]);

    // Get selected contacts
    const selectedContacts = contacts.filter(c => selectedContactIds.includes(c.id));
    const recipientEmails = selectedContacts.map(c => c.email!).filter(Boolean);
    if (customEmail) recipientEmails.push(customEmail);

    const hasSelection = recipientEmails.length > 0;

    // Generate AI Email Suggestion
    const handleGenerateAI = async () => {
        if (selectedContactIds.length === 0 && !customEmail) {
            setError('請先選擇收件人');
            return;
        }

        setIsGenerating(true);
        setError('');

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
                    name: selectedContacts.length === 1 ? selectedContacts[0].name : (selectedContacts.length > 1 ? '各位夥伴' : '客戶'),
                    email: recipientEmails.join(', '),
                    title: selectedContacts.length === 1 ? selectedContacts[0].title : ''
                },
                'follow_up',
                {
                    buyingCenter: buyingCenter,
                    weeklyNotes: weeklyNotes,
                    activities: activities,
                    scorecardData: scorecardData,
                    observation: observation
                }
            );

            // Call N8N
            const result = await callN8N(payload);

            if (!result.success || !result.data) {
                setError(result.error || 'AI 生成失敗，未返回數據');
                setIsGenerating(false);
                return;
            }

            // Extract text from N8N response
            const aiText = extractTextFromN8NResponse(result.data);
            setPreviewContent(aiText);
            setViewMode('preview');

        } catch (e) {
            console.error('AI Generation Error:', e);
            setError('AI 生成失敗: ' + String(e));
        } finally {
            setIsGenerating(false);
        }
    };

    // Helper to switch to Edit Mode (strip parsing logic if needed, or parse here)
    const handleUseDraft = () => {
        const text = previewContent;
        const lines = text.split('\n');

        let foundSubject = '';
        let foundBody = '';

        const subjectLine = lines.find((l: string) => l.toLowerCase().startsWith('subject:') || l.toLowerCase().startsWith('主旨:'));

        if (subjectLine) {
            foundSubject = subjectLine.replace(/^(subject:|主旨:)/i, '').trim();
            // Remove subject line and join relevant body parts
            // Also simplistic markdown check - can strip more if needed
            foundBody = lines.filter((l: string) => l !== subjectLine).join('\n').trim();
        } else {
            // Try to parse headers if AI returns subject as key
            // For now, assume entire text is body if no subject line
            foundSubject = `關於 ${opportunityTitle || '商機'} 的跟進`;
            foundBody = text;
        }

        // Simple stripping of bold markers for plain text usage if desired, 
        // though user might want to keep some formatting if their email client supports it.
        // Let's keep it minimal: remove bold ** but keep list *
        foundBody = foundBody.replace(/\*\*(.*?)\*\*/g, '$1');

        setSubject(foundSubject);
        setBody(foundBody);
        setViewMode('compose');
    };

    const handleSend = async () => {
        if (!hasSelection) {
            setError('請選擇收件人或輸入 Email 地址');
            return;
        }

        setIsSending(true);
        setError('');

        try {
            const params: SendEmailParams = {
                opportunityId,
                recipientContactIds: selectedContactIds.length > 0 ? selectedContactIds : undefined,
                recipientEmails: recipientEmails,
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
                <span>建議郵件撰寫</span>
            </div>



            {/* Recipient */}
            <div style={styles.inputGroup}>
                <label style={styles.label}>收件人 (多選)</label>
                {contactsWithEmail.length > 0 && (
                    <div style={styles.checkboxList}>
                        {contactsWithEmail.map(contact => (
                            <label key={contact.id} style={styles.checkboxItem}>
                                <input
                                    type="checkbox"
                                    checked={selectedContactIds.includes(contact.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedContactIds(prev => [...prev, contact.id]);
                                        } else {
                                            setSelectedContactIds(prev => prev.filter(id => id !== contact.id));
                                        }
                                    }}
                                />
                                <span>{contact.name} {contact.title ? `(${contact.title})` : ''}</span>
                            </label>
                        ))}
                    </div>
                )}
                <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="或手動輸入補發 Email 地址"
                    style={styles.input}
                />
            </div>

            {/* Error */}
            {error && <div style={styles.error}>{error}</div>}

            {/* AI Generate Button (Only show in compose mode if not previewing) */}
            {viewMode === 'compose' && (
                <button
                    onClick={handleGenerateAI}
                    disabled={isGenerating || !hasSelection}
                    style={{
                        ...styles.generateBtn,
                        opacity: (isGenerating || !hasSelection) ? 0.6 : 1,
                        cursor: (isGenerating || !hasSelection) ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isGenerating ? (
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span>生成建議中...</span>
                            <span style={{ fontSize: '11px', fontWeight: 'normal', marginTop: '4px', fontStyle: 'italic' }}>
                                {jokes[currentJokeIndex]}
                            </span>
                        </span>
                    ) : '生成建議郵件'}
                </button>
            )}

            {/* Preview Mode */}
            {viewMode === 'preview' && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', backgroundColor: '#f9f9f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, color: '#336179' }}>AI 建議內容</h4>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleGenerateAI}
                                disabled={isGenerating}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '13px',
                                    backgroundColor: 'white',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                {isGenerating ? '重新生成...' : '重新生成'}
                            </button>
                        </div>
                    </div>
                    <div className="ooda-ai-markdown-content" style={{ maxHeight: '400px', overflowY: 'auto', backgroundColor: 'white', padding: '12px', borderRadius: '6px', position: 'relative' }}>
                        <div style={{ opacity: isGenerating ? 0.3 : 1, transition: 'opacity 0.3s' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {previewContent}
                            </ReactMarkdown>
                        </div>

                        {/* Loading Overlay with Jokes (Preview Mode) */}
                        {isGenerating && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10,
                                pointerEvents: 'none'
                            }}>
                                <div style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    padding: '20px',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                    textAlign: 'center',
                                    maxWidth: '90%'
                                }}>
                                    <div style={{ fontSize: '24px', marginBottom: '12px' }}>🤖 💭</div>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#4b5563', whiteSpace: 'pre-line' }}>
                                        {jokes[currentJokeIndex]}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleUseDraft}
                        style={{
                            ...styles.sendBtn,
                            marginTop: '16px',
                            backgroundColor: '#0f766e' // distinct color
                        }}
                    >
                        使用此草稿 (可編輯)
                    </button>
                </div>
            )}

            {/* Compose Fields (Subject & Body) - Only show in compose mode */}
            {viewMode === 'compose' && (
                <>
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
                        <button
                            onClick={handleSend}
                            disabled={isSending || !hasSelection || !subject}
                            style={{
                                ...styles.sendBtn,
                                opacity: (isSending || !hasSelection || !subject) ? 0.6 : 1,
                                cursor: (isSending || !hasSelection || !subject) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isSending ? '發送中...' : '發送郵件'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
