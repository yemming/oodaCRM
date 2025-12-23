/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * 
 * OODA CRM Settings Suitelet
 * Allows configuration of external API URLs (e.g. N8N Webhooks)
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/log'],
    (serverWidget, record, search, log) => {

        const CONFIG_RECORD_TYPE = 'customrecord_ooda_config';
        const FIELD_KEY = 'custrecord_ooda_config_key';
        const FIELD_VALUE = 'custrecord_ooda_config_value';

        const KEY_AI_INSIGHT = 'n8n_url'; // Using standard key name for main N8N URL
        const KEY_N8N_AUTH = 'n8n_key';
        const KEY_OCR_FOLDER = 'ocr_folder_id';

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

        /**
         * Save config value (update or create)
         */
        const saveConfigValue = (key, value) => {
            let internalId = null;
            search.create({
                type: CONFIG_RECORD_TYPE,
                filters: [[FIELD_KEY, 'is', key]],
                sorts: [{ name: 'internalid', sort: search.Sort.DESC }] // MATCH READ LOGIC: Get latest config
            }).run().each(result => {
                internalId = result.id;
                return false;
            });

            log.debug('saveConfigValue', `Key: ${key}, Found Existing ID: ${internalId || 'None (Creating New)'}`);

            let rec;
            if (internalId) {
                rec = record.load({ type: CONFIG_RECORD_TYPE, id: internalId });
            } else {
                rec = record.create({ type: CONFIG_RECORD_TYPE });
                rec.setValue({ fieldId: 'name', value: key }); // Set mandatory Name field
                rec.setValue({ fieldId: FIELD_KEY, value: key });
            }
            rec.setValue({ fieldId: FIELD_VALUE, value: value || '' });
            rec.save();
        };

        const onRequest = (context) => {
            const { request, response } = context;

            if (request.method === 'GET') {
                const form = serverWidget.createForm({ title: 'OODA CRM Settings' });

                form.addFieldGroup({ id: 'group_n8n', label: 'External Integrations' });

                const urlField = form.addField({
                    id: 'custpage_n8n_url',
                    type: serverWidget.FieldType.TEXT,
                    label: 'N8N Webhook URL',
                    container: 'group_n8n'
                });
                urlField.isMandatory = true;
                urlField.isMandatory = true;
                urlField.defaultValue = getConfigValue(KEY_AI_INSIGHT);

                const keyField = form.addField({
                    id: 'custpage_n8n_key',
                    type: serverWidget.FieldType.TEXT, // Or PASSWORD if we want to mask it, but TEXT is easier to debug for now
                    label: 'N8N Header Auth Key',
                    container: 'group_n8n'
                });
                keyField.isMandatory = false;
                keyField.defaultValue = getConfigValue(KEY_N8N_AUTH);
                keyField.setHelpText({ help: 'The value for the "n8nkey" header in N8N Header Auth.' });

                const folderField = form.addField({
                    id: 'custpage_ocr_folder',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Business Card Folder ID (File Cabinet)',
                    container: 'group_n8n'
                });
                folderField.isMandatory = false;
                folderField.defaultValue = getConfigValue(KEY_OCR_FOLDER);
                folderField.setHelpText({ help: 'Enter the Internal ID of the file cabinet folder where business cards should be saved.' });

                form.addSubmitButton({ label: 'Save Settings' });

                response.writePage(form);

            } else { // POST
                const n8nUrl = request.parameters.custpage_n8n_url;
                const n8nKey = request.parameters.custpage_n8n_key;
                const folderId = request.parameters.custpage_ocr_folder;

                saveConfigValue(KEY_AI_INSIGHT, n8nUrl);
                saveConfigValue(KEY_N8N_AUTH, n8nKey);
                saveConfigValue(KEY_OCR_FOLDER, folderId);

                const form = serverWidget.createForm({ title: 'OODA CRM Settings' });
                const msgField = form.addField({
                    id: 'custpage_msg',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Message'
                });
                msgField.defaultValue = '<div style="color: green; font-weight: bold; margin-bottom: 10px;">Settings Saved Successfully</div>';

                form.addFieldGroup({ id: 'group_n8n', label: 'External Integrations' });

                const urlField = form.addField({
                    id: 'custpage_n8n_url',
                    type: serverWidget.FieldType.TEXT,
                    label: 'N8N Webhook URL',
                    container: 'group_n8n'
                });
                urlField.defaultValue = n8nUrl;

                const keyField = form.addField({
                    id: 'custpage_n8n_key',
                    type: serverWidget.FieldType.TEXT,
                    label: 'N8N Header Auth Key',
                    container: 'group_n8n'
                });
                keyField.defaultValue = n8nKey;

                const folderField = form.addField({
                    id: 'custpage_ocr_folder',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Business Card Folder ID (File Cabinet)',
                    container: 'group_n8n'
                });
                folderField.defaultValue = folderId;

                form.addSubmitButton({ label: 'Save Settings' });
                response.writePage(form);
            }
        };

        return { onRequest };
    });
