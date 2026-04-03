import { FC } from 'react';
import { useParams } from 'react-router-dom';
import LeaveGroupButton from "../Button/LeaveGroupButton";
import DeleteGroupButton from "../Button/DeleteGroupButton";
import { Group } from '../../types/chat';

interface GroupDetailsProps {
    group: Group | null;
}

const GroupDetails: FC<GroupDetailsProps> = ({ group }) => {
    const { id } = useParams<{ id: string }>();

    if (!group) return <p>Loading...</p>;

    return (
        <div className="group-details">
            <h2>{group.name}</h2>
            <p>{group.description}</p>
            <p>Members: {group.members?.length || 0}</p>

            <LeaveGroupButton groupId={id || ""} />
            <DeleteGroupButton groupId={id || ""} ownerUserId={group.ownerUserId || ""} />
        </div>
    );
};

export default GroupDetails;
