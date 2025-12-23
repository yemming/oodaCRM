// src/services/api.ts
// NetSuite Integration Layer

export interface Opportunity {
    id: string;
    tranId?: string; // Transaction ID (e.g. 1286)
    title: string;
    customer: string;
    customerId: string;
    status: string;
    statusText: string;
    amount: number;
    probability: number;
    closeDate: string;
    salesRep: string;
    salesRepId: string;
    memo?: string; // Details field
}

interface NetSuiteContext {
    suiteletUrl: string;
    userId: string;
    userName: string;
    role: string;
    n8nAiUrl?: string; // Optional because local dev might not have it
    pageType?: 'kanban' | 'ocr_standalone'; // Default to 'kanban' if undefined
}

interface NetSuiteData {
    opportunities: Opportunity[];
    statusMapping: Record<string, number>;
}

declare global {
    interface Window {
        NETSUITE_CONTEXT?: NetSuiteContext;
        NETSUITE_DATA?: NetSuiteData;
    }
}

const isNetSuite = typeof window !== 'undefined' && window.NETSUITE_CONTEXT;

// Demo data for local development
const DEMO_OPPORTUNITIES: Opportunity[] = [
    { id: '1001', title: 'Acme Corp - ERP Implementation', customer: 'Acme Corp', customerId: '101', status: 'prospecting', statusText: 'Prospecting', amount: 150000, probability: 20, closeDate: '2024-03-15', salesRep: 'John Smith', salesRepId: '1' },
    { id: '1002', title: 'TechStart - Cloud Migration', customer: 'TechStart Inc', customerId: '102', status: 'qualification', statusText: 'Qualification', amount: 85000, probability: 40, closeDate: '2024-02-28', salesRep: 'Jane Doe', salesRepId: '2' },
    { id: '1003', title: 'GlobalTech - CRM Upgrade', customer: 'GlobalTech', customerId: '103', status: 'negotiation', statusText: 'Negotiation', amount: 220000, probability: 60, closeDate: '2024-01-31', salesRep: 'Bob Wilson', salesRepId: '3' },
    { id: '1004', title: 'InnovateCo - Data Analytics', customer: 'InnovateCo', customerId: '104', status: 'proposal', statusText: 'Proposal', amount: 175000, probability: 75, closeDate: '2024-02-15', salesRep: 'Alice Brown', salesRepId: '4', memo: 'Technical review pending' },
    { id: '1005', title: 'FutureBiz - Digital Transform', customer: 'FutureBiz Ltd', customerId: '105', status: 'closed_won', statusText: 'Closed Won', amount: 320000, probability: 100, closeDate: '2024-01-15', salesRep: 'John Smith', salesRepId: '1' },
    { id: '1006', title: 'SmartSolutions - AI Integration', customer: 'SmartSolutions', customerId: '106', status: 'prospecting', statusText: 'Prospecting', amount: 95000, probability: 15, closeDate: '2024-04-01', salesRep: 'Jane Doe', salesRepId: '2' },
];

/**
 * Fetch Opportunity data
 * In NetSuite: reads from window.NETSUITE_DATA (server-injected)
 * Locally: returns demo data
 */
export const fetchDashboardData = async (): Promise<Opportunity[]> => {
    if (isNetSuite && window.NETSUITE_DATA?.opportunities) {
        console.log('✅ NetSuite Mode - Using server-injected data');
        return window.NETSUITE_DATA.opportunities;
    }

    console.log('⚠️ Local Mode - Using demo data');
    await new Promise(resolve => setTimeout(resolve, 300));
    return DEMO_OPPORTUNITIES;
};

/**
 * Update Opportunity Status
 * Uses GET request with URL parameters to avoid CSRF issues
 */
