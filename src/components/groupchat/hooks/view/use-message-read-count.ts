import { useMemo } from 'react';
import { Message, GroupData, MembersMap } from '../../../../types/chat';
import { parseTimestampToMillis } from '../../../../utils/time-utils';

/**
 * Custom hook for computing how many members have read a given message.
 */
export const useMessageReadCount = (
  msg: Message,
  isMe: boolean,
  groupData: GroupData | null,
  membersMap: MembersMap
) => {
  return useMemo(() => {
    if (!isMe || !msg.createdAt || !groupData?.members) return 0;
    const msgTime = parseTimestampToMillis(msg.createdAt);
    const legacyLastReadAt = groupData.memberLastReadAt;
    let count = 0;

    for (const uid of groupData.members) {
      if (uid === msg.senderId) continue;

      const memberStatus = membersMap?.[uid];
      const readAt = memberStatus?.lastReadAt || legacyLastReadAt?.[uid];

      const didReadByTime = readAt && parseTimestampToMillis(readAt) >= msgTime;
      const didReact = msg.reactions && Object.values(msg.reactions).some(uids => uids.includes(uid));

      if (didReadByTime || didReact) {
        count++;
      }
    }
    return count;
  }, [isMe, msg.createdAt, msg.senderId, groupData?.members, groupData?.memberLastReadAt, membersMap, msg.reactions]);
};
