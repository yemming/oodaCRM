// src/services/api.ts
// NetSuite Integration Layer

export interface Opportunity {
    id: string;
    title: string;
    customer: string;
    status: string;
    statusText: string;
    amount: number;
    probability: number;
    closeDate: string;
    salesRep: string;
}

interface NetSuiteContext {
    suiteletUrl: string;
    userId: string;
    userName: string;
    role: string;
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
    { id: '1001', title: 'Acme Corp - ERP Implementation', customer: 'Acme Corp', status: 'prospecting', statusText: 'Prospecting', amount: 150000, probability: 20, closeDate: '2024-03-15', salesRep: 'John Smith' },
    { id: '1002', title: 'TechStart - Cloud Migration', customer: 'TechStart Inc', status: 'qualification', statusText: 'Qualification', amount: 85000, probability: 40, closeDate: '2024-02-28', salesRep: 'Jane Doe' },
    { id: '1003', title: 'GlobalTech - CRM Upgrade', customer: 'GlobalTech', status: 'negotiation', statusText: 'Negotiation', amount: 220000, probability: 60, closeDate: '2024-01-31', salesRep: 'Bob Wilson' },
    { id: '1004', title: 'InnovateCo - Data Analytics', customer: 'InnovateCo', status: 'proposal', statusText: 'Proposal', amount: 175000, probability: 75, closeDate: '2024-02-15', salesRep: 'Alice Brown' },
    { id: '1005', title: 'FutureBiz - Digital Transform', customer: 'FutureBiz Ltd', status: 'closed_won', statusText: 'Closed Won', amount: 320000, probability: 100, closeDate: '2024-01-15', salesRep: 'John Smith' },
    { id: '1006', title: 'SmartSolutions - AI Integration', customer: 'SmartSolutions', status: 'prospecting', statusText: 'Prospecting', amount: 95000, probability: 15, closeDate: '2024-04-01', salesRep: 'Jane Doe' },
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
        console.log(`🔧 [Local] Would update ${opportunityId} to ${newStatus}`);
        return { success: true };
    }

    try {
        console.log(`📡 Updating Opportunity ${opportunityId} to ${newStatus}...`);

        // Build URL with query parameters (GET request to avoid CSRF issues)
        const updateUrl = `${window.NETSUITE_CONTEXT!.suiteletUrl}&action=updateStatus&opportunityId=${opportunityId}&newStatus=${newStatus}`;

        console.log(`📡 Update URL: ${updateUrl}`);

        const response = await fetch(updateUrl, {
            method: 'GET',
            credentials: 'include'
        });

        const text = await response.text();
        console.log(`📡 Response: ${text.substring(0, 200)}`);

        // Try to parse as JSON
        try {
            const result = JSON.parse(text);
            if (result.success) {
                console.log(`✅ Updated successfully`);
            } else {
                console.error(`❌ Update failed: ${result.error}`);
            }
            return result;
        } catch {
            console.error(`❌ Response is not JSON: ${text.substring(0, 100)}`);
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
