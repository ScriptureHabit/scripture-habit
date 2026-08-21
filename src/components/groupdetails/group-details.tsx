import { useParams, Navigate } from 'react-router-dom';
import LeaveGroupButton from "../button/leave-group-button";
import { Group } from '../../types/chat';
import { useLanguage } from '../../hooks/use-language';

interface GroupDetailsProps {
    group?: Group | null;
}

const GroupDetails = ({ group }: GroupDetailsProps) => {
    const { id } = useParams<{ id: string }>();
    const { language } = useLanguage();

    if (!group && id) {
        return <Navigate to={`/${language}/dashboard?groupId=${id}&view=2`} replace />;
    }

    if (!group) return <p>Loading...</p>;

    return (
        <div className="group-details">
            <h2>{group.name}</h2>
            <p>{group.description}</p>
            <p>Members: {group.members?.length || 0}</p>

            <LeaveGroupButton groupId={id || ""} />
        </div>
    );
};

export default GroupDetails;
