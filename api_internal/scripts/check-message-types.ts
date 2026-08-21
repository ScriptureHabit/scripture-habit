import fs from 'fs';
import path from 'path';
import { MessageTypeEnumValues } from '../../src/types/schemas.js';

/**
 * Script to detect mismatches between Backend System Message types,
 * Frontend Schema (MessageTypeSchema), and UI rendering components.
 */

const schemaEnumKeys = new Set<string>(MessageTypeEnumValues);

function getFilesRecursively(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(fullPath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(fullPath);
        }
    }
    return results;
}

function checkMessageTypeConsistency() {
    console.log('🔍 Checking System Message Types consistency between Backend & Frontend...\n');
    console.log(`📋 Defined MessageTypeSchema values (${schemaEnumKeys.size}):`, Array.from(schemaEnumKeys).join(', '));
    console.log('');

    const projectRoot = process.cwd();
    const backendFiles = getFilesRecursively(path.join(projectRoot, 'api_internal'));
    const systemMessageComponentPath = path.join(projectRoot, 'src', 'components', 'groupchat', 'subcomponents', 'system-message.tsx');

    const backendMessageTypes = new Set<string>();
    const messageTypeRegex = /messageType:\s*['"]([a-zA-Z0-9_-]+)['"]/g;

    for (const filePath of backendFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        let match;
        while ((match = messageTypeRegex.exec(content)) !== null) {
            backendMessageTypes.add(match[1]);
        }
    }

    console.log(`📡 Backend emits the following messageType values:`);
    backendMessageTypes.forEach(type => console.log(`   - ${type}`));
    console.log('');

    let errors = 0;

    // 1. Verify all Backend messageType values exist in Frontend MessageTypeSchema
    console.log('📋 Verifying Backend messageType values exist in MessageTypeSchema (schemas.ts)...');
    for (const type of backendMessageTypes) {
        if (!schemaEnumKeys.has(type)) {
            console.log(`❌ ERROR: messageType '${type}' is emitted by backend but MISSING in MessageTypeSchema!`);
            errors++;
        }
    }

    // 2. Verify all MessageType values are handled in system-message.tsx
    if (fs.existsSync(systemMessageComponentPath)) {
        console.log('\n🎨 Verifying MessageType values are handled in SystemMessage.tsx UI...');
        const componentContent = fs.readFileSync(systemMessageComponentPath, 'utf-8');

        for (const type of schemaEnumKeys) {
            if (type === 'text' || type === 'system' || type === 'studyNote') continue; // Non-announcement types

            const hasTypeHandler = componentContent.includes(`msg.messageType === '${type}'`) ||
                                  componentContent.includes(`msg.messageType === "${type}"`);
            
            if (!hasTypeHandler) {
                console.log(`⚠️ WARNING: MessageType '${type}' is defined in schema but has no explicit handler in SystemMessage.tsx!`);
                errors++;
            }
        }
    }

    if (errors === 0) {
        console.log('\n✅ PERFECT! All System Message Types are 100% consistent across Backend, Schema, and UI.\n');
        process.exit(0);
    } else {
        console.log(`\n❌ Found ${errors} consistency error(s). Please resolve them before proceeding.\n`);
        process.exit(1);
    }
}

checkMessageTypeConsistency();