export const updateOpportunityStatus = async (
    opportunityId: string,
    newStatus: string
): Promise<{ success: boolean; error?: string }> => {
    if (!isNetSuite) {
        console.log(`🔧[Local] Would update ${opportunityId} to ${newStatus} `);
        return { success: true };
    }

    try {
        console.log(`📡 Updating Opportunity ${opportunityId} to ${newStatus}...`);

        // Build URL with query parameters (GET request to avoid CSRF issues)
        const updateUrl = `${window.NETSUITE_CONTEXT!.suiteletUrl}&action=updateStatus&opportunityId=${opportunityId}&newStatus=${newStatus}`;

        console.log(`📡 Update URL: ${updateUrl} `);

        const response = await fetch(updateUrl, {
            method: 'GET',
            credentials: 'include'
        });

        const text = await response.text();
        console.log(`📡 Response: ${text.substring(0, 200)} `);

        // Try to parse as JSON
        try {
            const result = JSON.parse(text);
            if (result.success) {
                console.log(`✅ Updated successfully`);
            } else {
                console.error(`❌ Update failed: ${result.error} `);
            }
            return result;
        } catch {
            console.error(`❌ Response is not JSON: ${text.substring(0, 100)} `);
            return { success: false, error: 'Server returned non-JSON response' };
        }
    } catch (error) {
        console.error('❌ API Error:', error);
        return { success: false, error: String(error) };
    }
};

/**
 * Update Opportunity Memo (Details)
 */
export const updateOpportunityMemo = async (
    opportunityId: string,
    memo: string
): Promise<{ success: boolean; error?: string }> => {
    if (!isNetSuite) {
        console.log(`🔧[Local] Would update memo for ${opportunityId}: ${memo}`);
        return { success: true };
    }

    try {
        console.log(`📡 Updating Memo for ${opportunityId}...`);

        const scriptUrl = window.NETSUITE_CONTEXT!.suiteletUrl;

        // Use POST for larger text content
        const response = await fetch(scriptUrl, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updateMemo',
                opportunityId: opportunityId,
                memo: memo
            })
        });

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Server returned non-JSON response' };
        }
    } catch (error) {
        console.error('❌ API Error:', error);
        return { success: false, error: String(error) };
    }
};

export const getNetSuiteContext = (): NetSuiteContext | null => {
    return isNetSuite ? window.NETSUITE_CONTEXT! : null;
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

/**
 * User Note interface
 */
export interface UserNote {
    id: string;
    title: string;
    note: string;
    date: string;
    author: string;
}

export interface EventRecord {
    id: string;
    title: string;
    date: string;
    author: string;
    message: string;
}



/**
 * Fetch User Notes for an Opportunity
 */
export const fetchUserNotes = async (
    opportunityId: string
): Promise<{ success: boolean; notes?: UserNote[]; error?: string }> => {
    if (!isNetSuite) {
        console.log(`🔧[Local] Would fetch notes for ${opportunityId}`);
        // Return demo data
        return {
            success: true,
            notes: [
                { id: 'n1', title: '週報 - W52', note: '本週進度：完成需求訪談', date: '2024-01-22', author: 'Larry Nelson' },
                { id: 'n2', title: '週報 - W51', note: '客戶確認預算範圍', date: '2024-01-15', author: 'Larry Nelson' },
            ]
        };
    }

    try {
        const notesUrl = `${window.NETSUITE_CONTEXT!.suiteletUrl}&action=getNotes&opportunityId=${opportunityId}`;
        console.log(`📡 Fetching notes: ${notesUrl} `);

        const response = await fetch(notesUrl, {
            method: 'GET',
            credentials: 'include'
        });

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            console.error(`❌ Response is not JSON: ${text.substring(0, 100)} `);
            return { success: false, error: 'Server returned non-JSON response' };
        }
    } catch (error) {
        console.error('❌ API Error:', error);
        return { success: false, error: String(error) };
    }
};

/**
 * Add a User Note to an Opportunity (Weekly Report)
 */
