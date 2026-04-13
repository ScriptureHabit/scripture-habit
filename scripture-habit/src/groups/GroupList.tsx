
import { useEffect, useState, useMemo } from 'react';
import { getFirestore, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { app } from '../firebase';
import GroupCard from './GroupCard';
import { useLanguage } from '../../hooks/useLanguage';
import './GroupList.css';
import { Group } from '../types/chat';

// --- Types ---

interface GroupData extends Omit<Group, 'id'> {
  id: string;
}



interface GroupListProps {
  currentUser: { uid: string } | null;
}

// --- Component ---

export default function GroupList({ currentUser }: GroupListProps) {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const db = useMemo(() => getFirestore(app), []);

  useEffect(() => {
    setLoading(true);
    
    // Query for last 50 created groups
    const q = query(
      collection(db, 'groups'), 
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: GroupData[] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as GroupData));
        
        setGroups(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed loading groups:', err);
        setError('Failed to load groups. Please try again.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db]);

  if (loading) {
    return (
      <div className="loading-state">
        <p>{t('loading') || 'Loading groups...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
      </div>
    );
  }

  return (
    <div className="group-list-container">
      <div className="group-list-header">
        <h3>{t('groupListDetail.title') || (t('groupList?.title') || 'Public Groups')}</h3>
        <span className="count-badge">{groups.length}</span>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <p>{t('groupListDetail.empty') || (t('groupList?.empty') || 'No groups found. Be the first to create one!')}</p>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => (
            <GroupCard 
              key={group.id} 
              group={group} 
              currentUser={currentUser} 
            />
          ))}
        </div>
      )}
    </div>
  );
}


