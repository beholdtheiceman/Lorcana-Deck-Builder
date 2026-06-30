import { useOutletContext } from 'react-router-dom'
import PodsTab from '../../components/team/PodsTab'

export default function PodsPage() {
  const { hub, user } = useOutletContext()
  return <PodsTab hubId={hub.id} currentUser={user} />
}