export const addUserNote = async (
    opportunityId: string,
    title: string,
    noteContent: string
): Promise<{ success: boolean; noteId?: string; error?: string }> => {
    if (!isNetSuite) {
        console.log(`🔧[Local] Would add note to ${opportunityId}: ${title} `);
        return { success: true, noteId: 'demo-' + Date.now() };
    }

    try {
        const addNoteUrl = `${window.NETSUITE_CONTEXT!.suiteletUrl}&action=addNote&opportunityId=${opportunityId}&title=${encodeURIComponent(title)}&noteContent=${encodeURIComponent(noteContent)}`;
        console.log(`📡 Adding note: ${addNoteUrl} `);

        const response = await fetch(addNoteUrl, {
            method: 'GET',
            credentials: 'include'
        });

        const text = await response.text();
        try {
            const result = JSON.parse(text);
            if (result.success) {
                console.log(`✅ Note added successfully`);
            } else {
                console.error(`❌ Add note failed: ${result.error} `);
            }
            return result;
        } catch {
            console.error(`❌ Response is not JSON: ${text.substring(0, 100)} `);
            return { success: false, error: 'Server returned non-JSON response' };
        }
    } catch (error) {
        console.error('❌ API Error:', error);
        return { success: false, error: String(error) };
    }
};

// ============================================
// Activity Types (Email, Phone Call, Task)
// ============================================

export interface EmailRecord {
    id: string;
    subject: string;
    recipients: string;
    body: string;
    date: string;
    author: string;
}

export interface TaskRecord {
    id: string;
    title: string;
    priority: string;
    status: string;
    dueDate: string;
    assignee: string;
    message: string;
}

export interface EventRecord {
    id: string;
    title: string;
    date: string;
    author: string;
    message: string;
}

// Demo data for local development
const DEMO_EMAILS: EmailRecord[] = [
    { id: 'e1', subject: '報價確認', recipients: 'client@example.com', body: '請確認附件中的報價單', date: '2024-01-20', author: 'Larry Nelson' },
    { id: 'e2', subject: '會議邀請', recipients: 'team@example.com', body: '邀請您參加週一的需求討論會議', date: '2024-01-18', author: 'Larry Nelson' },
];

const DEMO_EVENTS: EventRecord[] = [
    { id: 'ev1', title: '需求確認會議', date: '2024-01-22', author: 'Larry Nelson', message: '與客戶確認詳細需求' }
];

const DEMO_TASKS: TaskRecord[] = [
    { id: 't1', title: '準備報價單', priority: 'High', status: 'In Progress', dueDate: '2024-01-25', assignee: 'Larry Nelson', message: '需要在本週五前完成' },
    { id: 't2', title: '安排現場拜訪', priority: 'Medium', status: 'Not Started', dueDate: '2024-02-01', assignee: 'Larry Nelson', message: '確認客戶方便的時間' },
];

/**
 * Fetch Emails for an Opportunity
 */
