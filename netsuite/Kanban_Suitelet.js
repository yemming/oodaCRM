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
define(['N/ui/serverWidget', 'N/file', 'N/runtime', 'N/search', 'N/record', 'N/log', 'N/url'],
    (serverWidget, file, runtime, search, record, log, url) => {

        const HTML_FILE_ID = 21487; // Internal ID of index.html

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
         * Maps Kanban column keys to actual NetSuite status IDs
         */
        const createStatusMapping = (statuses) => {
            const mapping = {};
            const reverseMapping = {};

            // Map common status names to kanban columns
            // Updated to match your NetSuite account's actual status names
            const nameToColumn = {
                // Qualified (first stage)
                'qualified': 'qualified',
                'qualification': 'qualified',
                'qualifying': 'qualified',

                // In Discussion
                'in discussion': 'in_discussion',
                'discussion': 'in_discussion',
                'identified decision makers': 'in_discussion',

                // Proposal
                'proposal': 'proposal',
                'proposal sent': 'proposal',
                'quote': 'proposal',

                // In Negotiation
                'in negotiation': 'in_negotiation',
                'negotiation': 'in_negotiation',
                'negotiating': 'in_negotiation',

                // Closed Won
                'closed won': 'closed_won',
                'closed - won': 'closed_won',
                'won': 'closed_won',

                // Closed Lost (not displayed but mapped for completeness)
                'closed lost': 'closed_lost',
                'closed - lost': 'closed_lost',
                'lost': 'closed_lost',
                'lost customer': 'closed_lost',

                // Others map to qualified by default
                'unqualified': 'qualified',
                'renewal': 'closed_won',
                'purchasing': 'in_negotiation',
            };

            statuses.forEach(status => {
                const normalizedName = status.name.toLowerCase().trim();
                const columnKey = nameToColumn[normalizedName];

                if (columnKey) {
                    mapping[columnKey] = parseInt(status.id);
                    reverseMapping[status.id] = columnKey;
                } else {
                    // Default: assign to prospecting if probability < 30, else negotiation
                    const probability = status.probability || 0;
                    let defaultColumn;
                    if (probability >= 90) defaultColumn = 'closed_won';
                    else if (probability >= 70) defaultColumn = 'proposal';
                    else if (probability >= 40) defaultColumn = 'negotiation';
                    else if (probability >= 20) defaultColumn = 'qualification';
                    else defaultColumn = 'prospecting';

                    reverseMapping[status.id] = defaultColumn;
                }
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
            const action = request.parameters.action ||
                (request.method === 'POST' && request.body ? JSON.parse(request.body).action : null);

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
                let opportunityId, newStatus;
                if (request.method === 'POST' && request.body) {
                    const body = JSON.parse(request.body);
                    opportunityId = body.opportunityId;
                    newStatus = body.newStatus;
                } else {
                    opportunityId = request.parameters.opportunityId;
                    newStatus = request.parameters.newStatus;
                }

                log.debug('API Request', `action=${action}, oppId=${opportunityId}, newStatus=${newStatus}`);
                log.debug('Status Mapping', JSON.stringify(STATUS_MAPPING));

                let result;
                if (action === 'updateStatus') {
                    result = updateOpportunityStatus(opportunityId, newStatus);
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
         * Update Opportunity Status
         */
        const updateOpportunityStatus = (opportunityId, newStatus) => {
            try {
                const statusId = STATUS_MAPPING[newStatus];
                if (!statusId) {
                    return { success: false, error: `Invalid status: ${newStatus}` };
                }

                record.submitFields({
                    type: record.Type.OPPORTUNITY,
                    id: opportunityId,
                    values: {
                        entitystatus: statusId
                    }
                });

                log.audit('Status Updated', `Opportunity ${opportunityId} -> ${newStatus} (${statusId})`);
                return { success: true, opportunityId, newStatus };
            } catch (e) {
                log.error('Update Error', e.message);
                return { success: false, error: e.message };
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
                    search.createColumn({ name: 'title' }),
                    search.createColumn({ name: 'entity' }),
                    search.createColumn({ name: 'entitystatus' }),
                    search.createColumn({ name: 'projectedtotal' }),
                    search.createColumn({ name: 'probability' }),
                    search.createColumn({ name: 'expectedclosedate' }),
                    search.createColumn({ name: 'salesrep' })
                ]
            });

            oppSearch.run().each((result) => {
                const statusId = result.getValue('entitystatus');
                const statusText = result.getText('entitystatus');
                const statusKey = STATUS_ID_TO_KEY[statusId] || 'prospecting'; // Default to prospecting

                opportunities.push({
                    id: result.getValue('internalid'),
                    title: result.getValue('title') || result.getText('entity') || 'Untitled',
                    customer: result.getText('entity') || '',
                    status: statusKey,
                    statusText: statusText,
                    amount: parseFloat(result.getValue('projectedtotal')) || 0,
                    probability: parseInt(result.getValue('probability')) || 0,
                    closeDate: result.getValue('expectedclosedate') || '',
                    salesRep: result.getText('salesrep') || ''
                });
                return true; // Continue iteration
            });

            log.debug('Opportunities Found', opportunities.length);
            return opportunities;
        };

        /**
         * Get Opportunity Status list for mapping
         */
        // Note: getStatusList is not used, replaced by getOpportunityStatuses

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

                log.debug('Suitelet URL', suiteletUrl);

                const dataScript = `
        <script>
          window.NETSUITE_CONTEXT = {
            suiteletUrl: '${suiteletUrl}',
            userId: '${currentUser.id}',
            userName: '${currentUser.name}',
            role: '${currentUser.role}'
          };
          window.NETSUITE_DATA = {
            opportunities: ${JSON.stringify(opportunities)},
            statusMapping: ${JSON.stringify(STATUS_MAPPING)},
            allStatuses: ${JSON.stringify(allStatuses)}
          };
          console.log('📋 Available Statuses:', window.NETSUITE_DATA.allStatuses);
          console.log('🔗 Status Mapping:', window.NETSUITE_DATA.statusMapping);
          console.log('🌐 Suitelet URL:', window.NETSUITE_CONTEXT.suiteletUrl);
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
