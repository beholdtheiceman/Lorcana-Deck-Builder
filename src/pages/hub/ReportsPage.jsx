import { useOutletContext } from 'react-router-dom'
import MetaReportsTab from '../../components/team/MetaReportsTab'

export default function ReportsPage() {
  const { hub, user } = useOutletContext()
  return <MetaReportsTab hubId={hub.id} currentUser={user} isOwner={hub.ownerId === user?.id} />
}