export const fetchEmails = async (
    opportunityId: string
): Promise<{ success: boolean; emails?: EmailRecord[]; error?: string }> => {
    if (!isNetSuite) {
        console.log(`🔧[Local] Would fetch emails for ${opportunityId}`);
        return { success: true, emails: DEMO_EMAILS };
    }

    try {
        const url = `${window.NETSUITE_CONTEXT!.suiteletUrl}&action=getEmails&opportunityId=${opportunityId}`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Server returned non-JSON response' };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }
};

/**
 * Add an Email to an Opportunity
 */
export const addEmail = async (
    opportunityId: string,
    subject: string,
    recipients: string,
    body: string
): Promise<{ success: boolean; emailId?: string; error?: string }> => {
    if (!isNetSuite) {
        console.log(`🔧[Local] Would add email to ${opportunityId}: ${subject} `);
        return { success: true, emailId: 'demo-' + Date.now() };
    }

    try {
        const url = `${window.NETSUITE_CONTEXT!.suiteletUrl}&action=addEmail&opportunityId=${opportunityId}&subject=${encodeURIComponent(subject)}&recipients=${encodeURIComponent(recipients)}&body=${encodeURIComponent(body)}`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Server returned non-JSON response' };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }
};



/**
 * Fetch Tasks for an Opportunity
 */
export const fetchTasks = async (
    opportunityId: string
): Promise<{ success: boolean; tasks?: TaskRecord[]; error?: string }> => {
    if (!isNetSuite) {
        console.log(`🔧[Local] Would fetch tasks for ${opportunityId}`);
        return { success: true, tasks: DEMO_TASKS };
    }

    try {
        const url = `${window.NETSUITE_CONTEXT!.suiteletUrl}&action=getTasks&opportunityId=${opportunityId}`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Server returned non-JSON response' };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }
};

/**
 * Fetch Events for an Opportunity
 */
export const fetchEvents = async (
    opportunityId: string
): Promise<{ success: boolean; events?: EventRecord[]; error?: string }> => {
    if (!isNetSuite) {
        console.log(`🔧[Local] Would fetch events for ${opportunityId}`);
        return { success: true, events: DEMO_EVENTS };
    }

    try {
        const url = `${window.NETSUITE_CONTEXT!.suiteletUrl}&action=getEvents&opportunityId=${opportunityId}`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Server returned non-JSON response' };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }
};

/**
 * Add an Event to an Opportunity
 */
export const addEvent = async (
    opportunityId: string,
    title: string,
    date: string,
    message: string
): Promise<{ success: boolean; eventId?: string; error?: string }> => {
    if (!isNetSuite) {
        console.log(`🔧[Local] Would add event to ${opportunityId}: ${title} `);
        return { success: true, eventId: 'demo-' + Date.now() };
    }

    try {
        const url = `${window.NETSUITE_CONTEXT!.suiteletUrl}&action=addEvent&opportunityId=${opportunityId}&title=${encodeURIComponent(title)}&date=${encodeURIComponent(date)}&message=${encodeURIComponent(message)}`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Server returned non-JSON response' };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }
};

/**
 * Add a Task to an Opportunity
 */
export const addTask = async (
    opportunityId: string,
    title: string,
    priority: string,
    dueDate: string,
    message: string
): Promise<{ success: boolean; taskId?: string; error?: string }> => {
    if (!isNetSuite) {
        console.log(`🔧[Local] Would add task to ${opportunityId}: ${title} `);
        return { success: true, taskId: 'demo-' + Date.now() };
    }

    try {
        const url = `${window.NETSUITE_CONTEXT!.suiteletUrl}&action=addTask&opportunityId=${opportunityId}&title=${encodeURIComponent(title)}&priority=${encodeURIComponent(priority)}&dueDate=${encodeURIComponent(dueDate)}&message=${encodeURIComponent(message)}`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Server returned non-JSON response' };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }
};

// ============================================
// OODA Analysis API
// ============================================

export interface OodaAnalysis {
    id: string;
    insight: string;
    buyingCenter: string; // JSON string
    snapshot?: string; // JSON string (Scorecard checks, probability, etc.)
    date: string;
}

export const saveOodaAnalysis = async (
    opportunityId: string,
    insight: string,
    buyingCenter: any,
    snapshot: any,
    type: string = 'AI Insight'
): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!isNetSuite) {
        console.log('[Local] Would save OODA Analysis', { opportunityId, insight });
        return { success: true, id: 'mock-analysis-id' };
    }

    try {
        const payload = {
            action: 'saveAnalysis',
            opportunityId,
            insight,
            buyingCenter: JSON.stringify(buyingCenter),
            snapshot: JSON.stringify(snapshot),
            type
        };

        // Use Suitelet URL
        const scriptUrl = window.NETSUITE_CONTEXT?.suiteletUrl || '';

        const response = await fetch(scriptUrl, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Invalid JSON response: ' + text.substring(0, 100) };
        }
    } catch (error) {
        console.error('Error saving analysis:', error);
        return { success: false, error: String(error) };
    }
};

export const fetchOodaAnalysis = async (opportunityId: string): Promise<{ success: boolean; analysis?: OodaAnalysis; error?: string }> => {
    if (!isNetSuite) {
        console.log('[Local] Would fetch OODA Analysis for', opportunityId);
        return { success: true };
    }

    try {
        const scriptUrl = window.NETSUITE_CONTEXT?.suiteletUrl || '';
        const url = `${scriptUrl}&action=getAnalysisHistory&opportunityId=${opportunityId}`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Invalid JSON response' };
        }
    } catch (error) {
        console.error('Error fetching analysis:', error);
        return { success: false, error: String(error) };
    }
};

// Contact Record Interface
export interface ContactRecord {
    id: string;
    internalId: string;
    name: string;
    title: string;
    email?: string;
    phone?: string;
}

/**
 * Fetch Contacts for a Customer (via Opportunity)
 */
export const fetchContacts = async (opportunityId: string): Promise<{ success: boolean; contacts?: ContactRecord[]; error?: string }> => {
    if (!isNetSuite) {
        console.log('[Local] Would fetch Contacts for Opportunity', opportunityId);
        // Return demo contacts for local development
        return {
            success: true,
            contacts: [
                { id: 'c1', internalId: 'c1', name: 'James Liu', title: '推進經理', email: 'james@example.com' },
                { id: 'c2', internalId: 'c2', name: 'Amy Kuo', title: '專案經理', email: 'amy@example.com' },
            ]
        };
    }

    try {
        const scriptUrl = window.NETSUITE_CONTEXT?.suiteletUrl || '';
        const url = `${scriptUrl}&action=getContacts&opportunityId=${opportunityId}`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Invalid JSON response', contacts: [] };
        }
    } catch (error) {
        console.error('Error fetching contacts:', error);
        return { success: false, error: String(error), contacts: [] };
    }
};

// Pain Sheet Interfaces
export interface PainSheetRow {
    id: string;
    reason: string;
    impact: string;
    capability: string;
}

export interface PainSheetData {
    pain: string;
    positionIndustry: string;
    productsServices: string;
    rows: PainSheetRow[];
}

/**
 * Save Pain Sheet for a Contact on an Opportunity
 */
export const savePainSheet = async (
    opportunityId: string,
    contactId: string,
    painData: PainSheetData
): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!isNetSuite) {
        console.log('[Local] Would save Pain Sheet', { opportunityId, contactId, painData });
        return { success: true, id: 'local-demo' };
    }

    try {
        const scriptUrl = window.NETSUITE_CONTEXT?.suiteletUrl || '';
        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'savePainSheet',
                opportunityId,
                contactId,
                painData
            })
        });

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Invalid JSON response' };
        }
    } catch (error) {
        console.error('Error saving pain sheet:', error);
        return { success: false, error: String(error) };
    }
};

