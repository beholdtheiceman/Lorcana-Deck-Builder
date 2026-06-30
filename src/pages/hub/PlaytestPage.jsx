import { useOutletContext } from 'react-router-dom'
import PlaytestLog from '../../components/PlaytestLog'

export default function PlaytestPage() {
  const { hub, user } = useOutletContext()
  return <PlaytestLog hubId={hub.id} decks={[]} currentUser={user} />
}
