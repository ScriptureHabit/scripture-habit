import { FC, ReactNode } from 'react';
import Sidebar from '../../sidebar/Sidebar';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';

interface DashboardLayoutProps {
  selectedView: number;
  setSelectedView: (view: number) => void;
  userGroups: Group[];
  activeGroupId: string | null;
  setActiveGroupId: (gid: string | null) => void;
  isInputFocused: boolean;
  isJoiningInvite: boolean;
  userData: UserData;
  children: ReactNode;
}

const DashboardLayout: FC<DashboardLayoutProps> = ({
  selectedView,
  setSelectedView,
  userGroups,
  activeGroupId,
  setActiveGroupId,
  isInputFocused,
  isJoiningInvite,
  userData,
  children
}) => {
  return (
    <div className={`AppGlass Grid ${selectedView === 2 ? 'view-fixed' : ''}`}>
      <Sidebar
        selected={selectedView}
        setSelected={setSelectedView}
        userGroups={userGroups}
        activeGroupId={activeGroupId}
        setActiveGroupId={setActiveGroupId}
        hideMobile={isInputFocused || isJoiningInvite}
        userData={userData}
      />
      <div className={`DashboardContent ${selectedView === 2 ? 'group-chat-view' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;
