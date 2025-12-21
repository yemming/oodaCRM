
import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import type { Opportunity, UserNote, EmailRecord, TaskRecord, EventRecord } from '../services/api';
import {
    fetchUserNotes, addUserNote,
    fetchTasks, addTask,
    fetchEvents, addEvent,
    saveOodaAnalysis,
    fetchOodaAnalysis,
    fetchContacts,
    updateOpportunityProbability,
    updateOpportunityMemo
} from '../services/api';
import { OpportunityScorecard } from './OpportunityScorecard';
import { PainSheet } from './PainSheet';
import EmailComposerModal from './EmailComposerModal';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    useDraggable,
    useDroppable
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';



interface Contact {
    id: string;
    internalId?: string; // NetSuite Internal ID for linking to Contact record
    name: string;
    title: string;
    email?: string;
    phone?: string;
    avatar?: string;
    category?: 'champion' | 'blocker' | 'low_priority' | 'supporter';
}

interface OodaAnalysisPageProps {
    opportunity: Opportunity;
    onClose: () => void;
}

// Demo activities data (Removed unused demo data)

export function OodaAnalysisPage({ opportunity, onClose }: OodaAnalysisPageProps) {
    const [activeTab, setActiveTab] = useState<'ai' | 'weekly' | 'activity'>('activity');
    const [activitySubTab, setActivitySubTab] = useState<'task' | 'event'>('task');
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactsLoaded, setContactsLoaded] = useState(false);
    const [activeContact, setActiveContact] = useState<Contact | null>(null);
    const [painSheetContact, setPainSheetContact] = useState<Contact | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

    // Details (Memo) State
    const [details, setDetails] = useState('');
    // savingDetails state removed as it is merged into isSaving

    // Initial Data Loading
    useEffect(() => {
        // Load Details from opportunity
        if (opportunity.memo) {
            setDetails(opportunity.memo);
        }
    }, [opportunity]);

    // handleSaveDetails removed - merged into handleSaveContacts

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement required to start drag
            },
        })
    );

    // AI Insight State
    const [loadingAI, setLoadingAI] = useState(false);
    const [aiInsight, setAiInsight] = useState('');
    const [, setAnalysisLoaded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea based on content
    useEffect(() => {
        if (textareaRef.current) {
            // Reset height to auto to get the correct scrollHeight
            textareaRef.current.style.height = 'auto';
            // Set height to scrollHeight to fit content
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [aiInsight]);

    const handleGenerateInsight = async () => {
        setLoadingAI(true);
        setAiInsight('正在連線至 AI 分析引擎...');

        try {
            // Import n8nApi dynamically
            const { callN8N, createAIInsightPayload, extractTextFromN8NResponse } = await import('../services/n8nApi');

            // Create payload using unified structure
            const payload = createAIInsightPayload(
                {
                    id: opportunity.id,
                    title: opportunity.title,
                    customer: opportunity.customer,
                    customerId: opportunity.customerId,
                    status: opportunity.status,
                    statusText: opportunity.statusText,
                    amount: opportunity.amount,
                    probability: opportunity.probability,
                    closeDate: opportunity.closeDate,
                    salesRep: opportunity.salesRep
                },
                {
                    buyingCenter: contacts,
                    weeklyNotes: weeklyNotes,
                    // Add new type property to satisfy TypeScript
                    activities: {
                        emails: [],
                        tasks: tasks,
                        events: events
                    } as {
                        emails: EmailRecord[];
                        tasks: TaskRecord[];
                        events: EventRecord[];
                    },
                    scorecardData: { ...formData, scorecardChecks }
                }
            );

            // Call N8N
            const result = await callN8N(payload);

            if (!result.success) {
                setAiInsight('⚠️ ' + (result.error || 'AI 分析請求失敗'));
                setLoadingAI(false);
                return;
            }

            // Extract text from response
            const insightText = extractTextFromN8NResponse(result.data);
            setAiInsight(insightText);

            // Save to NetSuite
            try {
                const saveResult = await saveOodaAnalysis(
                    opportunity.id,
                    insightText,
                    contacts, // Buying Center is stored in contacts (with category)
                    payload // Snapshot
                );

                if (saveResult.success) {
                    setAiInsight(prev => prev + '\n\n✅ 分析結果已自動儲存至 NetSuite。');
                } else {
                    if (saveResult.error && String(saveResult.error).includes('Invalid record type')) {
                        setAiInsight(prev => prev + '\n\nℹ️ (儲存略過: 請管理員建立 "OODA Analysis" Custom Record)');
                    } else {
                        console.warn('Save Analysis Failed', saveResult.error);
                    }
                }
            } catch (saveErr) {
                console.error('Save Analysis Exception', saveErr);
            }

        } catch (error) {
            console.error('AI Insight Error:', error);
            setAiInsight('❌ 分析請求發送失敗: ' + String(error));
        } finally {
            setLoadingAI(false);
        }
    };

    // Load AI Analysis History and Contacts
    useEffect(() => {
        const loadData = async () => {
            // First, load contacts from NetSuite
            if (!contactsLoaded) {
                try {
                    const contactsResult = await fetchContacts(opportunity.id);
                    if (contactsResult.success && contactsResult.contacts) {
                        // Convert API contacts to local Contact type and deduplicate by internalId
                        const contactMap = new Map<string, Contact>();
                        contactsResult.contacts.forEach(c => {
                            const key = c.internalId || c.id;
                            if (!contactMap.has(key)) {
                                contactMap.set(key, {
                                    id: c.id,
                                    internalId: c.internalId,
                                    name: c.name,
                                    title: c.title || '',
                                    email: c.email || '',
                                    phone: c.phone || '',
                                    category: undefined
                                });
                            }
                        });
                        const loadedContacts: Contact[] = Array.from(contactMap.values());
                        setContacts(loadedContacts);
                        setContactsLoaded(true);

                        // Then load saved classifications and apply them
                        const analysisResult = await fetchOodaAnalysis(opportunity.id);
                        if (analysisResult.success && analysisResult.analysis?.buyingCenter) {
                            try {
                                const savedClassifications = JSON.parse(analysisResult.analysis.buyingCenter);
                                if (Array.isArray(savedClassifications)) {
                                    // Merge saved classifications with loaded contacts
                                    setContacts(prev => prev.map(contact => {
                                        const saved = savedClassifications.find((s: Contact) => s.id === contact.id);
                                        return saved ? { ...contact, category: saved.category } : contact;
                                    }));
                                }
                            } catch (e) {
                                console.error('Failed to parse buying center:', e);
                            }
                        }

                        // Load saved snapshot (Score & Checks)
                        if (analysisResult.success && analysisResult.analysis?.snapshot) {
                            try {
                                const savedSnapshot = JSON.parse(analysisResult.analysis.snapshot);
                                if (savedSnapshot.scorecardChecks) {
                                    setScorecardChecks(savedSnapshot.scorecardChecks);
                                }
                            } catch (e) {
                                console.error('Failed to parse snapshot:', e);
                            }
                        }

                        // Load AI insight
                        if (analysisResult.success && analysisResult.analysis?.insight) {
                            setAiInsight(analysisResult.analysis.insight);
                        }
                        setAnalysisLoaded(true);
                    }
                } catch (error) {
                    console.error('Failed to load contacts:', error);
                    setContactsLoaded(true);
                }
            }
        };

        if (!contactsLoaded && !loadingAI) {
            setLoadingAI(true);
            // Only set AI text if empty or error, don't overwrite if it's just background loading? 
            // Actually it's fine.
            if (!aiInsight) setAiInsight('🔄 正在載入資料...');
            loadData().finally(() => setLoadingAI(false));
        }
    }, [opportunity.id, contactsLoaded, loadingAI]);

    // Weekly notes state
    const [weeklyNotes, setWeeklyNotes] = useState<UserNote[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [notesLoaded, setNotesLoaded] = useState(false);
    const [showAddNote, setShowAddNote] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteContent, setNewNoteContent] = useState('');
    const [submittingNote, setSubmittingNote] = useState(false);

    // Email Composer State
    const [showEmailComposer, setShowEmailComposer] = useState(false);
    // Keep emails state for AI context or Composer, even if empty
    const [emails] = useState<EmailRecord[]>([]);

    // Task States
    const [tasks, setTasks] = useState<TaskRecord[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [tasksLoaded, setTasksLoaded] = useState(false);
    const [showAddTask, setShowAddTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState('Medium');
    const [newTaskDueDate, setNewTaskDueDate] = useState('');
    const [newTaskMessage, setNewTaskMessage] = useState('');
    const [submittingTask, setSubmittingTask] = useState(false);

    // Event States
    const [events, setEvents] = useState<EventRecord[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [eventsLoaded, setEventsLoaded] = useState(false);
    const [showAddEvent, setShowAddEvent] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventMessage, setNewEventMessage] = useState('');
    const [submittingEvent, setSubmittingEvent] = useState(false);

    // Load weekly notes when tab is activated (only once)
    useEffect(() => {
        if (activeTab === 'weekly' && !notesLoaded && !loadingNotes) {
            loadNotes();
        }
    }, [activeTab]);

    const loadNotes = async () => {
        if (loadingNotes) return; // Prevent duplicate calls

        setLoadingNotes(true);
        try {
            const result = await fetchUserNotes(opportunity.id);
            if (result.success && result.notes) {
                setWeeklyNotes(result.notes);
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
        } finally {
            setLoadingNotes(false);
            setNotesLoaded(true);
        }
    };

    const handleAddNote = async () => {
        if (!newNoteTitle.trim() || !newNoteContent.trim()) {
            alert('請填寫標題和內容');
            return;
        }

        setSubmittingNote(true);
        const result = await addUserNote(opportunity.id, newNoteTitle, newNoteContent);
        setSubmittingNote(false);

        if (result.success) {
            // Add to local list and reset form
            setWeeklyNotes(prev => [{
                id: result.noteId || 'new-' + Date.now(),
                title: newNoteTitle,
                note: newNoteContent,
                date: new Date().toISOString().split('T')[0],
                author: 'Current User'
            }, ...prev]);
            setNewNoteTitle('');
            setNewNoteContent('');
            setShowAddNote(false);
        } else {
            alert('新增週報失敗: ' + (result.error || '未知錯誤'));
        }
    };



    const loadEvents = async () => {
        if (loadingEvents) return;
        setLoadingEvents(true);
        try {
            const result = await fetchEvents(opportunity.id);
            if (result.success && result.events) {
                setEvents(result.events);
            }
        } finally {
            setLoadingEvents(false);
            setEventsLoaded(true);
        }
    };

    const loadTasks = async () => {
        if (loadingTasks) return;
        setLoadingTasks(true);
        try {
            const result = await fetchTasks(opportunity.id);
            if (result.success && result.tasks) {
                setTasks(result.tasks);
            }
        } finally {
            setLoadingTasks(false);
            setTasksLoaded(true);
        }
    };

    // Load data when tab changes
    useEffect(() => {
        if (activeTab === 'activity') {
            if (activitySubTab === 'task' && !tasksLoaded && !loadingTasks) { loadTasks(); }
            else if (activitySubTab === 'event' && !eventsLoaded && !loadingEvents) { loadEvents(); }
        } else if (activeTab === 'weekly') {
            if (!notesLoaded && !loadingNotes) { loadNotes(); }
        }
    }, [activeTab, activitySubTab]);



    const handleAddTask = async () => {
        if (!newTaskTitle.trim() || !newTaskDueDate.trim()) {
            alert('請填寫任務標題和到期日');
            return;
        }
        setSubmittingTask(true);
        const result = await addTask(opportunity.id, newTaskTitle, newTaskPriority, newTaskDueDate, newTaskMessage);
        setSubmittingTask(false);
        if (result.success) {
            setTasks(prev => [{
                id: result.taskId || 'new-' + Date.now(),
                title: newTaskTitle,
                priority: newTaskPriority,
                status: 'Not Started',
                dueDate: newTaskDueDate,
                assignee: 'Current User',
                message: newTaskMessage
            }, ...prev]);
            setNewTaskTitle('');
            setNewTaskPriority('Medium');
            setNewTaskDueDate('');
            setNewTaskMessage('');
            setShowAddTask(false);
        } else {
            alert('新增任務失敗: ' + (result.error || '未知錯誤'));
        }

    };

    const handleAddEvent = async () => {
        if (!newEventTitle.trim() || !newEventDate.trim()) {
            alert('請填寫行程標題和日期');
            return;
        }
        setSubmittingEvent(true);
        const result = await addEvent(opportunity.id, newEventTitle, newEventDate, newEventMessage);
        setSubmittingEvent(false);
        if (result.success) {
            setEvents(prev => [{
                id: result.eventId || 'new-' + Date.now(),
                title: newEventTitle,
                date: newEventDate,
                author: 'Current User',
                message: newEventMessage
            }, ...prev]);
            setNewEventTitle('');
            setNewEventDate('');
            setNewEventMessage('');
            setShowAddEvent(false);
        } else {
            alert('新增行程失敗: ' + (result.error || '未知錯誤'));
        }
    };

    // Form states for NetSuite fields
    const [formData, setFormData] = useState({
        subsidiary: 'N/A',
        department: 'Sales: Enterprise',
        category: '',
        location: 'Taipei Office',
        expectedCloseDate: '2026/03/17',
        notes: 'Adelaide Sports 需要建立全新的電商平台，支援多國語言和多幣別',
        probability: 60,
        projectedAmount: 1500000,
        status: 'In Discussion',
    });

    // Scorecard State
    const [scorecardChecks, setScorecardChecks] = useState<Record<string, boolean>>({});

    const handleScoreChange = (score: number, checks: Record<string, boolean>) => {
        setFormData(prev => ({ ...prev, probability: score }));
        setScorecardChecks(checks);
    };

    // Drag and Drop handlers
    const handleDragStart = (event: DragStartEvent) => {
        const contactId = event.active.id as string;
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
            setActiveContact(contact);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveContact(null);

        if (!over) return;

        const contactId = active.id as string;
        const newCategory = over.id as string;

        // Update contact category
        setContacts(prevContacts => {
            const updatedContacts = prevContacts.map(c => {
                if (c.id === contactId) {
                    // Handle unassigned category
                    if (newCategory === 'unassigned') {
                        return { ...c, category: undefined };
                    }
                    // Handle valid categories
                    return { ...c, category: newCategory as Contact['category'] };
                }
                return c;
            });

            // Auto-save to NetSuite
            saveContactClassifications(updatedContacts);

            return updatedContacts;
        });
    };

    // Save contact classifications to NetSuite
    const saveContactClassifications = async (contactsToSave: Contact[]) => {
        try {
            await saveOodaAnalysis(
                opportunity.id,
                aiInsight, // Keep existing insight
                contactsToSave, // Updated contacts
                { ...formData, scorecardChecks } // Merge checks into snapshot
            );
            console.log('✅ Contact classifications saved');
        } catch (error) {
            console.error('❌ Failed to save contact classifications:', error);
        }
    };

    // Get contacts by category
    const getContactsByCategory = (category: Contact['category']) => {
        return contacts.filter(c => c.category === category);
    };

    const unassignedContacts = contacts.filter(c => !c.category);

    // Open Pain Sheet for Contact
    const openPainSheet = (contact: Contact) => {
        setPainSheetContact(contact);
    };

    const closePainSheet = () => {
        setPainSheetContact(null);
    };

    // Manual save handler for contacts AND probability
    const handleSaveContacts = async () => {
        setIsSaving(true);
        setSaveSuccess(null);
        try {
            // Save contact classifications
            await saveContactClassifications(contacts);

            // Save probability to Opportunity record
            await updateOpportunityProbability(
                opportunity.id,
                formData.probability,
                scorecardChecks
            );

            // Save Details (Memo)
            await updateOpportunityMemo(opportunity.id, details);

            console.log('✅ Saved:', { contacts: contacts.length, probability: formData.probability });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(null), 3000); // Hide success after 3s
        } catch (error) {
            console.error('Save error:', error);
            setSaveSuccess(false);
            setTimeout(() => setSaveSuccess(null), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    // Draggable Contact Component
    const DraggableContact = ({ contact }: { contact: Contact }) => {
        const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
            id: contact.id,
        });

        const style: React.CSSProperties = {
            transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
            opacity: isDragging ? 0.5 : 1,
            zIndex: isDragging ? 9999 : 100,
            position: 'relative' as const,
        };

        const handleNameClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            openPainSheet(contact);
        };

        return (
            <div
                ref={setNodeRef}
                style={style}
                {...listeners}
                {...attributes}
                className={`ooda-contact-card ${isDragging ? 'dragging' : ''}`}
            >
                <div className="ooda-contact-avatar">
                    {contact.name.charAt(0)}
                </div>
                <div className="ooda-contact-info">
                    <div
                        className="ooda-contact-name ooda-contact-name-link"
                        onClick={handleNameClick}
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking name
                        title="點擊查看聯絡人詳情"
                    >
                        {contact.name}
                    </div>
                    <div className="ooda-contact-title">{contact.title}</div>
                </div>
            </div>
        );
    };

    // Draggable Contact Chip (for matrix cells)
    const DraggableContactChip = ({ contact }: { contact: Contact }) => {
        const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
            id: contact.id,
        });

        const style: React.CSSProperties = {
            transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
            opacity: isDragging ? 0.5 : 1,
            zIndex: isDragging ? 9999 : 100,
            position: 'relative' as const,
        };

        const handleNameClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            openPainSheet(contact);
        };

        return (
            <div
                ref={setNodeRef}
                style={style}
                {...listeners}
                {...attributes}
                className={`ooda-contact-chip ${isDragging ? 'dragging' : ''}`}
            >
                <span
                    className="ooda-contact-chip-name"
                    onClick={handleNameClick}
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking name
                    title="點擊查看聯絡人詳情"
                >
                    {contact.name}
                </span>
            </div>
        );
    };

    // Droppable Cell Component
    const DroppableCell = ({ id, header, contacts: cellContacts }: {
        id: string;
        header: string;
        contacts: Contact[];
    }) => {
        const { setNodeRef, isOver } = useDroppable({
            id,
        });

        return (
            <div className={`ooda-matrix-cell ${id} ${isOver ? 'drag-over' : ''}`}>
                <div className="ooda-cell-header">{header}</div>
                <div className="ooda-cell-content" ref={setNodeRef}>
                    {cellContacts.length === 0 ? (
                        <div className="ooda-placeholder">拖放聯絡人至此</div>
                    ) : (
                        cellContacts.map(c => (
                            <DraggableContactChip
                                key={c.id}
                                contact={c}
                            />
                        ))
                    )}
                </div>
            </div>
        );
    };

    // Unassigned Contact List Component (Droppable)
    const UnassignedContactList = ({ contacts: unassigned }: { contacts: Contact[] }) => {
        const { setNodeRef, isOver } = useDroppable({
            id: 'unassigned',
        });

        return (
            <div
                ref={setNodeRef}
                className={`ooda-contact-list ${isOver ? 'drag-over' : ''}`}
            >
                {unassigned.map(contact => (
                    <DraggableContact key={contact.id} contact={contact} />
                ))}
            </div>
        );
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="ooda-modal-overlay" onClick={onClose}>
                <div className="ooda-modal-content" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="ooda-header">
                        <div className="ooda-header-left">
                            <h1 className="ooda-title">{opportunity.title}</h1>
                            <div className="ooda-meta">
                                <span className="ooda-id">OPP-{opportunity.tranId || opportunity.id}</span>
                                <span className="ooda-status-badge">{opportunity.statusText}</span>
                            </div>
                        </div>
                        <div className="ooda-header-center">
                            <div className="ooda-customer">
                                <span className="ooda-label">客戶</span>
                                <a
                                    href={`/ app / common / entity / custjob.nl ? id = ${opportunity.customerId} `}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ooda-customer-link"
                                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    {opportunity.customer}
                                </a>
                            </div>
                            <div className="ooda-amount">
                                <span className="ooda-label">預計金額</span>
                                <span className="ooda-value">${opportunity.amount.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="ooda-header-right">
                            <div className="ooda-close-date">
                                <span className="ooda-label">預計成案日</span>
                                <span className="ooda-value">{opportunity.closeDate}</span>
                            </div>
                            <div className="ooda-probability" style={{ marginLeft: '24px' }}>
                                <span className="ooda-label">成交機率</span>
                                <span className="ooda-value" style={{ color: '#2563eb', fontWeight: 'bold' }}>{formData.probability}%</span>
                            </div>
                            <button
                                className="ooda-save-btn"
                                onClick={handleSaveContacts}
                                disabled={isSaving}
                                style={{
                                    marginLeft: '16px',
                                    padding: '8px 16px',
                                    background: saveSuccess === true ? '#10b981' : saveSuccess === false ? '#ef4444' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: isSaving ? 'not-allowed' : 'pointer',
                                    opacity: isSaving ? 0.7 : 1,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isSaving ? '儲存中...' : saveSuccess === true ? '✓ 已儲存' : saveSuccess === false ? '✗ 失敗' : '儲存'}
                            </button>
                            <button className="ooda-close-btn" onClick={onClose}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Main Content - 3 Columns */}
                    <div className="ooda-main">
                        {/* Activity Timeline (Left Column) */}
                        <div className="ooda-column ooda-timeline">
                            <h2 className="ooda-section-title">Observe - 活動時間軸</h2>

                            {/* Details / Memo Section */}
                            <div className="ooda-details-section" style={{ marginBottom: '15px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#475569' }}>Details</label>
                                </div>
                                <textarea
                                    value={details}
                                    onChange={(e) => setDetails(e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '320px',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '14px',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div className="ooda-tabs">
                                <button
                                    type="button"
                                    key="activity"
                                    className={`ooda-tab ${activeTab === 'activity' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('activity')}
                                >
                                    📋 Activities
                                </button>
                                <button
                                    type="button"
                                    key="weekly"
                                    className={`ooda-tab ${activeTab === 'weekly' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('weekly')}
                                >
                                    📝 User Note
                                </button>
                                <button
                                    type="button"
                                    key="ai"
                                    className={`ooda-tab ${activeTab === 'ai' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('ai')}
                                >
                                    🤖 AI 數據
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="ooda-tab-content">
                                {activeTab === 'ai' && (
                                    <div className="ooda-ai-insight">
                                        <div className="ooda-ai-actions" style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                type="button"
                                                className="ooda-ai-generate-btn"
                                                onClick={handleGenerateInsight}
                                                disabled={loadingAI}
                                                style={{ flex: 1 }}
                                            >
                                                {loadingAI ? '✨ 分析中...' : '🪄 生成 AI 洞察'}
                                            </button>
                                            <button
                                                type="button"
                                                className="ooda-ai-generate-btn"
                                                onClick={() => setShowEmailComposer(true)}
                                                style={{
                                                    flex: 1,
                                                    background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
                                                    color: 'white'
                                                }}
                                            >
                                                🤖 AI 建議郵件
                                            </button>
                                        </div>
                                        <div className="ooda-ai-result">
                                            <textarea
                                                ref={textareaRef}
                                                className="ooda-ai-editor"
                                                value={aiInsight}
                                                onChange={(e) => setAiInsight(e.target.value)}
                                                placeholder="AI 洞察結果將顯示於此..."
                                                readOnly={loadingAI}
                                            />
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'weekly' && (
                                    <div className="ooda-weekly">
                                        {/* Add Note Button */}
                                        <button
                                            type="button"
                                            className="ooda-add-note-btn"
                                            onClick={() => setShowAddNote(!showAddNote)}
                                        >
                                            {showAddNote ? '✕ Cancel' : '+ Add Note'}
                                        </button>

                                        {/* Add Note Form */}
                                        {showAddNote && (
                                            <div className="ooda-add-note-form">
                                                <input
                                                    type="text"
                                                    placeholder="週報標題 (例: 週報 - W52)"
                                                    value={newNoteTitle}
                                                    onChange={(e) => setNewNoteTitle(e.target.value)}
                                                    className="ooda-note-input"
                                                />
                                                <textarea
                                                    placeholder="週報內容..."
                                                    value={newNoteContent}
                                                    onChange={(e) => setNewNoteContent(e.target.value)}
                                                    rows={4}
                                                    className="ooda-note-textarea"
                                                />
                                                <button
                                                    type="button"
                                                    className="ooda-submit-note-btn"
                                                    onClick={handleAddNote}
                                                    disabled={submittingNote}
                                                >
                                                    {submittingNote ? '提交中...' : '提交週報'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Notes List */}
                                        {loadingNotes ? (
                                            <div className="ooda-loading">載入中...</div>
                                        ) : weeklyNotes.length === 0 ? (
                                            <div className="ooda-empty">尚無週報記錄</div>
                                        ) : (
                                            <div className="ooda-notes-list">
                                                {weeklyNotes.map(note => (
                                                    <div key={note.id} className="ooda-note-item">
                                                        <div className="ooda-note-header">
                                                            <span className="ooda-note-title">📊 {note.title}</span>
                                                            <span className="ooda-note-date">{note.date}</span>
                                                        </div>
                                                        <div className="ooda-note-content">{note.note}</div>
                                                        <div className="ooda-note-author">— {note.author}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {activeTab === 'activity' && (
                                    <div className="ooda-activity-section">
                                        {/* Activity Sub Tabs */}
                                        <div className="ooda-sub-tabs">
                                            <button
                                                type="button"
                                                className={`ooda-sub-tab ${activitySubTab === 'task' ? 'active' : ''}`}
                                                onClick={() => setActivitySubTab('task')}
                                            >
                                                ✅ Task
                                            </button>
                                            <button
                                                type="button"
                                                className={`ooda-sub-tab ${activitySubTab === 'event' ? 'active' : ''}`}
                                                onClick={() => setActivitySubTab('event')}
                                            >
                                                🗓️ Event
                                            </button>
                                        </div>

                                        {/* Task Sub Tab */}
                                        {activitySubTab === 'task' && (
                                            <div className="ooda-sub-content">
                                                <button
                                                    type="button"
                                                    className="ooda-add-note-btn"
                                                    onClick={() => setShowAddTask(!showAddTask)}
                                                >
                                                    {showAddTask ? '✕ 取消' : '+ 新增任務'}
                                                </button>
                                                {showAddTask && (
                                                    <div className="ooda-add-note-form">
                                                        <input
                                                            type="text"
                                                            placeholder="任務標題"
                                                            value={newTaskTitle}
                                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                                            className="ooda-note-input"
                                                        />

                                                        <input
                                                            type="date"
                                                            placeholder="完成日期"
                                                            value={newTaskDueDate}
                                                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                                                            className="ooda-note-input"
                                                        />
                                                        <textarea
                                                            placeholder="任務說明..."
                                                            value={newTaskMessage}
                                                            onChange={(e) => setNewTaskMessage(e.target.value)}
                                                            rows={4}
                                                            className="ooda-note-textarea"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="ooda-submit-note-btn"
                                                            onClick={handleAddTask}
                                                            disabled={submittingTask}
                                                        >
                                                            {submittingTask ? '提交中...' : '✅ 建立任務'}
                                                        </button>
                                                    </div>
                                                )}
                                                {loadingTasks ? (
                                                    <div className="ooda-loading">載入中...</div>
                                                ) : tasks.length === 0 ? (
                                                    <div className="ooda-empty">尚無任務</div>
                                                ) : (
                                                    <div className="ooda-notes-list">
                                                        {tasks.map(task => (
                                                            <div key={task.id} className="ooda-note-item">
                                                                <div className="ooda-note-header">
                                                                    <span className="ooda-note-title">✅ {task.title}</span>
                                                                    <span className="ooda-note-date">到期: {task.dueDate}</span>
                                                                </div>
                                                                <div className="ooda-note-content">優先級: {task.priority} | 狀態: {task.status}</div>
                                                                <div className="ooda-note-content">{task.message}</div>
                                                                <div className="ooda-note-author">負責人: {task.assignee}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {activitySubTab === 'event' && (
                                            <div className="ooda-sub-content">
                                                <button
                                                    type="button"
                                                    className="ooda-add-note-btn"
                                                    onClick={() => setShowAddEvent(!showAddEvent)}
                                                >
                                                    {showAddEvent ? '✕ 取消' : '+ 新增行程'}
                                                </button>
                                                {showAddEvent && (
                                                    <div className="ooda-add-note-form">
                                                        <input
                                                            type="text"
                                                            placeholder="行程標題"
                                                            value={newEventTitle}
                                                            onChange={(e) => setNewEventTitle(e.target.value)}
                                                            className="ooda-note-input"
                                                        />
                                                        <input
                                                            type="date"
                                                            placeholder="日期"
                                                            value={newEventDate}
                                                            onChange={(e) => setNewEventDate(e.target.value)}
                                                            className="ooda-note-input"
                                                        />
                                                        <textarea
                                                            placeholder="行程備註..."
                                                            value={newEventMessage}
                                                            onChange={(e) => setNewEventMessage(e.target.value)}
                                                            rows={4}
                                                            className="ooda-note-textarea"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="ooda-submit-note-btn"
                                                            onClick={handleAddEvent}
                                                            disabled={submittingEvent}
                                                        >
                                                            {submittingEvent ? '提交中...' : '📅 建立行程'}
                                                        </button>
                                                    </div>
                                                )}
                                                {loadingEvents ? (
                                                    <div className="ooda-loading">載入中...</div>
                                                ) : events.length === 0 ? (
                                                    <div className="ooda-empty">尚無行程記錄</div>
                                                ) : (
                                                    <div className="ooda-activity-items">
                                                        {events.map(event => (
                                                            <div key={event.id} className="ooda-activity-item">
                                                                <div className="ooda-activity-header">
                                                                    <span className="ooda-activity-title">🗓️ {event.title}</span>
                                                                    <span className="ooda-activity-date">{event.date}</span>
                                                                </div>
                                                                <div className="ooda-activity-message">{event.message}</div>
                                                                <div className="ooda-activity-meta">建立者: {event.author}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Middle Column - Orient */}
                        <div className="ooda-column ooda-orient">
                            <h2 className="ooda-section-title">Orient - 購買中心矩陣</h2>

                            {/* 2x2 Matrix */}
                            <div className="ooda-matrix">
                                <DroppableCell
                                    id="champion"
                                    header="推進者 Champion"
                                    contacts={getContactsByCategory('champion')}
                                />
                                <DroppableCell
                                    id="blocker"
                                    header="阻礙者 Blocker"
                                    contacts={getContactsByCategory('blocker')}
                                />
                                <DroppableCell
                                    id="low_priority"
                                    header="低優先級 Low Priority"
                                    contacts={getContactsByCategory('low_priority')}
                                />
                                <DroppableCell
                                    id="supporter"
                                    header="支持者 Supporter"
                                    contacts={getContactsByCategory('supporter')}
                                />
                            </div>

                            {/* Unassigned Contacts */}
                            <div className="ooda-unassigned">
                                <h3 className="ooda-subsection-title">未分類聯繫人</h3>
                                <UnassignedContactList contacts={unassignedContacts} />
                            </div>

                            {/* Opportunity Scorecard */}
                            <OpportunityScorecard
                                opportunityId={opportunity.id}
                                initialChecks={scorecardChecks}
                                onScoreChange={handleScoreChange}
                            />
                        </div>
                    </div>
                </div>
            </div>
            {
                ReactDOM.createPortal(
                    <DragOverlay dropAnimation={null}>
                        {activeContact ? (
                            <div
                                className="ooda-contact-chip"
                                style={{
                                    cursor: 'grabbing',
                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                                    transform: 'scale(1.05)',
                                    zIndex: 99999,
                                    pointerEvents: 'none'
                                }}
                            >
                                <span>{activeContact.name}</span>
                            </div>
                        ) : null}
                    </DragOverlay>,
                    document.body
                )
            }
            {/* Pain Sheet Modal */}
            {
                painSheetContact && (
                    <PainSheet
                        opportunityId={opportunity.id}
                        contactId={painSheetContact.internalId || painSheetContact.id}
                        contactName={painSheetContact.name}
                        contactTitle={painSheetContact.title}
                        onClose={closePainSheet}
                    />
                )
            }

            {/* Email Composer Modal */}
            {showEmailComposer && (
                <EmailComposerModal
                    opportunityId={opportunity.id}
                    opportunityTitle={opportunity.title}
                    opportunityStatus={opportunity.statusText}
                    opportunityAmount={opportunity.amount}
                    opportunityProbability={opportunity.probability}
                    opportunityCloseDate={opportunity.closeDate}
                    opportunityCustomer={opportunity.customer}
                    opportunityCustomerId={opportunity.customerId}
                    opportunitySalesRep={opportunity.salesRep}
                    contacts={contacts.map(c => ({
                        id: c.id,
                        internalId: c.internalId || c.id,
                        name: c.name,
                        title: c.title,
                        email: c.email || ''
                    }))}
                    buyingCenter={contacts}
                    weeklyNotes={weeklyNotes}
                    activities={{
                        emails: emails,
                        tasks: tasks,
                        events: events
                    }}
                    scorecardData={scorecardChecks}
                    formData={formData}
                    onClose={() => setShowEmailComposer(false)}
                    onSuccess={() => {
                        // Email sent
                    }}
                />
            )}
        </DndContext >
    );
}
