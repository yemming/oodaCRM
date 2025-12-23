
import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import type { Opportunity, UserNote, EmailRecord, TaskRecord, EventRecord, ContactRecord } from '../services/api';
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
import { EmailComposerInline } from './EmailComposerInline';
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';



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

const AiSparkIcon = () => (
    <svg className="ooda-ai-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', marginTop: '-2px' }}>
        <path d="M7 2L9 7L14 9L9 11L7 16L5 11L0 9L5 7L7 2Z" fill="currentColor" />
        <path d="M18 10L19.5 13.5L23 15L19.5 16.5L18 20L16.5 16.5L13 15L16.5 13.5L18 10Z" fill="currentColor" opacity="0.8" />
    </svg>
);

export function OodaAnalysisPage({ opportunity, onClose }: OodaAnalysisPageProps) {
    const [activeTab, setActiveTab] = useState<'ai' | 'weekly' | 'activity'>('activity');
    const [activitySubTab, setActivitySubTab] = useState<'all' | 'task' | 'event'>('all'); // Default to 'all'
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
    // Combined state for all analysis types
    const [analysisData, setAnalysisData] = useState<{
        discovery: string;
        insight: string;
        jep: string;
    }>({
        discovery: '',
        insight: '',
        jep: ''
    });
    const [, setAnalysisLoaded] = useState(false);

    // Jokes for loading state
    const [currentJokeIndex, setCurrentJokeIndex] = useState(0);
    const jokes = [
        "為什麼業務員喜歡雨天？\n因為客戶都在家。",
        "老闆對員工說：『我們需要一個負責的人。』\n員工：『那就是我！每次出事大家都說是我負責的。』",
        "CRM 系統就像健身房會員卡，買了不代表你會變壯，你得去用它！",
        "成功的業務員有兩個特質：\n一是記憶力好，二是... 呃，我忘記第二個是什麼了。",
        "AI 正在努力閱讀您的資料，就像您閱讀合約一樣仔細...",
        "別擔心，AI 不會搶走您的工作，但會用 AI 的人可能會喔！",
        "正在替您準備絕佳的洞察，這比泡一杯好咖啡還需要時間..."
    ];

    // Cycle jokes when loading
    useEffect(() => {
        let interval: any;
        if (loadingAI) {
            setCurrentJokeIndex(0); // Reset to first joke
            interval = setInterval(() => {
                setCurrentJokeIndex(prev => (prev + 1) % jokes.length);
            }, 4000); // Change every 4 seconds
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [loadingAI]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea based on content (if needed, though we use Markdown now)
    // We can keep this if we revert to textarea, but for now it might be unused.
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [analysisData]);

    // Generate AI Insight Handler
    const handleGenerateInsight = async () => {
        // Just switch tab if already has data? No, this function is for the "Regenerate" action now.
        // We will call this from the UI button.
        setLoadingAI(true);
        // Don't clear data immediately, let user see old data while loading?
        // Or show loading indicator overlay.

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
                    activities: {
                        emails: [],
                        tasks: tasks,
                        events: events
                    } as {
                        emails: EmailRecord[];
                        tasks: TaskRecord[];
                        events: EventRecord[];
                    },
                    scorecardData: { probability, scorecardChecks }
                }
            );

            // Call N8N
            const result = await callN8N(payload);

            if (!result.success) {
                // Show error in specific tab? Or toast?
                // For now, simple alert or console, or set error text in data?
                // Better to throw so catch block handles it
                throw new Error(result.error || 'AI 分析請求失敗');
            }

            // Extract text from response
            const insightText = extractTextFromN8NResponse(result.data);

            // Update state
            const newData = { ...analysisData, insight: insightText };
            setAnalysisData(newData);

            // Save to NetSuite
            const saveResult = await saveOodaAnalysis(
                opportunity.id,
                JSON.stringify(newData), // Save full object
                contacts,
                payload
            );

            if (!saveResult.success) {
                console.warn('Save Analysis Failed', saveResult.error);
            }

        } catch (error) {
            console.error('AI Insight Error:', error);
            // Ideally show error notification
            alert('❌ 分析請求發送失敗: ' + String(error));
        } finally {
            setLoadingAI(false);
        }
    };

    const handleGenerateJEP = async () => {
        setLoadingAI(true);
        // setAiInsight('正在生成 JEP (Joint Engage Plan)...'); // No longer needed

        try {
            // Import n8nApi dynamically
            const { callN8N, createJEPPayload, extractTextFromN8NResponse } = await import('../services/n8nApi');

            // Create payload
            const payload = createJEPPayload(
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
                    activities: {
                        emails: emails,
                        tasks: tasks,
                        events: events
                    },
                    scorecardData: { probability, scorecardChecks }
                }
            );

            // Call N8N
            const result = await callN8N(payload);

            if (!result.success) {
                throw new Error(result.error || 'JEP 生成失敗');
            }

            // Extract text from response
            const insightText = extractTextFromN8NResponse(result.data);

            // Update state
            const newData = { ...analysisData, jep: insightText };
            setAnalysisData(newData);

            // Save to NetSuite
            await saveOodaAnalysis(
                opportunity.id,
                JSON.stringify(newData),
                contacts,
                payload
            );

        } catch (error) {
            console.error('JEP Error:', error);
            alert('❌ JEP 生成失敗: ' + String(error));
        } finally {
            setLoadingAI(false);
        }
    };

    const handleDiscoveryCall = async () => {
        setLoadingAI(true);
        // setAiInsight('正在進行 Discovery 調研 (分析商機、產業、競品)...'); // No longer needed

        try {
            // Import n8nApi dynamically
            const { callN8N, createDiscoveryPayload, extractTextFromN8NResponse } = await import('../services/n8nApi');

            // Create payload
            const payload = createDiscoveryPayload(
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
                contacts // Pass contacts for title analysis
            );

            // Call N8N
            const result = await callN8N(payload);

            if (!result.success) {
                throw new Error(result.error || 'Discovery 調研失敗');
            }

            // Extract text from response
            const insightText = extractTextFromN8NResponse(result.data);

            // Update state
            const newData = { ...analysisData, discovery: insightText };
            setAnalysisData(newData);

            // Save to NetSuite
            await saveOodaAnalysis(
                opportunity.id,
                JSON.stringify(newData),
                contacts,
                payload
            );

        } catch (error) {
            console.error('Discovery Call Error:', error);
            alert('❌ 調研請求失敗: ' + String(error));
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
                            try {
                                const parsed = JSON.parse(analysisResult.analysis.insight);
                                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                                    setAnalysisData({
                                        discovery: parsed.discovery || '',
                                        insight: parsed.insight || '',
                                        jep: parsed.jep || ''
                                    });
                                } else {
                                    // Legacy: treat entire string as 'insight'
                                    setAnalysisData(prev => ({ ...prev, insight: analysisResult.analysis!.insight }));
                                }
                            } catch (e) {
                                // Not JSON: treat as legacy 'insight'
                                setAnalysisData(prev => ({ ...prev, insight: analysisResult.analysis!.insight }));
                            }
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
            loadData().finally(() => setLoadingAI(false));
        }
    }, [opportunity.id, contactsLoaded]); // Removed loadingAI dependency to prevent loops

    // Weekly notes state
    const [weeklyNotes, setWeeklyNotes] = useState<UserNote[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [notesLoaded, setNotesLoaded] = useState(false);
    const [showAddNote, setShowAddNote] = useState(false);

    // New state for AI tab mode: 'insight' or 'email'
    const [aiTabMode, setAiTabMode] = useState<'insight' | 'email'>('insight');
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteContent, setNewNoteContent] = useState('');
    const [submittingNote, setSubmittingNote] = useState(false);

    // New state to track active AI action for button highlighting
    const [aiActiveType, setAiActiveType] = useState<'discovery' | 'insight' | 'email' | 'jep'>('discovery');

    // Keep emails state for AI context or Composer, even if empty
    // Keep emails state for AI context or Composer, even if empty
    const [emails, setEmails] = useState<EmailRecord[]>([]);
    const [loadingEmails, setLoadingEmails] = useState(false);
    const [emailsLoaded, setEmailsLoaded] = useState(false);

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
            alert('新增進程失敗: ' + (result.error || '未知錯誤'));
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
            setLoadingTasks(false);
            setTasksLoaded(true);
        }
    };

    const loadEmails = async () => {
        if (loadingEmails) return;
        setLoadingEmails(true);
        try {
            // Dynamically import API if needed, but it's already imported
            const { fetchEmails } = await import('../services/api');
            const result = await fetchEmails(opportunity.id);
            if (result.success && result.emails) {
                setEmails(result.emails);
            }
        } catch (error) {
            console.error('Failed to load emails:', error);
        } finally {
            setLoadingEmails(false);
            setEmailsLoaded(true);
        }
    };

    // Load data when tab changes
    useEffect(() => {
        if (activeTab === 'activity') {
            if (activitySubTab === 'all') {
                if (!tasksLoaded && !loadingTasks) loadTasks();
                if (!eventsLoaded && !loadingEvents) loadEvents();
                if (!emailsLoaded && !loadingEmails) loadEmails();
            }
            else if (activitySubTab === 'task' && !tasksLoaded && !loadingTasks) { loadTasks(); }
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
    // Form states for NetSuite fields
    const [probability, setProbability] = useState(opportunity.probability || 0);

    // Scorecard State
    const [scorecardChecks, setScorecardChecks] = useState<Record<string, boolean>>({});

    const handleScoreChange = (score: number, checks: Record<string, boolean>) => {
        setProbability(score);
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
                JSON.stringify(analysisData), // Use full analysis object
                contactsToSave, // Updated contacts
                { probability: probability, scorecardChecks } // Merge checks into snapshot
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
                probability,
                scorecardChecks
            );

            // Save Details (Memo)
            await updateOpportunityMemo(opportunity.id, details);

            console.log('✅ Saved:', { contacts: contacts.length, probability: probability });
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



    const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

    const getActivityUrl = (type: string, id: string) => {
        if (type === 'task') return `/app/crm/calendar/task.nl?id=${id}`;
        if (type === 'event') return `/app/crm/calendar/event.nl?id=${id}`;
        if (type === 'email') return `/app/crm/common/crmmessage.nl?id=${id}`;
        if (type === 'note') return `/app/crm/common/note.nl?id=${id}`;
        return '#';
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
                {contact.title && (
                    <span className="ooda-contact-chip-title">{contact.title}</span>
                )}
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
                            <div className="ooda-kpi-card">
                                <span className="ooda-label">客戶</span>
                                <a
                                    href={`/app/common/entity/custjob.nl?id=${opportunity.customerId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ooda-value text-blue-600 hover:underline"
                                    style={{ fontSize: '0.9rem' }}
                                >
                                    {opportunity.customer}
                                </a>
                            </div>
                            <div className="ooda-kpi-card">
                                <span className="ooda-label">預計金額</span>
                                <span className="ooda-value ooda-value-success">
                                    ${opportunity.amount.toLocaleString()}
                                </span>
                            </div>
                            <div className="ooda-kpi-card">
                                <span className="ooda-label">預計成案日</span>
                                <span className="ooda-value">{opportunity.closeDate}</span>
                            </div>
                            <div className="ooda-kpi-card">
                                <span className="ooda-label">成交機率</span>
                                <span className="ooda-value ooda-value-accent">{probability}%</span>
                            </div>
                        </div>
                        <div className="ooda-header-right">
                            <button
                                className={`ooda-save-btn ${saveSuccess === true ? 'success' : saveSuccess === false ? 'error' : ''}`}
                                onClick={handleSaveContacts}
                                disabled={isSaving}
                                style={{ marginLeft: '12px' }}
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
                            <h2 className="ooda-section-title">Observe - 態勢觀察</h2>

                            {/* Details / Memo Section */}
                            <div className="ooda-details-section" style={{ marginBottom: '15px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#475569' }}>BANT(Budget/Authority/Need/Timing)</label>
                                </div>
                                <textarea
                                    value={details}
                                    onChange={(e) => setDetails(e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '220px',
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
                                    交涉動態
                                </button>
                                <button
                                    type="button"
                                    key="weekly"
                                    className={`ooda-tab ${activeTab === 'weekly' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('weekly')}
                                >
                                    進程復盤
                                </button>
                                <button
                                    type="button"
                                    key="ai"
                                    className={`ooda-tab ${activeTab === 'ai' ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveTab('ai');
                                        setAiActiveType('discovery');
                                        setAiTabMode('insight');
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <AiSparkIcon />
                                        AI 教練
                                    </span>
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="ooda-tab-content">
                                {activeTab === 'ai' && (
                                    <div className="ooda-ai-insight">
                                        <div className="ooda-sub-tabs">
                                            <button
                                                type="button"
                                                className={`ooda-sub-tab ${aiActiveType === 'discovery' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setAiActiveType('discovery');
                                                    setAiTabMode('insight');
                                                }}
                                                disabled={loadingAI}
                                            >
                                                公司背景調查
                                            </button>
                                            <button
                                                type="button"
                                                className={`ooda-sub-tab ${aiActiveType === 'insight' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setAiActiveType('insight');
                                                    setAiTabMode('insight');
                                                }}
                                                disabled={loadingAI}
                                            >
                                                專案洞察
                                            </button>
                                            <button
                                                type="button"
                                                className={`ooda-sub-tab ${aiActiveType === 'email' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setAiActiveType('email');
                                                    setAiTabMode('email');
                                                }}
                                            >
                                                建議郵件
                                            </button>
                                            <button
                                                type="button"
                                                className={`ooda-sub-tab ${aiActiveType === 'jep' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setAiActiveType('jep');
                                                    setAiTabMode('insight');
                                                }}
                                                disabled={loadingAI}
                                            >
                                                生成 JEP
                                            </button>
                                        </div>

                                        {/* Conditional Rendering: Insight Textarea or Email Composer */}
                                        {aiTabMode === 'insight' ? (
                                            <div className="ooda-ai-result">
                                                {loadingAI ? (
                                                    <div className="ooda-loading" style={{ flexDirection: 'column', gap: '15px' }}>
                                                        <div className="loading-spinner"></div>
                                                        <div className="ooda-loading-text" style={{
                                                            textAlign: 'center',
                                                            maxWidth: '80%',
                                                            lineHeight: '1.6',
                                                            fontStyle: 'italic',
                                                            color: '#555',
                                                            whiteSpace: 'pre-line',
                                                            minHeight: '60px',
                                                            animation: 'fadeIn 0.5s ease-in-out'
                                                        }}>
                                                            {jokes[currentJokeIndex]}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
                                                            AI 正在努力運算中，請稍候...
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {analysisData[aiActiveType as keyof typeof analysisData] ? (
                                                            <div className="ooda-ai-markdown-content">
                                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                    {analysisData[aiActiveType as keyof typeof analysisData]}
                                                                </ReactMarkdown>
                                                            </div>
                                                        ) : (
                                                            <div className="ooda-empty-state" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                                                點擊下方按鈕開始生成分析報告
                                                            </div>
                                                        )}

                                                        {/* Regenerate / Generate Button */}
                                                        <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                                                            <button
                                                                type="button"
                                                                className="ooda-ai-generate-btn active"
                                                                style={{ padding: '8px 20px' }}
                                                                onClick={() => {
                                                                    if (aiActiveType === 'discovery') handleDiscoveryCall();
                                                                    else if (aiActiveType === 'insight') handleGenerateInsight();
                                                                    else if (aiActiveType === 'jep') handleGenerateJEP();
                                                                }}
                                                            >
                                                                {analysisData[aiActiveType as keyof typeof analysisData] ? '重新生成' : '開始生成'}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <EmailComposerInline
                                                opportunityId={opportunity.id}
                                                opportunityTitle={opportunity.title}
                                                opportunityStatus={opportunity.status}
                                                opportunityAmount={opportunity.amount}
                                                opportunityProbability={opportunity.probability}
                                                opportunityCloseDate={opportunity.closeDate}
                                                opportunityCustomer={opportunity.customer}
                                                opportunityCustomerId={opportunity.customerId}
                                                opportunitySalesRep={opportunity.salesRep}
                                                contacts={contacts as ContactRecord[]}
                                                buyingCenter={contacts as ContactRecord[]} // Using contacts array
                                                weeklyNotes={weeklyNotes}
                                                activities={{
                                                    emails: emails,
                                                    tasks: tasks,
                                                    events: events
                                                }}
                                                scorecardData={{ probability, scorecardChecks }}
                                                observation={details}
                                                onSuccess={() => {
                                                    // setAiInsight(prev => prev + '\n\n郵件已發送成功！'); 
                                                    // Instead of appending text, maybe just switch tab or alert?
                                                    // Let's just switch to insight tab for now
                                                    alert('郵件已發送成功！');
                                                    setAiTabMode('insight');
                                                }}
                                            />
                                        )}
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
                                            {showAddNote ? '取消' : '新增進程'}
                                        </button>

                                        {/* Add Note Form */}
                                        {showAddNote && (
                                            <div className="ooda-add-note-form">
                                                <input
                                                    type="text"
                                                    placeholder="進程標題"
                                                    value={newNoteTitle}
                                                    onChange={(e) => setNewNoteTitle(e.target.value)}
                                                    className="ooda-note-input"
                                                />
                                                <textarea
                                                    placeholder="進程內容..."
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
                                                    {submittingNote ? '提交中...' : '提交進程'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Notes List */}
                                        {loadingNotes ? (
                                            <div className="ooda-loading">載入中...</div>
                                        ) : weeklyNotes.length === 0 ? (
                                            <div className="ooda-empty">尚無進程記錄</div>
                                        ) : (
                                            <div className="ooda-timeline-container no-line" style={{ paddingLeft: 0, borderLeft: 'none', width: '100%' }}>
                                                {weeklyNotes.map(note => (
                                                    <div
                                                        key={`note-${note.id}`}
                                                        className="ooda-timeline-item"
                                                        onClick={() => window.open(getActivityUrl('note', note.id), '_blank')}
                                                        style={{ cursor: 'pointer', marginLeft: 0 }}
                                                    >
                                                        {/* Icon */}
                                                        <div className="ooda-timeline-icon note" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                                <polyline points="10 9 9 9 8 9"></polyline>
                                                            </svg>
                                                        </div>

                                                        {/* Content Card */}
                                                        <div className="ooda-timeline-content">
                                                            <div style={{ marginBottom: '4px' }}>
                                                                <span className="ooda-timeline-badge" style={{ background: '#f1f5f9', color: '#475569' }}>進程覆盤</span>
                                                            </div>
                                                            <div className="ooda-timeline-header">
                                                                <h4 className="ooda-timeline-subject">{note.title}</h4>
                                                                <span className="ooda-timeline-date">{note.date}</span>
                                                            </div>
                                                            <p className="ooda-timeline-body">
                                                                {stripHtml(note.note || '')}
                                                            </p>
                                                            <div className="ooda-timeline-footer">
                                                                <span className="ooda-avatar-circle">
                                                                    {note.author?.charAt(0).toUpperCase() || 'U'}
                                                                </span>
                                                                <span>{note.author}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {activeTab === 'activity' && (
                                    <div className="ooda-activity-section">
                                        {/* Helper Functions */}
                                        {(() => {
                                            // Define helpers here if needed, or better, move them outside the render loop entirely
                                            // But since we are inside the component, we can just define them before the return or inside this block if scoped correctly.
                                            // Ideally they should be at the top of the component.
                                            // For now, let's define them here and attach them to the scope or just reuse if we move them up.
                                            return null;
                                        })()}

                                        {/* Activity Sub Tabs */}
                                        <div className="ooda-sub-tabs">
                                            <button
                                                type="button"
                                                className={`ooda-sub-tab ${activitySubTab === 'all' ? 'active' : ''}`}
                                                onClick={() => setActivitySubTab('all')}
                                            >
                                                活動歷程
                                            </button>
                                            <button
                                                type="button"
                                                className={`ooda-sub-tab ${activitySubTab === 'task' ? 'active' : ''}`}
                                                onClick={() => setActivitySubTab('task')}
                                            >
                                                執行項目
                                            </button>
                                            <button
                                                type="button"
                                                className={`ooda-sub-tab ${activitySubTab === 'event' ? 'active' : ''}`}
                                                onClick={() => setActivitySubTab('event')}
                                            >
                                                商務會晤
                                            </button>
                                        </div>

                                        {/* Task Sub Tab */}

                                        {/* All Timeline View */}
                                        {activitySubTab === 'all' && (
                                            <div className="ooda-timeline-view">
                                                {/* Combine and Sort Activities */}
                                                {(() => {
                                                    const allActivities = [
                                                        ...tasks.map(t => ({ ...t, type: 'task' as const, date: t.dueDate || '9999-12-31' })), // Use due date for tasks
                                                        ...events.map(e => ({ ...e, type: 'event' as const, date: e.date || '1970-01-01' })),
                                                        ...emails.map(e => ({ ...e, type: 'email' as const, date: e.date || '1970-01-01' }))
                                                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                                    if (allActivities.length === 0) {
                                                        return <div className="ooda-empty">尚無任何活動記錄</div>;
                                                    }

                                                    return (
                                                        <div className="ooda-timeline-container">
                                                            {/* Vertical Line */}
                                                            <div className="ooda-timeline-line"></div>

                                                            {allActivities.map((item) => (
                                                                <div
                                                                    key={`${item.type}-${item.id}`}
                                                                    className="ooda-timeline-item"
                                                                    onClick={() => window.open(getActivityUrl(item.type, item.id), '_blank')}
                                                                    style={{ cursor: 'pointer' }}
                                                                    title="點擊查看詳細記錄"
                                                                >
                                                                    {/* Icon */}
                                                                    <div className={`ooda-timeline-icon ${item.type}`}>
                                                                        {item.type === 'task' ? (
                                                                            <svg viewBox="0 0 20 20" fill="currentColor">
                                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                            </svg>
                                                                        ) : item.type === 'event' ? (
                                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                                                <circle cx="12" cy="7" r="4"></circle>
                                                                            </svg>
                                                                        ) : (
                                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                                                                <polyline points="22,6 12,13 2,6"></polyline>
                                                                            </svg>
                                                                        )}
                                                                    </div>

                                                                    {/* Content Card */}
                                                                    <div className="ooda-timeline-content">
                                                                        <div style={{ marginBottom: '4px' }}>
                                                                            <span className="ooda-timeline-badge">
                                                                                {item.type === 'task' ? '執行項目' : item.type === 'event' ? '商務會晤' : '電子郵件'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="ooda-timeline-header">
                                                                            <h4 className="ooda-timeline-subject">
                                                                                {item.type === 'email' ? (item as any).subject : item.title}
                                                                            </h4>
                                                                            <span className="ooda-timeline-date">
                                                                                {item.date}
                                                                            </span>
                                                                        </div>
                                                                        <p className="ooda-timeline-body">
                                                                            {item.type === 'email' ? (
                                                                                stripHtml((item as any).body || '').substring(0, 100) + ((item as any).body?.length > 100 ? '...' : '')
                                                                            ) : (
                                                                                stripHtml((item as any).message || (item as any).note || '(無內容)')
                                                                            )}
                                                                        </p>
                                                                        <div className="ooda-timeline-footer">
                                                                            <span className="ooda-avatar-circle">
                                                                                {(item.type === 'task' ? (item as any).assignee : item.author)?.charAt(0).toUpperCase() || 'U'}
                                                                            </span>
                                                                            <span>
                                                                                {item.type === 'task' ? (item as any).assignee : item.author}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {activitySubTab === 'task' && (
                                            <div className="ooda-sub-content">
                                                <button
                                                    type="button"
                                                    className="ooda-add-note-btn"
                                                    onClick={() => setShowAddTask(!showAddTask)}
                                                >
                                                    {showAddTask ? '取消' : '新增任務'}
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
                                                            {submittingTask ? '提交中...' : '建立任務'}
                                                        </button>
                                                    </div>
                                                )}
                                                {loadingTasks ? (
                                                    <div className="ooda-loading">載入中...</div>
                                                ) : tasks.length === 0 ? (
                                                    <div className="ooda-empty">尚無任務</div>
                                                ) : (
                                                    <div className="ooda-timeline-container no-line" style={{ paddingLeft: 0, borderLeft: 'none' }}>
                                                        {tasks.map(task => (
                                                            <div
                                                                key={`task-${task.id}`}
                                                                className="ooda-timeline-item"
                                                                onClick={() => window.open(getActivityUrl('task', task.id), '_blank')}
                                                                style={{ cursor: 'pointer', marginLeft: 0 }}
                                                            >
                                                                {/* Icon */}
                                                                <div className="ooda-timeline-icon task">
                                                                    <svg viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>

                                                                {/* Content Card */}
                                                                <div className="ooda-timeline-content">
                                                                    <div style={{ marginBottom: '4px' }}>
                                                                        <span className="ooda-timeline-badge">執行項目</span>
                                                                    </div>
                                                                    <div className="ooda-timeline-header">
                                                                        <h4 className="ooda-timeline-subject">{task.title}</h4>
                                                                        <span className="ooda-timeline-date">{task.dueDate}</span>
                                                                    </div>
                                                                    <p className="ooda-timeline-body">
                                                                        優先級: {task.priority} | 狀態: {task.status}
                                                                        <br />
                                                                        {task.message}
                                                                    </p>
                                                                    <div className="ooda-timeline-footer">
                                                                        <span className="ooda-avatar-circle">
                                                                            {task.assignee?.charAt(0).toUpperCase() || 'U'}
                                                                        </span>
                                                                        <span>{task.assignee}</span>
                                                                    </div>
                                                                </div>
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
                                                    {showAddEvent ? '取消' : '新增行程'}
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
                                                            {submittingEvent ? '提交中...' : '建立行程'}
                                                        </button>
                                                    </div>
                                                )}
                                                {loadingEvents ? (
                                                    <div className="ooda-loading">載入中...</div>
                                                ) : events.length === 0 ? (
                                                    <div className="ooda-empty">尚無行程記錄</div>
                                                ) : (
                                                    <div className="ooda-timeline-container no-line" style={{ paddingLeft: 0, borderLeft: 'none' }}>
                                                        {events.map(event => (
                                                            <div
                                                                key={`event-${event.id}`}
                                                                className="ooda-timeline-item"
                                                                onClick={() => window.open(getActivityUrl('event', event.id), '_blank')}
                                                                style={{ cursor: 'pointer', marginLeft: 0 }}
                                                            >
                                                                {/* Icon */}
                                                                <div className="ooda-timeline-icon event">
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                                        <circle cx="12" cy="7" r="4"></circle>
                                                                    </svg>
                                                                </div>

                                                                {/* Content Card */}
                                                                <div className="ooda-timeline-content">
                                                                    <div style={{ marginBottom: '4px' }}>
                                                                        <span className="ooda-timeline-badge">商務會晤</span>
                                                                    </div>
                                                                    <div className="ooda-timeline-header">
                                                                        <h4 className="ooda-timeline-subject">{event.title}</h4>
                                                                        <span className="ooda-timeline-date">{event.date}</span>
                                                                    </div>
                                                                    <p className="ooda-timeline-body">
                                                                        {stripHtml(event.message || '')}
                                                                    </p>
                                                                    <div className="ooda-timeline-footer">
                                                                        <span className="ooda-avatar-circle">
                                                                            {event.author?.charAt(0).toUpperCase() || 'U'}
                                                                        </span>
                                                                        <span>{event.author}</span>
                                                                    </div>
                                                                </div>
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
                            <h2 className="ooda-section-title">Orient - 決策權力圖譜</h2>

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


        </DndContext >
    );
}
