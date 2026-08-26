import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

/**
 * Extract project ID from CLI arguments or environment variables
 */
function getProjectId(): string {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--project' && args[i + 1]) {
            return args[i + 1];
        }
        if (args[i].startsWith('--project=')) {
            return args[i].split('=')[1];
        }
        if (!args[i].startsWith('-')) {
            return args[i];
        }
    }
    return process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'scripture-habit-auth';
}

/**
 * Firestore TTL Policy Setup Script
 * 
 * Configures TTL (Time to Live) on `letters` and `recaps` collection groups
 * targeting the `expiresAt` field.
 */
async function setupTTL() {
    const projectId = getProjectId();
    console.log(`🚀 Setting up Firestore TTL policies for project: [${projectId}]...`);

    console.log('\n📦 Method 1: Deploying via Firebase CLI (firestore.indexes.json)...');
    try {
        execSync(`firebase deploy --only firestore:indexes --project ${projectId}`, { stdio: 'inherit' });
        console.log('✅ TTL policies deployed successfully via Firebase CLI!');
        return;
    } catch (e) {
        console.warn('⚠️  Firebase CLI deploy skipped or failed:', (e as Error).message);
    }

    console.log('\n📦 Method 2: Fallback to gcloud CLI (--async)...');
    try {
        console.log('Enabling TTL on letters.expiresAt...');
        execSync(`gcloud firestore fields ttls update expiresAt --collection-group=letters --enable-ttl --project=${projectId} --async`, { stdio: 'inherit' });
        
        console.log('Enabling TTL on recaps.expiresAt...');
        execSync(`gcloud firestore fields ttls update expiresAt --collection-group=recaps --enable-ttl --project=${projectId} --async`, { stdio: 'inherit' });
        
        console.log('\n✅ TTL policy update requests successfully submitted to Google Cloud!');
        console.log('Firestore is now configuring the TTL policies in the background.');
    } catch (e) {
        console.error('❌ gcloud CLI execution failed:', (e as Error).message);
        console.log('\n💡 Alternatively, you can enable TTL directly in Firebase Console:');
        console.log('   1. Open Firebase Console -> Firestore Database -> TTL tab');
        console.log('   2. Add policy for collection "letters", field "expiresAt"');
        console.log('   3. Add policy for collection "recaps", field "expiresAt"');
    }
}

setupTTL().catch(console.error);
