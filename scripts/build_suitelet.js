import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const HTML_PATH = path.join(__dirname, '../dist/index.html');

const TARGETS = [
    {
        input: path.join(__dirname, '../netsuite/Kanban_Suitelet.js'),
        output: path.join(__dirname, '../dist/Kanban_Suitelet_App.js')
    },
    {
        input: path.join(__dirname, '../netsuite/OCR_Page_Suitelet.js'),
        output: path.join(__dirname, '../dist/OCR_Page_Suitelet_App.js')
    }
];

console.log('🚀 Starting Suitelet Build Process...');

try {
    // 1. Read the built HTML file
    if (!fs.existsSync(HTML_PATH)) {
        throw new Error(`HTML file not found at ${HTML_PATH}. Did you run 'npm run build' first?`);
    }
    const htmlContent = fs.readFileSync(HTML_PATH, 'utf8');
    console.log(`✅ Loaded HTML content (${htmlContent.length} bytes)`);

    // Escape backticks and standard template literal interruptions
    const escapedHtml = htmlContent
        .replace(/\\/g, '\\\\') // Escape backslashes
        .replace(/`/g, '\\`')   // Escape backticks
        .replace(/\$/g, '\\$'); // Escape dollar signs

    // 2. Process each target
    TARGETS.forEach(target => {
        console.log(`Processing ${path.basename(target.input)}...`);

        if (!fs.existsSync(target.input)) {
            throw new Error(`Suitelet file not found at ${target.input}`);
        }
        let suiteletContent = fs.readFileSync(target.input, 'utf8');

        const markerStart = '// <!-- START HTML LOAD -->';
        const markerEnd = '// <!-- END HTML LOAD -->';

        const startIndex = suiteletContent.indexOf(markerStart);
        const endIndex = suiteletContent.indexOf(markerEnd);

        if (startIndex === -1 || endIndex === -1) {
            console.warn(`⚠️  Warning: Markers not found in ${path.basename(target.input)}. Skipping...`);
            return;
        }

        const replacementBlock = `
                    // 🔹 INJECTED HTML CONTENT (Build Time: ${new Date().toISOString()})
                    let htmlContent = \`${escapedHtml}\`;
                    // 🔹 END INJECTED CONTENT
        `;

        const newContent =
            suiteletContent.substring(0, startIndex) +
            replacementBlock +
            suiteletContent.substring(endIndex + markerEnd.length);

        // Ensure output dir exists
        if (!fs.existsSync(path.dirname(target.output))) {
            fs.mkdirSync(path.dirname(target.output), { recursive: true });
        }
        fs.writeFileSync(target.output, newContent, 'utf8');

        console.log(`   👉 Generated: ${target.output}`);
    });

    console.log('🎉 All Suitelets successfully built!');

} catch (e) {
    console.error(`❌ Build Failed: ${e.message}`);
    process.exit(1);
}
