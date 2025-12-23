/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * 
 * OCR Suitelet
 * Receives file upload from Frontend.
 * Actions:
 * 1. 'analyzeCard': Sends to N8N for OCR.
 * 2. 'createRecord': Creates/Updates Customer and Contact in NetSuite.
 */
define(['N/https', 'N/search', 'N/log', 'N/runtime', 'N/record', 'N/file'],
    (https, search, log, runtime, record, file) => {

        const CONFIG_RECORD_TYPE = 'customrecord_ooda_config';
        const FIELD_KEY = 'custrecord_ooda_config_key';
        const FIELD_VALUE = 'custrecord_ooda_config_value';
        const KEY_N8N_URL = 'n8n_url';
        const KEY_OCR_FOLDER = 'ocr_folder_id';
        const KEY_N8N_AUTH = 'n8n_key';

        // Folder to store Business Cards. 
        const TARGET_FOLDER_NAME = 'OODA Business Cards';

        /**
         * Get current config value by key
         */
        const getConfigValue = (key) => {
            let value = '';
            search.create({
                type: CONFIG_RECORD_TYPE,
                filters: [[FIELD_KEY, 'is', key]],
                columns: [FIELD_VALUE]
            }).run().each(result => {
                value = result.getValue(FIELD_VALUE);
                return false;
            });
            return value;
        };

        const getOrCreateFolder = () => {
            // Priority 1: Check Configured Folder ID
            const configuredId = getConfigValue(KEY_OCR_FOLDER);
            log.debug('getOrCreateFolder config check', `Configured ID: ${configuredId}`);

            if (configuredId) {
                return parseInt(configuredId, 10);
            }

            // Priority 2: Search for folder
            let folderId;
            search.create({
                type: 'folder',
                filters: [['name', 'is', TARGET_FOLDER_NAME]]
            }).run().each(result => {
                folderId = result.id;
                return false;
            });

            log.debug('getOrCreateFolder search check', `Found Folder ID: ${folderId}`);

            if (folderId) return parseInt(folderId, 10);

            // Priority 3: Create if not found (Top level)
            try {
                const folderRec = record.create({ type: 'folder' });
                folderRec.setValue({ fieldId: 'name', value: TARGET_FOLDER_NAME });
                const newFolderId = folderRec.save();
                log.audit('Folder Created', `New Folder ID: ${newFolderId}`);
                return parseInt(newFolderId, 10);
            } catch (e) {
                log.error('Folder Creation Failed', e.message);
                throw new Error('Failed to create or find folder: ' + e.message);
            }
        };

        const findCustomerByName = (companyName) => {
            if (!companyName) return null;
            let customerId = null;
            search.create({
                type: record.Type.CUSTOMER,
                filters: [['companyname', 'is', companyName]],
                columns: ['internalid']
            }).run().each(result => {
                customerId = result.id;
                return false;
            });
            return customerId;
        };

        /**
         * Get Default Subsidiary (First active one found)
         */
        const getDefaultSubsidiary = () => {
            let subsidiaryId = null;
            // Basic search for any active subsidiary
            search.create({
                type: 'subsidiary',
                filters: [['isinactive', 'is', 'F']],
                columns: ['internalid']
            }).run().each(result => {
                subsidiaryId = result.id;
                return false; // Return first found
            });

            // If no subsidiary found (e.g. single company account?), return null.
            // NetSuite Single Company does not require subsidiary field, so null is fine.
            return subsidiaryId;
        };

        const handleAnalyzeCard = (body, response) => {
            const { fileContent, fileName, fileType } = body;
            if (!fileContent) throw new Error('No file content provided');

            const n8nUrl = getConfigValue(KEY_N8N_URL);
            log.debug('OCR Config Check', `Using N8N URL: ${n8nUrl}`);
            const n8nKey = getConfigValue(KEY_N8N_AUTH);
            if (!n8nUrl) throw new Error('N8N Webhook URL not configured.');

            log.debug('Sending to N8N', `URL: ${n8nUrl}, File: ${fileName}`);

            const n8nPayload = {
                requestType: 'ocr_namecard',
                fileName: fileName,
                fileType: fileType,
                data: fileContent
            };

            const cleanKey = (n8nKey || '').trim();
            const headers = {
                'Content-Type': 'application/json',
                'n8nkey': cleanKey
            };
            log.debug('N8N Request Headers', JSON.stringify({
                ...headers,
                'n8nkey': cleanKey ? `${cleanKey.substring(0, 4)}...***` : 'MISSING'
            }));

            const n8nResponse = https.post({
                url: n8nUrl,
                headers: headers,
                body: JSON.stringify(n8nPayload)
            });

            if (n8nResponse.code === 200) {
                let responseData;
                try {
                    responseData = JSON.parse(n8nResponse.body);
                    // Handle N8N "All Incoming Items" array format: [{ "output": { ... } }]
                    if (Array.isArray(responseData) && responseData.length > 0 && responseData[0].output) {
                        responseData = responseData[0].output;
                    } else if (Array.isArray(responseData) && responseData.length > 0) {
                        responseData = responseData[0];
                    }
                } catch (e) {
                    responseData = { raw: n8nResponse.body };
                }

                return { success: true, data: responseData };
            } else {
                throw new Error(`N8N returned status ${n8nResponse.code}: ${n8nResponse.body}`);
            }
        };

        const handleCreateRecord = (body) => {
            const { ocrData, fileContent, fileName, fileType } = body;
            if (!ocrData) throw new Error('No OCR data provided');

            log.debug('Creating Record', JSON.stringify(ocrData));

            // 1. Check or Create Customer
            let customerId = findCustomerByName(ocrData.company);
            let isNewCustomer = false;

            if (!customerId && ocrData.company) {
                // Create New Customer
                const customerRec = record.create({ type: record.Type.CUSTOMER, isDynamic: true });
                customerRec.setValue({ fieldId: 'isperson', value: 'F' });
                customerRec.setValue({ fieldId: 'companyname', value: ocrData.company });

                // Set Subsidiary based on Current User (Context: OneWorld)
                const currentUser = runtime.getCurrentUser();
                const userSubsidiary = currentUser.subsidiary;

                if (userSubsidiary) {
                    customerRec.setValue({ fieldId: 'subsidiary', value: userSubsidiary });
                    log.debug('Setting Subsidiary from User', userSubsidiary);
                } else {
                    log.debug('No Subsidiary found for User', 'Skipping subsidiary field');
                }

                if (ocrData.email) customerRec.setValue({ fieldId: 'email', value: ocrData.email });
                if (ocrData.website) customerRec.setValue({ fieldId: 'url', value: ocrData.website });

                customerId = customerRec.save();
                isNewCustomer = true;
                log.audit('New Customer Created', `ID: ${customerId}, Name: ${ocrData.company}, Sub: ${userSubsidiary}`);
            } else {
                if (customerId) log.audit('Existing Customer Found', `ID: ${customerId}, Name: ${ocrData.company}`);
            }

            // 2. Create Contact
            const contactRec = record.create({ type: record.Type.CONTACT, isDynamic: true });

            // Link to Customer
            if (customerId) {
                contactRec.setValue({ fieldId: 'company', value: customerId });
            }

            // Also set subsidiary for Contact if distinct? Usually inherits from Company. 
            // But if no company (standalone contact), might need it. 
            // Here we assume we always have a company or created one.

            contactRec.setValue({ fieldId: 'firstname', value: ocrData.firstName || 'Unknown' });
            contactRec.setValue({ fieldId: 'lastname', value: ocrData.lastName || 'Unknown' });
            if (ocrData.jobTitle) contactRec.setValue({ fieldId: 'title', value: ocrData.jobTitle });
            if (ocrData.email) contactRec.setValue({ fieldId: 'email', value: ocrData.email });
            if (ocrData.mobile) contactRec.setValue({ fieldId: 'mobilephone', value: ocrData.mobile });

            let comments = ocrData.notes || '';
            contactRec.setValue({ fieldId: 'comments', value: comments });

            // Handle Address
            if (ocrData.address) {
                contactRec.selectNewLine({ sublistId: 'addressbook' });
                const addressSubrecord = contactRec.getCurrentSublistSubrecord({ sublistId: 'addressbook', fieldId: 'addressbookaddress' });
                // Default Country to Taiwan if detected, else let NetSuite default
                if (ocrData.address.toLowerCase().includes('taiwan') || (ocrData.mobile && ocrData.mobile.startsWith('+886'))) {
                    addressSubrecord.setValue({ fieldId: 'country', value: 'TW' });
                }
                addressSubrecord.setValue({ fieldId: 'addr1', value: ocrData.address });
                contactRec.commitLine({ sublistId: 'addressbook' });
            }

            const contactId = contactRec.save();
            log.audit('New Contact Created', `ID: ${contactId}, Name: ${ocrData.firstName} ${ocrData.lastName}`);

            // 3. Save and Attach File
            let fileId = null;
            let fileErrorMessage = null;
            let usedFolderId = null;

            if (fileContent) {
                try {
                    const folderId = getOrCreateFolder();
                    usedFolderId = folderId;

                    // Map MIME type to NetSuite File Type
                    // Using string literals to avoid potential Enum access issues
                    let nsFileType = 'PNGIMAGE'; // Default
                    if (fileType) {
                        const lowerType = fileType.toLowerCase();
                        if (lowerType.includes('jpeg') || lowerType.includes('jpg')) nsFileType = 'JPGIMAGE';
                        if (lowerType.includes('pdf')) nsFileType = 'PDF';
                        if (lowerType.includes('bmp')) nsFileType = 'BMPIMAGE';
                    }

                    log.debug('File Type Resolved', `Input: ${fileType}, Output: ${nsFileType}`);

                    const fileObj = file.create({
                        name: fileName || `card_${contactId}.${(nsFileType === 'PDF') ? 'pdf' : 'png'}`,
                        fileType: nsFileType,
                        contents: fileContent,
                        folder: folderId
                    });
                    fileId = fileObj.save();

                    // Attach to Contact
                    record.attach({
                        record: { type: 'file', id: fileId },
                        to: { type: 'contact', id: contactId }
                    });

                    log.audit('File Attached', `File ID: ${fileId} (${nsFileType}) to Contact ID: ${contactId}`);
                } catch (e) {
                    log.error('File Save Error', e.message);
                    fileErrorMessage = e.message;
                }
            }

            return {
                success: true,
                data: {
                    customerId: customerId,
                    contactId: contactId,
                    fileId: fileId,
                    isNewCustomer: isNewCustomer,
                    fileError: fileErrorMessage,
                    debugFolderId: usedFolderId
                }
            };
        };

        const onRequest = (context) => {
            const { request, response } = context;

            // Set CORS headers
            response.setHeader({ name: 'Access-Control-Allow-Origin', value: '*' });
            response.setHeader({ name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' });
            response.setHeader({ name: 'Access-Control-Allow-Headers', value: 'Content-Type' });

            if (request.method === 'OPTIONS') { response.write(''); return; }
            if (request.method !== 'POST') {
                response.write(JSON.stringify({ success: false, error: 'Method not allowed' }));
                return;
            }

            try {
                const body = JSON.parse(request.body);
                const action = body.action || 'analyzeCard'; // Default to analyze

                let result;
                if (action === 'createRecord') {
                    result = handleCreateRecord(body);
                } else {
                    result = handleAnalyzeCard(body, response);
                }

                response.setHeader({ name: 'Content-Type', value: 'application/json' });
                response.write(JSON.stringify(result));

            } catch (e) {
                log.error('Suitelet Error', e.message);
                response.setHeader({ name: 'Content-Type', value: 'application/json' });
                response.write(JSON.stringify({ success: false, error: e.message }));
            }
        };

        return { onRequest };
    });
