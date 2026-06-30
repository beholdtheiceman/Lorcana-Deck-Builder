import { useOutletContext } from 'react-router-dom'
import PracticesTab from '../../components/team/PracticesTab'

export default function PracticesPage() {
  const { hub, user } = useOutletContext()
  return <PracticesTab hubId={hub.id} currentUser={user} isOwner={hub.ownerId === user?.id} />
}
