import { notifyGroupMembers } from '../lib/notifications.js';
import { t } from '../lib/i18n.js';

export class NotificationService {
    /**
     * Notify group members about a new note.
     */
    static async notifyNotePosted(options: { 
        groupIds: string[], 
        senderUid: string, 
        senderNickname: string, 
        language?: string | null,
        userToGroupMapEntries: [string, string][] 
    }) {
        const { senderUid, senderNickname, language, userToGroupMapEntries } = options;
        
        try {
            const notifTitle = t(language, 'notifications.note_posted_title');
            const notifBody = t(language, 'notifications.note_posted_body', { 
                nickname: senderNickname || 'Member' 
            });

            const groupsToNotifyMap = new Map<string, string[]>();
            userToGroupMapEntries.forEach(([memberUid, gid]) => {
                if (!groupsToNotifyMap.has(gid)) groupsToNotifyMap.set(gid, []);
                groupsToNotifyMap.get(gid)!.push(memberUid);
            });

            await Promise.all(Array.from(groupsToNotifyMap.entries()).map(([gid, membersList]) => 
                notifyGroupMembers(gid, senderUid, { 
                    title: notifTitle, 
                    body: notifBody, 
                    data: { type: 'note', groupId: gid } 
                }, membersList)
            ));
        } catch (err) {
            console.error('[NotificationService] Error:', err);
        }
    }
}
