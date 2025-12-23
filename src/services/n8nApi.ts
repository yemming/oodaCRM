// src/services/n8nApi.ts
// Unified N8N Webhook Integration Layer

/**
 * Request types for N8N webhook routing
 * N8N can use Switch node to route based on this value
 */
export type N8NRequestType =
    | 'ai_insight'      // AI 教練 - 商機分析建議
    | 'email_template'  // AI Email - 生成郵件模板
    | 'pain_analysis'   // AI 痛點分析
    | 'meeting_prep'    // AI 會議準備 (未來)
    | 'follow_up'       // AI 跟進建議 (未來)
    | 'generate_jep'    // 生成 JEP (Joint Engage Plan)
    | 'discovery_call'  // Discovery Call - 客戶調研
    | 'custom';         // 自訂功能

/**
 * Opportunity context data passed to all N8N requests
 */
export interface OpportunityContext {
    id: string;
    title: string;
    customer?: string;
    customerId?: string;
    status?: string;
    statusText?: string;
    amount?: number;
    probability?: number;
    closeDate?: string;
    salesRep?: string;
}

/**
 * Base payload structure for all N8N requests
 */
export interface N8NBasePayload {
    requestType: N8NRequestType;
    opportunityContext: OpportunityContext;
    timestamp: string;
}

/**
 * AI Insight specific payload
 */
export interface AIInsightPayload extends N8NBasePayload {
    requestType: 'ai_insight';
    buyingCenter?: any[];
    weeklyNotes?: any[];
    activities?: {
        emails?: any[];
        phoneCalls?: any[];
        tasks?: any[];
    };
    scorecardData?: any;
}

/**
 * Email Template specific payload
 * Includes full opportunity context for AI to generate personalized emails
 */
export interface EmailTemplatePayload extends N8NBasePayload {
    requestType: 'email_template';
    recipientName: string;
    recipientEmail: string;
    recipientTitle?: string;
    emailPurpose?: 'follow_up' | 'introduction' | 'proposal' | 'thank_you' | 'custom';
    // Full opportunity data for AI context
    buyingCenter?: any[];           // 購買中心矩陣
    weeklyNotes?: any[];            // 週報/備註
    activities?: {                  // 活動記錄
        emails?: any[];
        phoneCalls?: any[];
        tasks?: any[];
        events?: any[];
    };
    scorecardData?: any;            // 機會評分表
    observation?: string;           // BANT/Observation details
}

/**
 * Pain Analysis specific payload
 */
export interface PainAnalysisPayload extends N8NBasePayload {
    requestType: 'pain_analysis';
    contactName: string;
    contactTitle?: string;
    existingPainData?: any;
}

// Union type moved to bottom of file

/**
 * Get N8N Key from NetSuite context
 */
const getN8nKey = (): string | null => {
    return (window as any).NETSUITE_CONTEXT?.n8nKey || null;
};

/**
 * Get N8N URL from NetSuite context
 */
const getN8NUrl = (): string | null => {
    return (window as any).NETSUITE_CONTEXT?.n8nAiUrl || null;
};

/**
 * Unified N8N Webhook caller
 * All AI features should use this function
 * 
 * @param payload - The request payload (must include requestType)
 * @returns The response from N8N
 */
