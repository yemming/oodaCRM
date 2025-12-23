/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * 
 * OCR Page Suitelet
 * Serves the React application in "Standalone OCR" mode.
 */
define(['N/ui/serverWidget', 'N/file', 'N/runtime', 'N/log', 'N/url'],
    (serverWidget, file, runtime, log, url) => {

        const HTML_FILE_ID = 21488; // Internal ID of index.html (Shared with Kanban Suitelet)

        const onRequest = (context) => {
            const { request, response } = context;

            if (request.method === 'GET') {
                const form = serverWidget.createForm({ title: 'Business Card OCR' });

                try {
                    // Load HTML file
                    // <!-- START HTML LOAD -->
                    // Load HTML file (Legacy method - will be replaced by build script)
                    const htmlFile = file.load({ id: HTML_FILE_ID });
                    let htmlContent = htmlFile.getContents();
                    // <!-- END HTML LOAD -->

                    const currentUser = runtime.getCurrentUser();

                    // Resolve URLs
                    const scriptId = runtime.getCurrentScript().id;
                    const deploymentId = runtime.getCurrentScript().deploymentId;
                    const suiteletUrl = url.resolveScript({
                        scriptId: scriptId,
                        deploymentId: deploymentId,
                        returnExternalUrl: false
                    });

                    let ocrSuiteletUrl = '';
                    try {
                        ocrSuiteletUrl = url.resolveScript({
                            scriptId: 'customscript_ooda_ocr_suitelet',
                            deploymentId: 'customdeploy_ooda_ocr_suitelet',
                            returnExternalUrl: false
                        });
                    } catch (e) {
                        log.error('OCR Suitelet Resolution Warning', 'Could not resolve customscript_ooda_ocr_suitelet.');
                    }

                    // Inject Context for Standalone Mode
                    const dataScript = `
        <script>
          window.NETSUITE_CONTEXT = {
            suiteletUrl: '${suiteletUrl}',
            ocrSuiteletUrl: '${ocrSuiteletUrl}',
            userId: '${currentUser.id}',
            userName: '${currentUser.name}',
            role: '${currentUser.role}',
            pageType: 'ocr_standalone' // This triggers the standalone view in App.tsx
          };
          console.log('Using Standalone OCR Mode');
        </script>
      `;
                    htmlContent = htmlContent.replace('<head>', '<head>' + dataScript);

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
                    field.defaultValue = `<div style="color: red;">Error Loading Application: ${e.message}</div>`;
                }

                response.writePage(form);
            }
        };

        return { onRequest };
    });
