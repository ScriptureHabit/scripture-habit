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

            // Deduplicate members across all targeted groups to prevent multiple notifications.
            // If a member is in multiple targeted groups, we only notify them once, 
            // pointing them to the first group encountered in the share list.
            const memberToGroupIdMap = new Map<string, string>();
            userToGroupMapEntries.forEach(([memberUid, gid]) => {
                if (!memberToGroupIdMap.has(memberUid)) {
                    memberToGroupIdMap.set(memberUid, gid);
                }
            });

            // Reconstruct the mapping of groupId to its unique set of members to notify
            const groupsToNotifyMap = new Map<string, string[]>();
            memberToGroupIdMap.forEach((gid, memberUid) => {
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
