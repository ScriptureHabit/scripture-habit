import { ReactNode } from 'react';
import Sidebar from '../../sidebar/sidebar';
import { Group } from '../../../types/chat';

interface DashboardLayoutProps {
  selectedView: number;
  setSelectedView: (view: number) => void;
  userGroups: Group[];
  activeGroupId: string | null;
  setActiveGroupId: (gid: string | null) => void;
  isInputFocused: boolean;
  isJoiningInvite: boolean;
  currentUserId?: string | null;
  children: ReactNode;
}

const DashboardLayout = ({
  selectedView,
  setSelectedView,
  userGroups,
  activeGroupId,
  setActiveGroupId,
  isInputFocused,
  isJoiningInvite,
  currentUserId,
  children
}: DashboardLayoutProps) => {
  return (
    <div className={`AppGlass Grid ${selectedView === 2 ? 'view-fixed' : ''}`} data-testid="dashboard-ready">
      <Sidebar
        selected={selectedView}
        setSelected={setSelectedView}
        userGroups={userGroups}
        activeGroupId={activeGroupId}
        setActiveGroupId={setActiveGroupId}
        hideMobile={isInputFocused || isJoiningInvite}
        currentUserId={currentUserId}
      />
      <main className={`DashboardContent ${selectedView === 2 ? 'group-chat-view' : ''}`}>
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