/**
 * Fetch Pain Sheet for a Contact on an Opportunity
 */
export const fetchPainSheet = async (
    opportunityId: string,
    contactId: string
): Promise<{ success: boolean; painSheet?: PainSheetData | null; error?: string }> => {
    if (!isNetSuite) {
        console.log('[Local] Would fetch Pain Sheet', { opportunityId, contactId });
        return { success: true, painSheet: null };
    }

    try {
        const scriptUrl = window.NETSUITE_CONTEXT?.suiteletUrl || '';
        const url = `${scriptUrl}&action=getPainSheet&opportunityId=${opportunityId}&contactId=${contactId}`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Invalid JSON response' };
        }
    } catch (error) {
        console.error('Error fetching pain sheet:', error);
        return { success: false, error: String(error) };
    }
};

// ============================================
// Filter API Functions
// ============================================

export interface SalesRep {
    id: string;
    name: string;
    entityId: string;
}

export interface SalesTeam {
    id: string;
    name: string;
}

export interface OpportunityStatus {
    id: string;
    name: string;
}

/**
 * Fetch all Sales Representatives
 */
export const fetchSalesReps = async (): Promise<{ success: boolean; salesReps: SalesRep[]; error?: string }> => {
    if (!isNetSuite) {
        return {
            success: true,
            salesReps: [
                { id: '1', name: 'John Smith', entityId: 'jsmith' },
                { id: '2', name: 'Jane Doe', entityId: 'jdoe' },
                { id: '3', name: 'Bob Wilson', entityId: 'bwilson' },
                { id: '4', name: 'Alice Brown', entityId: 'abrown' },
            ]
        };
    }

    try {
        const scriptUrl = window.NETSUITE_CONTEXT!.suiteletUrl;
        const url = `${scriptUrl}&action=getSalesReps`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Invalid JSON response', salesReps: [] };
        }
    } catch (error) {
        console.error('Error fetching sales reps:', error);
        return { success: false, error: String(error), salesReps: [] };
    }
};

