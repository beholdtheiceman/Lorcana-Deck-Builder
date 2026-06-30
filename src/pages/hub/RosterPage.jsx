import { useOutletContext } from 'react-router-dom'
import RosterTab from '../../components/team/RosterTab'

export default function RosterPage() {
  const { hub, user } = useOutletContext()
  return <RosterTab hubId={hub.id} currentUser={user} />
}
