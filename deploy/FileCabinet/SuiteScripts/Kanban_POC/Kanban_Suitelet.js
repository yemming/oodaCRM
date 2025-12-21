/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * 
 * NetSuite Kanban Dashboard Suitelet
 * 
 * GET: Serves the React application with Opportunity data injected
 * POST: Handles status updates from drag-drop actions
 */
define(['N/ui/serverWidget', 'N/file', 'N/runtime', 'N/search', 'N/record', 'N/log', 'N/url', 'N/query', 'N/email'],
    (serverWidget, file, runtime, search, record, log, url, query, email) => {

        const HTML_FILE_ID = 21488; // Internal ID of index.html (updated 2025-12-19 with OODA feature)

        /**
         * Dynamically get all Opportunity Statuses from the account
         */
        const getOpportunityStatuses = () => {
            const statuses = [];

            // Query Customer Statuses (no filter - customerstatus doesn't support isinactive)
            search.create({
                type: 'customerstatus',
                columns: [
                    search.createColumn({ name: 'internalid' }),
                    search.createColumn({ name: 'name' }),
                    search.createColumn({ name: 'probability' })
                ]
            }).run().each((result) => {
                statuses.push({
                    id: result.getValue('internalid'),
                    name: result.getValue('name'),
                    probability: parseInt(result.getValue('probability')) || 0
                });
                return true;
            });

            log.debug('Available Statuses', JSON.stringify(statuses));
            return statuses;
        };

        /**
         * Create dynamic status mapping based on status names
         * Key format: statusText.toLowerCase().replace(spaces with underscores)
         * This matches the format used in getOpportunities for consistency
         */
        const createStatusMapping = (statuses) => {
            const mapping = {};
            const reverseMapping = {};

            statuses.forEach(status => {
                // Use the same key format as getOpportunities
                const statusKey = status.name.toLowerCase().replace(/\s+/g, '_');
                mapping[statusKey] = parseInt(status.id);
                reverseMapping[status.id] = statusKey;
            });

            return { mapping, reverseMapping };
        };

        let STATUS_MAPPING = {};
        let STATUS_ID_TO_KEY = {};

        /**
         * Main entry point
         */
        const onRequest = (context) => {
            const { request, response } = context;

            // Check if this is an API action (can be GET or POST)
            let action = request.parameters.action;

            // Only try to parse body if it's POST and body actually has content
            if (!action && request.method === 'POST' && request.body && request.body.trim()) {
                try {
                    const body = JSON.parse(request.body);
                    action = body.action;
                } catch (e) {
                    log.debug('Body Parse Error', e.message);
                }
            }

            if (action) {
                handleApiRequest(request, response, action);
                return;
            }

            handleUIRequest(request, response);
        };

        /**
         * Handle API requests (GET or POST)
         */
        const handleApiRequest = (request, response, action) => {
            try {
                // Initialize status mappings
                const allStatuses = getOpportunityStatuses();
                const mappings = createStatusMapping(allStatuses);
                STATUS_MAPPING = mappings.mapping;
                STATUS_ID_TO_KEY = mappings.reverseMapping;

                // Get parameters from URL (GET) or body (POST)
                let opportunityId, newStatus, title, noteContent;
                let insight, buyingCenter, snapshot, type;
                let contactId, painData;

                if (request.method === 'POST' && request.body) {
                    const body = JSON.parse(request.body);
                    opportunityId = body.opportunityId;
                    newStatus = body.newStatus;
                    title = body.title;
                    noteContent = body.noteContent;
                    const memo = body.memo; // For updateMemo
                    const probability = body.probability; // For updateProbability
                    // OODA Params
                    insight = body.insight;
                    buyingCenter = body.buyingCenter;
                    snapshot = body.snapshot;
                    type = body.type;
                    // Pain Sheet Params
                    contactId = body.contactId;
                    painData = body.painData;
                    // Email Params (for sendEmail action)
                    var emailSubject = body.emailSubject;
                    var emailBodyContent = body.emailBody;
                    var recipientEmail = body.recipientEmail;
                    var recipientContactId = body.recipientContactId;
                } else {
                    opportunityId = request.parameters.opportunityId;
                    newStatus = request.parameters.newStatus;
                    title = request.parameters.title;
                    noteContent = request.parameters.noteContent;
                    const memo = request.parameters.memo; // For updateMemo
                    type = request.parameters.type;
                    contactId = request.parameters.contactId;
                    painData = null;
                }

                // Additional parameters for activities
                const subject = request.parameters.subject;
                const recipients = request.parameters.recipients;
                const emailBody = request.parameters.body;

                const message = request.parameters.message;
                const priority = request.parameters.priority;
                const dueDate = request.parameters.dueDate;

                log.debug('API Request', `action=${action}, oppId=${opportunityId}`);

                let result;
                if (action === 'updateStatus') {
                    result = updateOpportunityStatus(opportunityId, newStatus);
                } else if (action === 'updateProbability') {
                    const prob = request.body ? JSON.parse(request.body).probability : request.parameters.probability;
                    result = updateOpportunityProbability(opportunityId, prob);
                } else if (action === 'updateMemo') {
                    // Handle Memo Update
                    // We need to retrieve memo from either body or params depending on parsing above
                    // But effectively we can just grab it from request.parameters or body again if needed
                    // Simplest is to pass it into a variable in the parsing block.
                    // Let's assume `memo` variable is available from the parsing block I just edited.
                    // Wait, I need to make sure `memo` variable is accessible here.
                    // The parsing block above declares `memo` inside potential `if/else` or just `let`?
                    // Ah, I need to check the declaration.
                    // Let's look at line 104: `let opportunityId, ...`
                    // I should add `let memo` there too.

                    // Actually, I'll essentially just trust `request.parameters.memo` or `body.memo` logic.
                    // Re-reading my edit above: I added `const memo = ...` inside the blocks. 
                    // Javascript scopes `const` to the block. So `memo` WON'T be available here!
                    // I need to fix the declaration first.

                    // RE-WRITE STRATEGY: 
                    // Instead of assuming `memo` variable, I will re-fetch it here safely or rely on `request.parameters` 
                    // if it was a GET, or parse body if POST.
                    // BUT `handleApiRequest` logic is a bit messy. 

                    // Better approach: 
                    // In logical flow, `opportunityId` etc were declared with `let` at line 104.
                    // I should add `memo` to that `let` list.

                    // However, `multi_replace` chunks are separate. 
                    // I will just use `request.parameters.memo` (if GET) or extract from body again if needed? 
                    // No, that's inefficient.

                    // OK, looking at the code:
                    // Line 104: `let opportunityId, newStatus, title, noteContent;`

                    // I will update line 104 to include `memo`.
                    // And then remove `const` in my previous thought.

                    // Let's do this correctly in ONE multireplace if possible, or assume I can access it.
                    // I will update the declaration and the assignment.

                    result = updateOpportunityMemo(opportunityId, request.parameters.memo || (request.body ? JSON.parse(request.body).memo : ''));
                } else if (action === 'getNotes') {
                    result = getUserNotes(opportunityId);
                } else if (action === 'addNote') {
                    result = addUserNote(opportunityId, title, noteContent);
                } else if (action === 'getEmails') {
                    result = getEmails(opportunityId);
                } else if (action === 'addEmail') {
                    result = addEmailRecord(opportunityId, subject, recipients, emailBody);
                } else if (action === 'addEmail') {
                    result = addEmailRecord(opportunityId, subject, recipients, emailBody);
                } else if (action === 'getTasks') {
                    result = getTasks(opportunityId);
                } else if (action === 'addTask') {
                    result = addTaskRecord(opportunityId, title, priority, dueDate, message);
                } else if (action === 'getEvents') {
                    result = getEvents(opportunityId);
                } else if (action === 'addEvent') {
                    const date = request.parameters.date;
                    result = addEventRecord(opportunityId, title, date, message);
                } else if (action === 'saveAnalysis') {
                    result = saveOodaAnalysis(opportunityId, insight, buyingCenter, snapshot, type);
                } else if (action === 'getAnalysisHistory') {
                    result = getOodaAnalysis(opportunityId);
                } else if (action === 'getContacts') {
                    result = getContacts(opportunityId);
                } else if (action === 'savePainSheet') {
                    result = savePainSheet(opportunityId, contactId, painData);
                } else if (action === 'getPainSheet') {
                    result = getPainSheet(opportunityId, contactId);
                } else if (action === 'getSalesReps') {
                    result = getSalesReps();
                } else if (action === 'getSalesTeams') {
                    result = getSalesTeams();
                } else if (action === 'getStatuses') {
                    result = { success: true, statuses: getOpportunityStatuses() };
                } else if (action === 'sendEmail') {
                    result = sendEmailToContact(opportunityId, recipientContactId, recipientEmail, emailSubject, emailBodyContent);
                } else {
                    result = { success: false, error: `Unknown action: ${action}` };
                }

                response.setHeader({ name: 'Content-Type', value: 'application/json' });
                response.write(JSON.stringify(result));
            } catch (e) {
                log.error('API Error', e.message + ' - Stack: ' + e.stack);
                response.setHeader({ name: 'Content-Type', value: 'application/json' });
                response.write(JSON.stringify({ success: false, error: e.message }));
            }
        };

        /**
         * Get User Notes for an Opportunity
         * USER PROVIDED QUERY - VERIFIED WORKING
         */
        const getUserNotes = (opportunityId) => {
            try {
                if (!opportunityId) return { success: true, notes: [] };

                const sql = `
                    SELECT 
                        tn.ID as id,
                        tn.Title as title,
                        tn.Note as note,
                        tn.NoteDate as date,
                        BUILTIN.DF(tn.Author) as author
                    FROM 
                        Transaction t
                    INNER JOIN 
                        TransactionNote tn ON tn.Transaction = t.ID
                    INNER JOIN 
                        Employee e ON e.ID = tn.Author
                    WHERE 
                        t.ID = ?
                    ORDER BY 
                        tn.NoteDate DESC
                `;

                const results = query.runSuiteQL({
                    query: sql,
                    params: [opportunityId]
                }).asMappedResults();

                const notes = results.map(r => ({
                    id: r.id,
                    title: r.title || 'Untitled',
                    note: r.note || '',
                    date: r.date || '',
                    author: r.author || 'Unknown'
                }));

                log.debug('Notes Found (UserSQ)', notes.length);
                return { success: true, notes: notes };
            } catch (e) {
                log.error('Get Notes Error (UserSQ)', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Add a User Note to an Opportunity
         */
        const addUserNote = (opportunityId, title, noteContent) => {
            try {
                const noteRecord = record.create({
                    type: record.Type.NOTE,
                    isDynamic: true
                });

                noteRecord.setValue({ fieldId: 'transaction', value: opportunityId });
                noteRecord.setValue({ fieldId: 'title', value: title || 'Weekly Report' });
                noteRecord.setValue({ fieldId: 'note', value: noteContent || '' });

                const noteId = noteRecord.save();

                log.audit('Note Added', `Opportunity ${opportunityId} - Note ID: ${noteId}`);
                return { success: true, noteId: noteId };
            } catch (e) {
                log.error('Add Note Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Get Customer ID from Opportunity
         */
        const getCustomerFromOpportunity = (opportunityId) => {
            try {
                const opp = record.load({ type: record.Type.OPPORTUNITY, id: opportunityId, isDynamic: false });
                return opp.getValue({ fieldId: 'entity' }); // Customer/Company
            } catch (e) {
                log.error('Get Customer Error', e.message);
                return null;
            }
        };

        /**
         * Get Email Messages for an Opportunity (using SuiteQL)
         */
        const getEmails = (opportunityId) => {
            try {
                if (!opportunityId) {
                    return { success: true, emails: [] };
                }

                const sql = `
                    SELECT 
                        id, 
                        subject, 
                        message as body, 
                        messagedate as date,
                        BUILTIN.DF(author) as author
                    FROM 
                        message 
                    WHERE 
                        transaction = ?
                    ORDER BY 
                        messagedate DESC
                `;

                const results = query.runSuiteQL({
                    query: sql,
                    params: [opportunityId]
                }).asMappedResults();

                const emails = results.map(r => ({
                    id: r.id,
                    subject: r.subject || 'No Subject',
                    body: r.body || '',
                    date: r.date || '',
                    author: r.author || ''
                }));

                log.debug('Emails Found (SuiteQL)', emails.length);
                return { success: true, emails: emails };
            } catch (e) {
                log.error('Get Emails Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Add Email Message to an Opportunity
         */
        const addEmailRecord = (opportunityId, subject, recipients, body) => {
            try {
                const emailRecord = record.create({ type: record.Type.MESSAGE, isDynamic: true });
                emailRecord.setValue({ fieldId: 'transaction', value: opportunityId });
                emailRecord.setValue({ fieldId: 'subject', value: subject || '' });
                emailRecord.setValue({ fieldId: 'recipients', value: recipients || '' });
                emailRecord.setValue({ fieldId: 'message', value: body || '' });
                const emailId = emailRecord.save();
                return { success: true, emailId: emailId };
            } catch (e) {
                log.error('Add Email Error', e.message);
                return { success: false, error: e.message };
            }
        };



        /**
         * Get Tasks for an Opportunity (using SuiteQL)
         */
        const getTasks = (opportunityId) => {
            try {
                if (!opportunityId) {
                    return { success: true, tasks: [] };
                }

                log.debug('getTasks (SuiteQL)', `Fetching tasks for Opp ${opportunityId}`);

                const sql = `
                    SELECT 
                        id, 
                        title, 
                        priority, 
                        status, 
                        duedate, 
                        BUILTIN.DF(assigned) as assignee, 
                        message 
                    FROM 
                        task 
                    WHERE 
                        transaction = ?
                    ORDER BY 
                        duedate ASC
                `;

                const results = query.runSuiteQL({
                    query: sql,
                    params: [opportunityId]
                }).asMappedResults();

                // Map priority codes to text
                const priorityMap = { '1': 'High', '2': 'Medium', '3': 'Low' };
                // Map status codes to text  
                const statusMap = { 'NOTSTART': 'Not Started', 'PROGRESS': 'In Progress', 'COMPLETE': 'Completed' };

                const tasks = results.map(r => ({
                    id: r.id,
                    title: r.title || 'Task',
                    priority: priorityMap[String(r.priority)] || 'Medium',
                    status: statusMap[r.status] || r.status || 'Not Started',
                    dueDate: r.duedate || '',
                    assignee: r.assignee || '',
                    message: r.message || ''
                }));

                log.debug('Tasks Found (SuiteQL)', tasks.length);
                return { success: true, tasks: tasks };
            } catch (e) {
                log.error('Get Tasks Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Add Task to an Opportunity
         */
        /**
         * Add Task to an Opportunity (Log Task)
         * Creates a COMPLETED task.
         */
        const addTaskRecord = (opportunityId, title, priority, dueDate, message) => {
            try {
                const taskRecord = record.create({ type: record.Type.TASK, isDynamic: true });

                // Fix: Set Company (Entity) first to establish context/subsidiary
                const customerId = getCustomerFromOpportunity(opportunityId);
                if (customerId) {
                    taskRecord.setValue({ fieldId: 'company', value: customerId });
                }

                taskRecord.setValue({ fieldId: 'transaction', value: opportunityId });
                taskRecord.setValue({ fieldId: 'title', value: title || 'Task' });

                // Log Task: Always set status to COMPLETE
                taskRecord.setValue({ fieldId: 'status', value: 'COMPLETE' });

                // Log Task: Set Completed Date 
                if (dueDate) {
                    // If user provides a date, use it as completed date
                    taskRecord.setValue({ fieldId: 'completeddate', value: new Date(dueDate) });
                } else {
                    // Default to today
                    taskRecord.setValue({ fieldId: 'completeddate', value: new Date() });
                }

                // Priority is ignored for Log Task as per user request
                // taskRecord.setValue({ fieldId: 'priority', value: ... }); 

                taskRecord.setValue({ fieldId: 'message', value: message || '' });
                const taskId = taskRecord.save();
                return { success: true, taskId: taskId };
            } catch (e) {
                log.error('Add Task Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Get Calendar Events for an Opportunity (using SuiteQL)
         */
        const getEvents = (opportunityId) => {
            try {
                if (!opportunityId) {
                    return { success: true, events: [] };
                }

                const sql = `
                    SELECT 
                        id, 
                        title, 
                        startdate as date, 
                        message, 
                        BUILTIN.DF(organizer) as author
                    FROM 
                        calendarevent 
                    WHERE 
                        transaction = ?
                    ORDER BY 
                        startdate DESC
                `;

                const results = query.runSuiteQL({
                    query: sql,
                    params: [opportunityId]
                }).asMappedResults();

                const events = results.map(r => ({
                    id: r.id,
                    title: r.title || 'Event',
                    date: r.date || '',
                    message: r.message || '',
                    author: r.author || ''
                }));

                log.debug('Events Found (SuiteQL)', events.length);
                return { success: true, events: events };
            } catch (e) {
                log.error('Get Events Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Add Event to an Opportunity
         */
        const addEventRecord = (opportunityId, title, date, message) => {
            try {
                const eventRecord = record.create({ type: record.Type.CALENDAR_EVENT, isDynamic: true });

                // Set Company (Entity) context
                const customerId = getCustomerFromOpportunity(opportunityId);
                if (customerId) {
                    eventRecord.setValue({ fieldId: 'company', value: customerId });
                }

                eventRecord.setValue({ fieldId: 'transaction', value: opportunityId });
                eventRecord.setValue({ fieldId: 'title', value: title || 'Event' });

                if (date) {
                    const eventDate = new Date(date);
                    eventRecord.setValue({ fieldId: 'startdate', value: eventDate });
                    // Default duration or end time could be set here, but startdate is simpler
                }

                // Status for events is typically handled differently (e.g. CONFIRMED), 
                // but defaulting to CONFIRMED is good practice if possible. 
                // However, standard Create form doesn't always require it.
                // eventRecord.setValue({ fieldId: 'status', value: 'CONFIRMED' });

                eventRecord.setValue({ fieldId: 'message', value: message || '' });

                const eventId = eventRecord.save();
                return { success: true, eventId: eventId };
            } catch (e) {
                log.error('Add Event Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Update Opportunity Status
         */
        const updateOpportunityStatus = (opportunityId, newStatus) => {
            try {
                // Find Status ID from mapping
                const statusId = STATUS_MAPPING[newStatus] || newStatus;

                log.audit('Updating Status', `Opp: ${opportunityId}, New Status: ${newStatus} (ID: ${statusId})`);

                record.submitFields({
                    type: record.Type.OPPORTUNITY,
                    id: opportunityId,
                    values: {
                        entitystatus: statusId
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                return { success: true };
            } catch (e) {
                log.error('Update Status Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Update Opportunity Probability
         */
        const updateOpportunityProbability = (opportunityId, probability) => {
            try {
                log.audit('Updating Probability', `Opp: ${opportunityId}, Probability: ${probability}%`);

                record.submitFields({
                    type: record.Type.OPPORTUNITY,
                    id: opportunityId,
                    values: {
                        probability: probability
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                return { success: true };
            } catch (e) {
                log.error('Update Probability Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Update Opportunity Memo (Details)
         */
        const updateOpportunityMemo = (opportunityId, memo) => {
            try {
                record.submitFields({
                    type: record.Type.OPPORTUNITY,
                    id: opportunityId,
                    values: {
                        memo: memo
                    }
                });
                log.audit('Memo Updated', `Opportunity ${opportunityId}`);
                return { success: true, opportunityId };
            } catch (e) {
                log.error('Update Memo Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Send Email to a Contact (using N/email module)
         * The email will be attached to the Opportunity in NetSuite Communications
         * @param {string} opportunityId - The Opportunity Internal ID
         * @param {string} recipientContactId - The Contact Internal ID (optional, used for relatedRecords)
         * @param {string} recipientEmail - The recipient email address
         * @param {string} subject - Email subject
         * @param {string} body - Email body (HTML supported)
         * @returns {Object} - Success status and message ID
         */
        const sendEmailToContact = (opportunityId, recipientContactId, recipientEmail, subject, body) => {
            try {
                if (!recipientEmail) {
                    return { success: false, error: 'Recipient email is required' };
                }
                if (!subject) {
                    return { success: false, error: 'Email subject is required' };
                }

                const currentUser = runtime.getCurrentUser();
                log.debug('Sending Email', {
                    from: currentUser.id,
                    to: recipientEmail,
                    subject: subject,
                    opportunityId: opportunityId
                });

                // Build relatedRecords object
                const relatedRecords = {};
                if (opportunityId) {
                    relatedRecords.transactionId = opportunityId;
                }
                if (recipientContactId) {
                    relatedRecords.entityId = recipientContactId;
                }

                // Send email using N/email module
                email.send({
                    author: currentUser.id,
                    recipients: recipientEmail,
                    subject: subject,
                    body: body || '',
                    relatedRecords: relatedRecords
                });

                log.audit('Email Sent', `To: ${recipientEmail}, Subject: ${subject}, Opp: ${opportunityId}`);
                return {
                    success: true,
                    message: `Email sent successfully to ${recipientEmail}`
                };
            } catch (e) {
                log.error('Send Email Error', e.message + ' - Stack: ' + e.stack);
                return { success: false, error: e.message };
            }
        };

        /**
         * Get all Sales Representatives (employees with issalesrep = true)
         */
        const getSalesReps = () => {
            try {
                const salesReps = [];
                const empSearch = search.create({
                    type: search.Type.EMPLOYEE,
                    filters: [
                        ['salesrep', 'is', 'T'],
                        'AND',
                        ['isinactive', 'is', 'F']
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'entityid' }),
                        search.createColumn({ name: 'firstname' }),
                        search.createColumn({ name: 'lastname' })
                    ]
                });

                empSearch.run().each((result) => {
                    const firstName = result.getValue('firstname') || '';
                    const lastName = result.getValue('lastname') || '';
                    const fullName = `${firstName} ${lastName}`.trim() || result.getValue('entityid');

                    salesReps.push({
                        id: result.getValue('internalid'),
                        name: fullName,
                        entityId: result.getValue('entityid')
                    });
                    return true;
                });

                log.debug('Sales Reps Found', salesReps.length);
                return { success: true, salesReps: salesReps };
            } catch (e) {
                log.error('getSalesReps Error', e.message);
                return { success: false, error: e.message, salesReps: [] };
            }
        };

        /**
         * Get all Sales Teams
         */
        const getSalesTeams = () => {
            try {
                const salesTeams = [];
                // Search for all sales team records
                const teamSearch = search.create({
                    type: 'salesteam',
                    filters: [
                        ['isinactive', 'is', 'F']
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'name' })
                    ]
                });

                teamSearch.run().each((result) => {
                    salesTeams.push({
                        id: result.getValue('internalid'),
                        name: result.getValue('name') || 'Unnamed'
                    });
                    return true;
                });

                log.debug('Sales Teams Found', salesTeams.length);
                return { success: true, salesTeams: salesTeams };
            } catch (e) {
                log.error('getSalesTeams Error', e.message);
                return { success: false, error: e.message, salesTeams: [] };
            }
        };

        /**
         * Fetch all Opportunities
         */
        const getOpportunities = () => {
            const opportunities = [];

            const oppSearch = search.create({
                type: search.Type.OPPORTUNITY,
                columns: [
                    search.createColumn({ name: 'internalid' }),
                    search.createColumn({ name: 'tranid' }), // Add Transaction ID
                    search.createColumn({ name: 'title' }),
                    search.createColumn({ name: 'entity' }),
                    search.createColumn({ name: 'entitystatus' }),
                    search.createColumn({ name: 'projectedtotal' }),
                    search.createColumn({ name: 'probability' }),
                    search.createColumn({ name: 'expectedclosedate' }),
                    search.createColumn({ name: 'salesrep' }),
                    search.createColumn({ name: 'memo' }) // Add Memo/Details
                ]
            });

            oppSearch.run().each((result) => {
                const statusId = result.getValue('entitystatus');
                const statusText = result.getText('entitystatus') || 'Unknown';
                // Use statusText directly as status key (lowercase, underscore-separated)
                const statusKey = statusText.toLowerCase().replace(/\s+/g, '_');

                opportunities.push({
                    id: result.getValue('internalid'),
                    tranId: result.getValue('tranid') || '', // Map Transaction ID
                    title: result.getValue('title') || result.getText('entity') || 'Untitled',
                    customer: result.getText('entity') || '',
                    customerId: result.getValue('entity') || '',
                    status: statusKey,
                    statusId: statusId,
                    statusText: statusText,
                    amount: parseFloat(result.getValue('projectedtotal')) || 0,
                    probability: parseInt(result.getValue('probability')) || 0,
                    closeDate: result.getValue('expectedclosedate') || '',
                    salesRep: result.getText('salesrep') || '',
                    salesRepId: result.getValue('salesrep') || '',
                    memo: result.getValue('memo') || '' // Map Memo
                });
                return true; // Continue iteration
            });

            log.debug('Opportunities Found', opportunities.length);
            return opportunities;
        };

        /**
         * Get Contacts for a Customer (via Opportunity)
         * @param {string} opportunityId - The Opportunity Internal ID
         * @returns {Object} - Array of contacts
         */
        const getContacts = (opportunityId) => {
            try {
                // First, get the Customer ID from the Opportunity
                const oppRecord = record.load({
                    type: record.Type.OPPORTUNITY,
                    id: opportunityId,
                    isDynamic: false
                });

                const customerId = oppRecord.getValue({ fieldId: 'entity' });

                if (!customerId) {
                    return { success: true, contacts: [] };
                }

                log.debug('Getting Contacts', `Opportunity: ${opportunityId}, Customer: ${customerId}`);

                // Search for Contacts linked to this Customer
                const contactSearch = search.create({
                    type: search.Type.CONTACT,
                    filters: [
                        ['company', 'anyof', customerId]
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'entityid' }),
                        search.createColumn({ name: 'firstname' }),
                        search.createColumn({ name: 'lastname' }),
                        search.createColumn({ name: 'title' }),
                        search.createColumn({ name: 'email' }),
                        search.createColumn({ name: 'phone' })
                    ]
                });

                const contactsMap = {};
                contactSearch.run().each((result) => {
                    const internalId = result.getValue('internalid');
                    // Skip if we've already seen this contact
                    if (contactsMap[internalId]) {
                        return true; // Continue to next
                    }

                    const firstName = result.getValue('firstname') || '';
                    const lastName = result.getValue('lastname') || '';
                    const fullName = `${firstName} ${lastName}`.trim() || result.getValue('entityid');

                    contactsMap[internalId] = {
                        id: internalId,
                        internalId: internalId,
                        name: fullName,
                        title: result.getValue('title') || '',
                        email: result.getValue('email') || '',
                        phone: result.getValue('phone') || ''
                    };
                    return true; // Continue iteration
                });

                const contacts = Object.values(contactsMap);
                log.debug('Contacts Found', contacts.length);
                return { success: true, contacts: contacts };
            } catch (e) {
                log.error('getContacts Error', e.message);
                return { success: false, error: e.message, contacts: [] };
            }
        };

        /**
         * Save OODA Analysis to Custom Record
         */
        const saveOodaAnalysis = (opportunityId, insight, buyingCenter, snapshot, type) => {
            try {
                log.debug('Saving Analysis', { opportunityId, type });

                // Check if record already exists for this opportunity
                let existingId = null;
                search.create({
                    type: 'customrecord_ooda_analysis',
                    filters: [
                        ['custrecord_ooda_opp', 'anyof', opportunityId]
                    ],
                    columns: ['internalid']
                }).run().each(result => {
                    existingId = result.getValue('internalid');
                    return false; // Stop after first
                });

                let rec;
                if (existingId) {
                    // Update existing record
                    rec = record.load({ type: 'customrecord_ooda_analysis', id: existingId, isDynamic: true });
                    log.debug('Updating existing analysis', existingId);
                } else {
                    // Create new record
                    rec = record.create({ type: 'customrecord_ooda_analysis', isDynamic: true });
                    rec.setValue({ fieldId: 'custrecord_ooda_opp', value: opportunityId });
                    // Set required Name field
                    rec.setValue({ fieldId: 'name', value: `OODA-Opp-${opportunityId}` });
                }

                // Update fields
                rec.setValue({ fieldId: 'custrecord_ooda_insight', value: insight || '' });
                rec.setValue({ fieldId: 'custrecord_ooda_buying_center', value: buyingCenter || '' });
                rec.setValue({ fieldId: 'custrecord_ooda_snapshot', value: snapshot || '' });

                const id = rec.save();
                log.audit('Analysis Saved', `ID: ${id}, Opp: ${opportunityId}`);
                return { success: true, id: id };
            } catch (e) {
                log.error('Save Analysis Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Get latest OODA Analysis
         */
        const getOodaAnalysis = (opportunityId) => {
            try {
                const searchResults = search.create({
                    type: 'customrecord_ooda_analysis',
                    filters: [
                        ['custrecord_ooda_opp', 'anyof', opportunityId]
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'custrecord_ooda_insight' }),
                        search.createColumn({ name: 'custrecord_ooda_buying_center' }),
                        search.createColumn({ name: 'custrecord_ooda_snapshot' }),
                        search.createColumn({ name: 'created', sort: search.Sort.DESC })
                    ]
                }).run().getRange({ start: 0, end: 1 });

                if (searchResults && searchResults.length > 0) {
                    const res = searchResults[0];
                    return {
                        success: true,
                        analysis: {
                            id: res.getValue('internalid'),
                            insight: res.getValue('custrecord_ooda_insight'),
                            buyingCenter: res.getValue('custrecord_ooda_buying_center'),
                            snapshot: res.getValue('custrecord_ooda_snapshot'),
                            date: res.getValue('created')
                        }
                    };
                }
                return { success: true, analysis: null };
            } catch (e) {
                log.error('Get Analysis Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Save Pain Sheet for a Contact on an Opportunity
         * Uses composite key (opportunityId + contactId)
         */
        const savePainSheet = (opportunityId, contactId, painData) => {
            try {
                if (!opportunityId || !contactId) {
                    return { success: false, error: 'Missing opportunityId or contactId' };
                }

                log.debug('Saving Pain Sheet', { opportunityId, contactId });

                // Check if record already exists
                let existingId = null;
                search.create({
                    type: 'customrecord_ooda_pain_sheet',
                    filters: [
                        ['custrecord_ps_opportunity', 'anyof', opportunityId],
                        'AND',
                        ['custrecord_ps_contact', 'anyof', contactId]
                    ],
                    columns: ['internalid']
                }).run().each(result => {
                    existingId = result.getValue('internalid');
                    return false; // Stop after first
                });

                let rec;
                if (existingId) {
                    // Update existing record
                    rec = record.load({ type: 'customrecord_ooda_pain_sheet', id: existingId, isDynamic: true });
                } else {
                    // Create new record
                    rec = record.create({ type: 'customrecord_ooda_pain_sheet', isDynamic: true });
                    rec.setValue({ fieldId: 'custrecord_ps_opportunity', value: opportunityId });
                    rec.setValue({ fieldId: 'custrecord_ps_contact', value: contactId });
                    // Set required Name field: "Opp-{oppId}_Contact-{contactId}"
                    rec.setValue({ fieldId: 'name', value: `Opp-${opportunityId}_Contact-${contactId}` });
                }

                // Set pain data fields
                if (painData) {
                    rec.setValue({ fieldId: 'custrecord_ps_pain', value: painData.pain || '' });
                    rec.setValue({ fieldId: 'custrecord_ps_position_industry', value: painData.positionIndustry || '' });
                    rec.setValue({ fieldId: 'custrecord_ps_products_services', value: painData.productsServices || '' });
                    rec.setValue({ fieldId: 'custrecord_ps_rows', value: JSON.stringify(painData.rows || []) });
                }

                const id = rec.save();
                log.audit('Pain Sheet Saved', `ID: ${id}, Opp: ${opportunityId}, Contact: ${contactId}`);
                return { success: true, id: id };
            } catch (e) {
                log.error('Save Pain Sheet Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Get Pain Sheet for a Contact on an Opportunity
         */
        const getPainSheet = (opportunityId, contactId) => {
            try {
                if (!opportunityId || !contactId) {
                    return { success: false, error: 'Missing opportunityId or contactId' };
                }

                log.debug('Getting Pain Sheet', { opportunityId, contactId });

                let painSheet = null;
                search.create({
                    type: 'customrecord_ooda_pain_sheet',
                    filters: [
                        ['custrecord_ps_opportunity', 'anyof', opportunityId],
                        'AND',
                        ['custrecord_ps_contact', 'anyof', contactId]
                    ],
                    columns: [
                        'internalid',
                        'custrecord_ps_pain',
                        'custrecord_ps_position_industry',
                        'custrecord_ps_products_services',
                        'custrecord_ps_rows'
                    ]
                }).run().each(result => {
                    let rows = [];
                    try {
                        const rowsJson = result.getValue('custrecord_ps_rows');
                        if (rowsJson) rows = JSON.parse(rowsJson);
                    } catch (parseErr) {
                        log.debug('Pain Sheet Rows Parse Error', parseErr.message);
                    }

                    painSheet = {
                        id: result.getValue('internalid'),
                        pain: result.getValue('custrecord_ps_pain') || '',
                        positionIndustry: result.getValue('custrecord_ps_position_industry') || '',
                        productsServices: result.getValue('custrecord_ps_products_services') || '',
                        rows: rows
                    };
                    return false; // Stop after first
                });

                return { success: true, painSheet: painSheet };
            } catch (e) {
                log.error('Get Pain Sheet Error', e.message);
                return { success: false, error: e.message };
            }
        };

        /**
         * Get Config Value
         */
        const getConfigValue = (key) => {
            try {
                let value = '';
                search.create({
                    type: 'customrecord_ooda_config',
                    filters: [['custrecord_ooda_config_key', 'is', key]],
                    columns: ['custrecord_ooda_config_value']
                }).run().each(result => {
                    value = result.getValue('custrecord_ooda_config_value');
                    return false;
                });
                return value;
            } catch (e) {
                log.error('Config Error', e.message);
                return '';
            }
        };

        /**
         * Handle GET requests (Render React UI)
         */
        const handleUIRequest = (request, response) => {
            const form = serverWidget.createForm({ title: 'Kanban Dashboard' });

            try {
                // Initialize status mappings dynamically
                const allStatuses = getOpportunityStatuses();
                const mappings = createStatusMapping(allStatuses);
                STATUS_MAPPING = mappings.mapping;
                STATUS_ID_TO_KEY = mappings.reverseMapping;

                log.debug('Status Mapping', JSON.stringify(STATUS_MAPPING));
                log.debug('Reverse Mapping', JSON.stringify(STATUS_ID_TO_KEY));

                // Load HTML file
                const htmlFile = file.load({ id: HTML_FILE_ID });
                let htmlContent = htmlFile.getContents();

                // Fetch real data
                const opportunities = getOpportunities();
                const currentUser = runtime.getCurrentUser();

                // Fetch N8N Config
                const n8nAiUrl = getConfigValue('n8n_ai_insight_url') || '';

                // Inject data into HTML (including status info for debugging)
                // Generate proper Suitelet URL using url.resolveScript
                // Use returnExternalUrl: false to avoid CORS (stay on same domain)
                const scriptId = runtime.getCurrentScript().id;
                const deploymentId = runtime.getCurrentScript().deploymentId;
                const suiteletUrl = url.resolveScript({
                    scriptId: scriptId,
                    deploymentId: deploymentId,
                    returnExternalUrl: false  // Changed to false to avoid CORS
                });

                let ocrSuiteletUrl = '';
                try {
                    // Try to resolve OCR Suitelet URL (Assuming script ID 'customscript_ooda_ocr_suitelet')
                    ocrSuiteletUrl = url.resolveScript({
                        scriptId: 'customscript_ooda_ocr_suitelet',
                        deploymentId: 'customdeploy_ooda_ocr_suitelet',
                        returnExternalUrl: false
                    });
                } catch (e) {
                    log.error('OCR Suitelet Resolution Warning', 'Could not resolve customscript_ooda_ocr_suitelet. Using placeholder or empty.');
                }

                log.debug('Suitelet URL', suiteletUrl);
                log.debug('OCR Suitelet URL', ocrSuiteletUrl);

                const dataScript = `
        <script>
          window.NETSUITE_CONTEXT = {
            suiteletUrl: '${suiteletUrl}',
            ocrSuiteletUrl: '${ocrSuiteletUrl}',
            userId: '${currentUser.id}',
            userName: '${currentUser.name}',
            role: '${currentUser.role}',
            n8nAiUrl: '${n8nAiUrl}'
          };
          window.NETSUITE_DATA = {
            opportunities: ${JSON.stringify(opportunities)},
            statusMapping: ${JSON.stringify(STATUS_MAPPING)},
            allStatuses: ${JSON.stringify(allStatuses)}
          };
          console.log('📋 Available Statuses:', window.NETSUITE_DATA.allStatuses);
          console.log('🔗 Status Mapping:', window.NETSUITE_DATA.statusMapping);
          console.log('🌐 Suitelet URL:', window.NETSUITE_CONTEXT.suiteletUrl);
          console.log('🤖 N8N URL:', window.NETSUITE_CONTEXT.n8nAiUrl ? 'Configured' : 'Missing');
        </script>
      `;
                htmlContent = htmlContent.replace('<head>', '<head>' + dataScript);

                // Add as inline HTML field
                const field = form.addField({
                    id: 'custpage_react_root',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'React App',
                });
                field.defaultValue = htmlContent;

            } catch (e) {
                log.error('UI Error', e.message);
                const field = form.addField({
                    id: 'custpage_error',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Error',
                });
                field.defaultValue = `
        <div style="padding: 20px; font-family: Arial;">
          <h2 style="color: red;">Error Loading Application</h2>
          <p>${e.message}</p>
        </div>
      `;
            }

            response.writePage(form);
        };

        return { onRequest };
    });