/**
 * Fetch all Sales Teams
 */
export const fetchSalesTeams = async (): Promise<{ success: boolean; salesTeams: SalesTeam[]; error?: string }> => {
    if (!isNetSuite) {
        return {
            success: true,
            salesTeams: [
                { id: '2477', name: 'AMO' },
                { id: '2475', name: 'Channel' },
                { id: '2476', name: 'Direct' },
            ]
        };
    }

    try {
        const scriptUrl = window.NETSUITE_CONTEXT!.suiteletUrl;
        const url = `${scriptUrl}&action=getSalesTeams`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Invalid JSON response', salesTeams: [] };
        }
    } catch (error) {
        console.error('Error fetching sales teams:', error);
        return { success: false, error: String(error), salesTeams: [] };
    }
};

/**
 * Fetch all Opportunity Statuses
 */
export const fetchStatuses = async (): Promise<{ success: boolean; statuses: OpportunityStatus[]; error?: string }> => {
    if (!isNetSuite) {
        return {
            success: true,
            statuses: [
                { id: '1', name: 'Prospecting' },
                { id: '2', name: 'Qualification' },
                { id: '3', name: 'Proposal' },
                { id: '4', name: 'Negotiation' },
                { id: '5', name: 'Closed Won' },
            ]
        };
    }

    try {
        const scriptUrl = window.NETSUITE_CONTEXT!.suiteletUrl;
        const url = `${scriptUrl}&action=getStatuses`;
        const response = await fetch(url, { method: 'GET', credentials: 'include' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Invalid JSON response', statuses: [] };
        }
    } catch (error) {
        console.error('Error fetching statuses:', error);
        return { success: false, error: String(error), statuses: [] };
    }
};

// ============================================
// Email Sending API
// ============================================

export interface SendEmailParams {
    opportunityId: string;
    recipientContactIds?: string[]; // Multiple contact IDs
    recipientEmails: string[];      // Multiple emails
    emailSubject: string;
    emailBody: string;
}

/**
 * Send an Email via NetSuite N/email module
 * The email will be attached to the Opportunity's Communication
 */
export const sendEmail = async (params: SendEmailParams): Promise<{ success: boolean; message?: string; error?: string }> => {
    if (!isNetSuite) {
        console.log('[Local] Would send email:', params);
        return { success: true, message: `[Demo] Email sent to ${params.recipientEmails.join(', ')}` };
    }

    try {
        const scriptUrl = window.NETSUITE_CONTEXT?.suiteletUrl || '';
        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'sendEmail',
                opportunityId: params.opportunityId,
                recipientContactIds: params.recipientContactIds,
                recipientEmails: params.recipientEmails,
                emailSubject: params.emailSubject,
                emailBody: params.emailBody
            })
        });

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Invalid JSON response: ' + text.substring(0, 100) };
        }
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: String(error) };
    }
};

// ============================================
// Probability Update API (for Scorecard)
// ============================================

/**
 * Update Opportunity Probability from Scorecard
 * Persists the calculated probability to NetSuite Opportunity record
 */
export const updateOpportunityProbability = async (
    opportunityId: string,
    probability: number,
    scorecardChecks?: Record<string, boolean>
): Promise<{ success: boolean; error?: string }> => {
    if (!isNetSuite) {
        console.log('[Local] Would update probability:', { opportunityId, probability });
        return { success: true };
    }

    try {
        const scriptUrl = window.NETSUITE_CONTEXT?.suiteletUrl || '';
        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'updateProbability',
                opportunityId,
                probability,
                scorecardChecks: scorecardChecks ? JSON.stringify(scorecardChecks) : undefined
            })
        });

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: 'Invalid JSON response: ' + text.substring(0, 100) };
        }
    } catch (error) {
        console.error('Error updating probability:', error);
        return { success: false, error: String(error) };
    }
};