export const callN8N = async <T = any>(payload: N8NPayload): Promise<{
    success: boolean;
    data?: T;
    error?: string;
}> => {
    const n8nUrl = getN8NUrl();
    const n8nKey = getN8nKey();

    if (!n8nUrl) {
        return {
            success: false,
            error: 'N8N URL 未設定。請在 OODA Configuration 中設定 n8n_ai_url。'
        };
    }

    try {
        console.log(`📡 Calling N8N [${payload.requestType}]`, payload);

        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        };

        if (n8nKey) {
            headers['n8nkey'] = n8nKey;
        } else {
            console.warn('⚠️ N8N Key is missing from context. Header Auth might fail.');
        }

        const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ N8N Response [${payload.requestType}]`, data);

        return { success: true, data };
    } catch (error) {
        console.error(`❌ N8N Error [${payload.requestType}]`, error);
        return { success: false, error: String(error) };
    }
};

/**
 * Extract text from N8N response
 * Handles various response formats from n8n
 */
export const extractTextFromN8NResponse = (data: any): string => {
    // Format: [{ "text": "..." }]
    if (Array.isArray(data) && data.length > 0 && data[0].text) {
        return data[0].text;
    }
    // Format: { "text": "..." }
    if (typeof data === 'object' && data.text) {
        return data.text;
    }
    // Format: plain string
    if (typeof data === 'string') {
        return data;
    }
    // Fallback: stringify
    return JSON.stringify(data, null, 2);
};

/**
 * Helper: Create AI Insight payload
 */
export const createAIInsightPayload = (
    opportunity: OpportunityContext,
    options?: {
        buyingCenter?: any[];
        weeklyNotes?: any[];
        activities?: any;
        scorecardData?: any;
    }
): AIInsightPayload => ({
    requestType: 'ai_insight',
    opportunityContext: opportunity,
    timestamp: new Date().toISOString(),
    buyingCenter: options?.buyingCenter,
    weeklyNotes: options?.weeklyNotes,
    activities: options?.activities,
    scorecardData: options?.scorecardData
});

/**
 * Helper: Create Discovery Call payload
 */
export const createDiscoveryPayload = (
    opportunity: OpportunityContext,
    contacts?: any[]
): DiscoveryPayload => ({
    requestType: 'discovery_call',
    opportunityContext: opportunity,
    timestamp: new Date().toISOString(),
    contacts: contacts
});

/**
 * Helper: Create Email Template payload
 * Includes full opportunity data for AI to generate personalized emails
 */
export const createEmailTemplatePayload = (
    opportunityContext: OpportunityContext,
    recipient: { name: string; email: string; title?: string },
    purpose: EmailTemplatePayload['emailPurpose'] = 'follow_up',
    data: {
        buyingCenter: any[];
        weeklyNotes: any[];
        activities: any;
        scorecardData: any;
        observation?: string;
    }
): EmailTemplatePayload => {
    return {
        requestType: 'email_template',
        opportunityContext,
        timestamp: new Date().toISOString(),
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        recipientTitle: recipient.title,
        emailPurpose: purpose,
        buyingCenter: data.buyingCenter,
        weeklyNotes: data.weeklyNotes,
        activities: data.activities,
        scorecardData: data.scorecardData,
        observation: data.observation
    };
};

/**
 * Helper: Create Pain Analysis payload
 */
export const createPainAnalysisPayload = (
    opportunity: OpportunityContext,
    contact: {
        name: string;
        title?: string;
    },
    existingPainData?: any
): PainAnalysisPayload => ({
    requestType: 'pain_analysis',
    opportunityContext: opportunity,
    timestamp: new Date().toISOString(),
    contactName: contact.name,
    contactTitle: contact.title,
    existingPainData
});


/**
 * Discovery Call specific payload
 */
export interface DiscoveryPayload extends N8NBasePayload {
    requestType: 'discovery_call';
    contacts?: any[];       // 聯絡人列表 (用於職稱分析)
}

// Union type of all payload types
export type N8NPayload = AIInsightPayload | EmailTemplatePayload | PainAnalysisPayload | JEPPayload | DiscoveryPayload;
export interface JEPPayload extends N8NBasePayload {
    requestType: 'generate_jep';
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
}

/**
 * Helper: Create JEP payload
 */
export const createJEPPayload = (
    opportunity: OpportunityContext,
    options: {
        buyingCenter?: any[];
        weeklyNotes?: any[];
        activities?: any;
        scorecardData?: any;
        formData?: any;
    }
): JEPPayload => ({
    requestType: 'generate_jep',
    opportunityContext: opportunity,
    timestamp: new Date().toISOString(),
    buyingCenter: options.buyingCenter,
    weeklyNotes: options.weeklyNotes,
    activities: options.activities,
    scorecardData: options.scorecardData,
    formData: options.formData
});

