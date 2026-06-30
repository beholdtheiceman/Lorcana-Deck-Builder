import { useOutletContext } from 'react-router-dom'
import EventsPanel from '../../components/EventsPanel'

export default function EventsPage() {
  const { hub, user } = useOutletContext()
  return (
    <EventsPanel
      hubId={hub.id}
      currentUser={user}
      isOwner={hub.ownerId === user?.id}
      initialWebhook={hub.discordWebhookUrl || ''}
    />
  )
}
