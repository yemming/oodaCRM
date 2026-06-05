/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * 
 * OCR Suitelet
 * Receives file upload from Frontend.
 * Actions:
 * 1. 'analyzeCard': 伺服器端直接呼叫 Google Gemini 做名片 OCR（API key 走 NetSuite Secret）。
 * 2. 'createRecord': Creates/Updates Customer and Contact in NetSuite.
 */
define(['N/https', 'N/search', 'N/log', 'N/runtime', 'N/record', 'N/file'],
    (https, search, log, runtime, record, file) => {

        const CONFIG_RECORD_TYPE = 'customrecord_ooda_config';
        const FIELD_KEY = 'custrecord_ooda_config_key';
        const FIELD_VALUE = 'custrecord_ooda_config_value';
        const KEY_OCR_FOLDER = 'ocr_folder_id';

        // === Google Gemini OCR 設定 ===
        // API key 一律不寫進程式碼：改用 NetSuite Secret 注入。
        // ⚠️ 記得到該 Secret 的 Restrictions 分頁，允許「本 Suitelet script」與
        //    網域「generativelanguage.googleapis.com」，否則 https 呼叫會被擋。
        const GEMINI_SECRET_ID = 'custsecret_einv_gemini_key';
        const GEMINI_MODEL = 'gemini-2.5-flash';
        const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

        // 名片擷取欄位（與前端 OCRResult 介面一一對應）
        const CARD_FIELDS = ['lastName', 'firstName', 'chineseName', 'englishName',
            'company', 'jobTitle', 'unifiedBusinessNumber', 'email', 'mobile', 'website', 'address', 'notes'];

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
                columns: [FIELD_VALUE],
                sorts: [{ name: 'internalid', sort: search.Sort.DESC }] // Get latest config
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

        // 將前端傳來的 MIME type 對應到 Gemini 支援的格式
        const resolveMimeType = (fileType) => {
            const t = (fileType || '').toLowerCase();
            if (t.includes('pdf')) return 'application/pdf';
            if (t.includes('jpeg') || t.includes('jpg')) return 'image/jpeg';
            if (t.includes('webp')) return 'image/webp';
            return 'image/png';
        };

        // 動態組出 Gemini structured output 的 responseSchema（全欄位皆字串）
        const buildCardSchema = () => {
            const properties = {};
            CARD_FIELDS.forEach((f) => { properties[f] = { type: 'STRING' }; });
            return { type: 'OBJECT', properties: properties, propertyOrdering: CARD_FIELDS };
        };

        // 確保回傳物件含所有欄位、皆為已 trim 的字串（缺的補空字串）
        const normalizeCard = (raw) => {
            const out = {};
            CARD_FIELDS.forEach((f) => {
                out[f] = (raw && raw[f] != null) ? String(raw[f]).trim() : '';
            });
            return out;
        };

        const OCR_PROMPT = [
            '你是專業的名片資訊擷取助理。請從這張名片擷取資訊，並依指定 JSON 結構回傳。',
            '規則：',
            '- chineseName：名片上的中文姓名（無則空字串）',
            '- englishName：名片上的英文姓名（無則空字串）',
            '- lastName / firstName：英文姓名的姓 / 名（若名片只有中文可留空，後端會另行拆字）',
            '- company：公司全名',
            '- jobTitle：職稱',
            '- unifiedBusinessNumber：台灣統一編號（8 碼數字，無則空字串）',
            '- email / mobile / website / address：對應聯絡資訊；mobile 優先取行動電話，無行動電話才填市話',
            '- notes：其他補充（部門、傳真、Line ID、分機等）',
            '- 找不到的欄位一律回傳空字串 ""，禁止捏造。'
        ].join('\n');

        const handleAnalyzeCard = (body) => {
            const { fileContent, fileType } = body;
            if (!fileContent) throw new Error('No file content provided');

            const mimeType = resolveMimeType(fileType);
            log.debug('Gemini OCR', `Model: ${GEMINI_MODEL}, MIME: ${mimeType}`);

            const geminiBody = {
                contents: [{
                    parts: [
                        { text: OCR_PROMPT },
                        { inline_data: { mime_type: mimeType, data: fileContent } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                    responseSchema: buildCardSchema()
                }
            };

            // API key 由 NetSuite Secret 以 {custsecret_...} 佔位符注入 header；
            // SecureString 全程不出現在程式碼與 log（curly braces 是 NetSuite 解析 secret 的語法）
            const apiKeySecure = https.createSecureString({ input: '{' + GEMINI_SECRET_ID + '}' });

            const geminiResponse = https.post({
                url: GEMINI_ENDPOINT,
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKeySecure
                },
                body: JSON.stringify(geminiBody)
            });

            if (geminiResponse.code !== 200) {
                log.error('Gemini API Error', `Status ${geminiResponse.code}: ${geminiResponse.body}`);
                throw new Error(`Gemini API 回傳 ${geminiResponse.code}。請確認 API Key 是否有效，以及 Secret「${GEMINI_SECRET_ID}」的 Restrictions 已允許本 script 與網域 generativelanguage.googleapis.com。`);
            }

            let parsed;
            try {
                parsed = JSON.parse(geminiResponse.body);
            } catch (e) {
                throw new Error('Gemini 回應非 JSON：' + String(geminiResponse.body).substring(0, 200));
            }

            const candidate = parsed && parsed.candidates && parsed.candidates[0];
            const text = candidate && candidate.content && candidate.content.parts
                && candidate.content.parts[0] && candidate.content.parts[0].text;

            if (!text) {
                const reason = (candidate && candidate.finishReason)
                    || (parsed && parsed.promptFeedback && parsed.promptFeedback.blockReason)
                    || 'no content';
                throw new Error('Gemini 未回傳結果（' + reason + '）');
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                // 萬一被包了 markdown ```json fence，清掉再 parse
                const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
                data = JSON.parse(cleaned);
            }

            return { success: true, data: normalizeCard(data) };
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

                if (ocrData.website) {
                    let websiteUrl = ocrData.website;
                    if (websiteUrl && !websiteUrl.match(/^https?:\/\//)) {
                        websiteUrl = 'https://' + websiteUrl;
                    }
                    customerRec.setValue({ fieldId: 'url', value: websiteUrl });
                }

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

            // Determine Name Parts
            let firstName = ocrData.firstName || 'Unknown';
            let lastName = ocrData.lastName || 'Unknown';

            if (ocrData.chineseName && ocrData.chineseName.length > 0) {
                // User Requirement: 
                // Last Name: The first character.
                // First Name: All remaining characters.
                lastName = ocrData.chineseName.substring(0, 1);
                firstName = ocrData.chineseName.substring(1);
            }

            contactRec.setValue({ fieldId: 'firstname', value: firstName });
            contactRec.setValue({ fieldId: 'lastname', value: lastName });
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
                    result = handleAnalyzeCard(body);
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
